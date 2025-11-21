const { useState, useEffect, useRef, useCallback } = React;

// Audio Configuration
const SAMPLE_RATE = 16000;
const CHANNELS = 1;
const BIT_DEPTH = 16;
const CHUNK_DURATION = 2; // seconds
const pauseDelay = 4000; // 4 seconds, configurable
const MAX_LENGTH = 50000 // keep last 50000 characters
const MAX_AUDIO_CHUNKS = 50; // Max chunks to prevent memory overflow

// Audio Manager class to encapsulate audio-related state and refs
class AudioManager {
  constructor() {
    this.isRecording = false;
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.processor = null;
    this.audioChunks = [];
  }

  setRecording(value) { this.isRecording = value; }
  getRecording() { return this.isRecording; }

  setAudioContext(ctx) { this.audioContext = ctx; }
  getAudioContext() { return this.audioContext; }

  setAnalyser(analyser) { this.analyser = analyser; }
  getAnalyser() { return this.analyser; }

  setMicrophone(mic) { this.microphone = mic; }
  getMicrophone() { return this.microphone; }

  setProcessor(proc) { this.processor = proc; }
  getProcessor() { return this.processor; }

  setAudioChunks(chunks) { this.audioChunks = chunks; }
  getAudioChunks() { return this.audioChunks; }
  addAudioChunk(chunk) { this.audioChunks.push(chunk); }
  clearAudioChunks() { this.audioChunks = []; }
}

// Helper functions
function mergeFloat32Arrays(arrays) {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Float32Array(totalLength);
  let offset = 0;
  arrays.forEach(arr => {
    result.set(arr, offset);
    offset += arr.length;
  });
  return result;
}

