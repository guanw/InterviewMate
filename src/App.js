import { SAMPLE_RATE, CHANNELS, BIT_DEPTH, PAUSE_DELAY, MAX_LENGTH } from './Constants.js';
import { AudioManager } from './AudioManager.js';
import { TranscriptEntry } from './TranscriptEntry.js';
import { MetricsManager } from './MetricsManager.js';
import { MetricsDisplay } from './MetricsDisplay.js';

// Temporary fallback to console until logging module is browser-compatible
// eslint-disable-next-line no-console
const logError = console.error;
// eslint-disable-next-line no-console
const info = console.log;

const { useState, useEffect, useRef } = React;


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
  info("start: convertToWav");
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
  info("end: convertToWav");
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
  const [status, setStatus] = useState('Ready');
  const [transcripts, setTranscripts] = useState([]);
  const [llmResponse, setLlmResponse] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [metricsSummary, setMetricsSummary] = useState(null);
  const [showMetricsModal, setShowMetricsModal] = useState(false);

  // Refs for synchronous access in callbacks and audio management
  const conversationBufferRef = useRef(''); // Mirrors conversationBuffer state
  const pauseTimerRef = useRef(null); // Timer management
  const transcriptScrollRef = useRef(null); // Scroll container ref
  const audioManagerRef = useRef(new AudioManager()); // Encapsulates audio-related state
  const metricsManagerRef = useRef(new MetricsManager()); // Performance metrics tracking

  const resetPauseTimer = () => {
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = setTimeout(async () => {
      const currentBuffer = conversationBufferRef.current;
      info('Pause detected, triggering LLM with buffer:', currentBuffer);
      info('Buffer length:', currentBuffer ? currentBuffer.length : 'null/undefined');
      setIsAnalyzing(true);
      try {
        const llmStart = performance.now();
        const { success, response, error } = await window.electronAPI.analyzeConversation(currentBuffer);
        const llmEnd = performance.now();
        metricsManagerRef.current.trackLLMAnalysis(llmStart, llmEnd, currentBuffer.length);

        if (success) {
          setLlmResponse(response);
        } else {
          logError('LLM error:', error);
          setLlmResponse(`Error: ${error}`);
        }
      } catch (err) {
        logError('LLM call failed:', err);
        setLlmResponse('Failed to analyze conversation');
      }
      setIsAnalyzing(false);
    }, PAUSE_DELAY);
  };

  // Audio State (now using refs)

  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = 0; // Scroll to top for latest conversation
    }
  }, [transcripts]);

  // Update metrics summary periodically
  useEffect(() => {
    const updateMetrics = () => {
      setMetricsSummary(metricsManagerRef.current.getMetricsSummary());
    };

    // Update immediately and then every 2 seconds
    updateMetrics();
    const interval = setInterval(updateMetrics, 2000);
    return () => clearInterval(interval);
  }, []);

  // Function to clear metrics
  const clearMetrics = () => {
    metricsManagerRef.current.clearMetrics();
    setMetricsSummary(null);
  };

  const startRecording = async () => {
    info("start: startRecording");
    try {
      setStatus('Initializing microphone...');

      // Start metrics tracking session
      metricsManagerRef.current.startRecordingSession();

      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });

      // Resume audio context if suspended (required by some browsers)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);

      // Load and create AudioWorklet
      await audioContext.audioWorklet.addModule('src/AudioWorkletProcessor.js');
      const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');

      // Handle messages from AudioWorklet
      workletNode.port.onmessage = (event) => {
        const { type, data } = event.data;
        if (type === 'audioData') {
          // Process audio chunks from worklet
          const combined = mergeFloat32Arrays(data.map(arr => new Float32Array(arr)));
          audioManagerRef.current.setAudioChunks([combined]);
          processAudioChunk();
        }
      };

      analyser.connect(workletNode);
      workletNode.connect(audioContext.destination);

      audioManagerRef.current.setAudioContext(audioContext);
      audioManagerRef.current.setAnalyser(analyser);
      audioManagerRef.current.setMicrophone(microphone);
      audioManagerRef.current.setWorkletNode(workletNode);
      audioManagerRef.current.clearAudioChunks();
      audioManagerRef.current.setIsRecording(true);

      // Start the worklet
      workletNode.port.postMessage({ type: 'start' });

      setIsRecording(true);
      setStatus('Recording...');
    } catch (error) {
      logError("Audio error:", error);
      setStatus(`Error: ${error.message}`);
    }
    info("end: startRecording");
  };

  const stopRecording = () => {
    if (!isRecording) return;
    info("Stopping recording...");
    audioManagerRef.current.setIsRecording(false);
    setIsRecording(false);
    setStatus('Stopping...');

    // Stop AudioWorklet
    const workletNode = audioManagerRef.current.getWorkletNode();
    if (workletNode) {
      workletNode.port.postMessage({ type: 'stop' });
      workletNode.disconnect();
    }

    // Disconnect audio nodes
    const microphone = audioManagerRef.current.getMicrophone();
    if (microphone) microphone.disconnect();
    const analyser = audioManagerRef.current.getAnalyser();
    if (analyser) analyser.disconnect();
    const audioContext = audioManagerRef.current.getAudioContext();
    if (audioContext) audioContext.close();

    // Clear any pending timers and audio chunks
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    audioManagerRef.current.clearAudioChunks();
    setStatus('Ready');
  };

  const processAudioChunk = async () => {
    info("start: processAudioChunk");
    const audioProcessingStart = performance.now();

    // Don't process if recording has been stopped
    if (!audioManagerRef.current.getIsRecording()) {
      info("Recording stopped, skipping audio chunk processing");
      return;
    }
    const chunks = audioManagerRef.current.getAudioChunks();
    if (chunks.length === 0) return;
    const combined = mergeFloat32Arrays(chunks);
    audioManagerRef.current.clearAudioChunks(); // Reset even if error
    const wavBuffer = convertToWav(combined, SAMPLE_RATE, CHANNELS, BIT_DEPTH);

    const audioProcessingEnd = performance.now();
    metricsManagerRef.current.trackAudioProcessing(audioProcessingStart, audioProcessingEnd, wavBuffer.length);

    try {
      setStatus('Sending to Whisper...');
      const transcriptionStart = performance.now();
      const { success, result, error } = await window.electronAPI.transcribeAudio(wavBuffer);
      const transcriptionEnd = performance.now();
      metricsManagerRef.current.trackTranscription(transcriptionStart, transcriptionEnd, wavBuffer.length);
      if (success) {
        const segments = Array.isArray(result) ? result : [];
        const newEntry = { segments, timestamp: new Date() };
        setTranscripts(prev => [newEntry, ...prev]);
        // Accumulate conversation buffer
        const newText = segments.filter(s => s.speech && s.speech.trim()).map(s => s.speech).join(' ');
        const maxLength = MAX_LENGTH;
        const currentBuffer = conversationBufferRef.current;
        const updated = currentBuffer + (currentBuffer ? ' ' : '') + newText;
        const final = updated.length > maxLength ? updated.slice(-maxLength) : updated;
        conversationBufferRef.current = final;
        const concatenated_audio_text = segments.map((res) => res.speech || '').join('').toLowerCase();
        if (!concatenated_audio_text.includes('blank_audio')) {
          resetPauseTimer();
        }
        if (audioManagerRef.current.getIsRecording()) {
          setStatus('Recording...');
        }
        info("success: processAudioChunk");
      } else {
        logError("error: processAudioChunk --", error);
        throw new Error(error);
      }
    } catch (error) {
      logError("Transcription error: processAudioChunk --", error);
      setStatus(`Transcription Error: ${error.message}`);
    }
  };

  // Keyboard event listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if ((e.key === 's' || e.key === 'S') && !isRecording) startRecording();
      if ((e.key === 'x' || e.key === 'X') && isRecording) stopRecording();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isRecording]);

  // Listen for menu events from main process
  useEffect(() => {
    const handleShowMetrics = () => setShowMetricsModal(true);
    window.electronAPI?.onShowMetrics?.(handleShowMetrics);

    return () => {
      window.electronAPI?.removeShowMetricsListener?.(handleShowMetrics);
    };
  }, []);

  return React.createElement('div', null,
    React.createElement('div', { className: 'top-row' },
      React.createElement('div', { className: 'control-panel' },
        React.createElement('button', { onClick: startRecording, disabled: isRecording, className: isRecording ? 'start-btn disabled' : 'start-btn', style: { marginBottom: '10px' } }, 'Start Recording'),
        React.createElement('button', { onClick: stopRecording, disabled: !isRecording, className: 'stop-btn' }, 'Stop Recording'),
        React.createElement('div', { className: 'status' }, status),
        React.createElement('small', null, 'Keyboard shortcuts: Press \'S\' to start, \'X\' to stop')
      ),
      React.createElement('div', { className: 'llm-container' },
        React.createElement('h2', null, 'AI Analysis'),
        isAnalyzing ? React.createElement('p', null, 'Analyzing conversation...') : React.createElement('pre', { className: 'llm-response' }, llmResponse || 'No analysis yet')
      )
    ),
    React.createElement('div', { className: 'transcript-container' },
      React.createElement('h2', null, 'Transcription Results'),
      React.createElement('div', { ref: transcriptScrollRef, style: { height: '500px', overflowY: 'auto' } },
        transcripts.map((entry, idx) => React.createElement(TranscriptEntry, { key: idx, entry }))
      )
    ),
    // Metrics Modal
    showMetricsModal && React.createElement('div', { className: 'modal-overlay', onClick: () => setShowMetricsModal(false) },
      React.createElement('div', { className: 'modal-content', onClick: (e) => e.stopPropagation() },
        React.createElement('div', { className: 'modal-header' },
          React.createElement('h2', null, 'Performance Metrics'),
          React.createElement('button', { className: 'modal-close', onClick: () => setShowMetricsModal(false) }, '×')
        ),
        React.createElement('div', { className: 'modal-body' },
          React.createElement(MetricsDisplay, { metrics: metricsSummary, onClearMetrics: clearMetrics })
        )
      )
    )
  );
}

export { App };