function convertToWav(input, sampleRate, channels, bitDepth) {
  console.log("start: convertToWav");
  const bytesPerSample = bitDepth / 8;
  const blockAlign = channels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + input.length * bytesPerSample);
  const view = new DataView(buffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + input.length * bytesPerSample, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, input.length * bytesPerSample, true);
  const scale = Math.pow(2, bitDepth - 1);
  for (let i = 0; i < input.length; i++) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    const intSample = sample < 0 ? sample * scale : sample * (scale - 1);
    view.setInt16(44 + (i * 2), intSample, true);
  }
  console.log("end: convertToWav");
  return new Uint8Array(buffer);
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function App() {
  // UI state variables (trigger re-renders)
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('Ready to start');
  const [transcripts, setTranscripts] = useState([]);
  const [conversationBuffer, setConversationBuffer] = useState('');
  const [llmResponse, setLlmResponse] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Refs for synchronous access in callbacks and audio management
  const conversationBufferRef = useRef(''); // Mirrors conversationBuffer state
  const pauseTimerRef = useRef(null); // Timer management
  const transcriptScrollRef = useRef(null); // Scroll container ref
  const audioManagerRef = useRef(new AudioManager()); // Encapsulates audio-related state

  const resetPauseTimer = () => {
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = setTimeout(async () => {
      const currentBuffer = conversationBufferRef.current;
      console.log('Pause detected, triggering LLM with buffer:', currentBuffer);
      console.log('Buffer length:', currentBuffer ? currentBuffer.length : 'null/undefined');
      setIsAnalyzing(true);
      try {
        const { success, response, error } = await window.electronAPI.analyzeConversation(currentBuffer);
        if (success) {
          setLlmResponse(response);
        } else {
          console.error('LLM error:', error);
          setLlmResponse(`Error: ${error}`);
        }
      } catch (err) {
        console.error('LLM call failed:', err);
        setLlmResponse('Failed to analyze conversation');
      }
      setIsAnalyzing(false);
    }, pauseDelay);
  };

  // Audio State (now using refs)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if ((e.key === 's' || e.key === 'S') && !isRecording) startRecording();
      if ((e.key === 'x' || e.key === 'X') && isRecording) stopRecording();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isRecording]);

  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = 0; // Scroll to top for latest conversation
    }
  }, [transcripts]);

  const startRecording = async () => {
    console.log("start: startRecording");
    try {
      setStatus('Initializing microphone...');

      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      const processor = audioContext.createScriptProcessor(4096, CHANNELS, CHANNELS);
      processor.onaudioprocess = processAudio;
      analyser.connect(processor);
      processor.connect(audioContext.destination);

      audioManagerRef.current.setAudioContext(audioContext);
      audioManagerRef.current.setAnalyser(analyser);
      audioManagerRef.current.setMicrophone(microphone);
      audioManagerRef.current.setProcessor(processor);
      audioManagerRef.current.clearAudioChunks();
      audioManagerRef.current.setRecording(true);
      setIsRecording(true);
      setStatus('Recording...');
    } catch (error) {
      console.log("error: startRecording");
      console.error("Audio error:", error);
      setStatus(`Error: ${error.message}`);
    }
    console.log("end: startRecording");
  };

  const stopRecording = () => {
    if (!isRecording) return;
    console.log("Stopping recording...");
    audioManagerRef.current.setRecording(false);
    setIsRecording(false);
    setStatus('Stopping...');
    // Disconnect audio nodes
    const processor = audioManagerRef.current.getProcessor();
    if (processor) {
      processor.onaudioprocess = null; // Clear callback
      processor.disconnect();
    }
    const microphone = audioManagerRef.current.getMicrophone();
    if (microphone) microphone.disconnect();
    const analyser = audioManagerRef.current.getAnalyser();
    if (analyser) analyser.disconnect();
    const audioContext = audioManagerRef.current.getAudioContext();
    if (audioContext) audioContext.close();
    // Process remaining chunks
    if (audioManagerRef.current.getAudioChunks().length > 0) {
      processAudioChunk();
    }
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    setStatus('Ready');
  };

  const processAudio = useCallback((e) => {
    try {
      console.log("start: processAudio");
      if (!audioManagerRef.current.getRecording()) return;
      const inputData = e.inputBuffer.getChannelData(0);
      audioManagerRef.current.addAudioChunk(new Float32Array(inputData));
      const chunkSize = SAMPLE_RATE * CHUNK_DURATION;
      const totalSamples = audioManagerRef.current.getAudioChunks().reduce((sum, chunk) => sum + chunk.length, 0);
      if (totalSamples >= chunkSize || audioManagerRef.current.getAudioChunks().length >= MAX_AUDIO_CHUNKS) {
        processAudioChunk();
      }
      console.log("end: processAudio");
    } catch (error) {
      console.error("Error in processAudio:", error);
    }
  }, []);


  const processAudioChunk = async () => {
    console.log("start: processAudioChunk");
    const chunks = audioManagerRef.current.getAudioChunks();
    if (chunks.length === 0) return;
    const combined = mergeFloat32Arrays(chunks);
    audioManagerRef.current.clearAudioChunks(); // Reset even if error
    const wavBuffer = convertToWav(combined, SAMPLE_RATE, CHANNELS, BIT_DEPTH);
    try {
      setStatus('Sending to Whisper...');
      const { success, result, error } = await window.electronAPI.transcribeAudio(wavBuffer);
      if (success) {
        const segments = Array.isArray(result) ? result : [];
        const newEntry = { segments, timestamp: new Date() };
        setTranscripts(prev => [newEntry, ...prev]);
        // Accumulate conversation buffer
        const newText = segments.filter(s => s.speech && s.speech.trim()).map(s => s.speech).join(' ');
        const maxLength = MAX_LENGTH;
        setConversationBuffer(prev => {
          const updated = prev + (prev ? ' ' : '') + newText;
          const final = updated.length > maxLength ? updated.slice(-maxLength) : updated;
          conversationBufferRef.current = final;
          return final;
        });
        const concatenated_audio_text = segments.map((res) => res.speech || '').join('').toLowerCase();
        if (!concatenated_audio_text.includes('blank_audio')) {
          resetPauseTimer();
        }
        if (audioManagerRef.current.getRecording()) {
          setStatus('Recording...');
        }
        console.log("success: processAudioChunk");
      } else {
        console.log("error: processAudioChunk --", error);
        throw new Error(error);
      }
    } catch (error) {
      console.error("Transcription error: processAudioChunk --", error);
      setStatus(`Transcription Error: ${error.message}`);
    }
  };

  return React.createElement('div', null,
    React.createElement('h1', null, 'Real-Time Whisper Transcription'),
    React.createElement('div', { className: 'control-panel' },
      React.createElement('button', { onClick: startRecording, disabled: isRecording, className: isRecording ? 'start-btn disabled' : 'start-btn' }, 'Start Recording'),
      React.createElement('button', { onClick: stopRecording, disabled: !isRecording, className: 'stop-btn' }, 'Stop Recording'),
      React.createElement('div', { className: 'status' }, status),
      React.createElement('small', null, 'Keyboard shortcuts: Press \'S\' to start, \'X\' to stop')
    ),
    React.createElement('div', { className: 'llm-container' },
      React.createElement('h2', null, 'AI Analysis'),
      isAnalyzing ? React.createElement('p', null, 'Analyzing conversation...') : React.createElement('pre', { className: 'llm-response' }, llmResponse || 'No analysis yet')
    ),
    React.createElement('div', { className: 'transcript-container' },
      React.createElement('h2', null, 'Transcription Results'),
      React.createElement('div', { ref: transcriptScrollRef, style: { height: '700px', overflowY: 'auto' } },
        transcripts.map((entry, idx) => React.createElement(window.TranscriptEntry, { key: idx, entry: entry }))
      )
    )
  );
}

window.App = App;