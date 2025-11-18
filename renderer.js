// Audio Configuration
const SAMPLE_RATE = 16000;
const CHANNELS = 1;
const BIT_DEPTH = 16;
const CHUNK_DURATION = 5; // seconds

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

const { useState, useEffect } = React;

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('Ready to start');
  const [transcripts, setTranscripts] = useState([]);

  // Audio State
  let audioContext;
  let analyser;
  let microphone;
  let processor;
  let animationId;
  let audioChunks = [];

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if ((e.key === 's' || e.key === 'S') && !isRecording) startRecording();
      if ((e.key === 'x' || e.key === 'X') && isRecording) stopRecording();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isRecording]);

  const startRecording = async () => {
    console.log("start: startRecording");
    try {
      setStatus('Initializing microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: SAMPLE_RATE
      });

      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;

      microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);

      processor = audioContext.createScriptProcessor(4096, CHANNELS, CHANNELS);
      processor.onaudioprocess = processAudio;
      analyser.connect(processor);
      processor.connect(audioContext.destination);

      audioChunks = [];
      setIsRecording(true);
      setStatus('Recording...');
    } catch (error) {
      console.log("error: startRecording");
      console.error("Microphone error:", error);
      setStatus(`Error: ${error.message}`);
    }
    console.log("end: startRecording");
  };

  const stopRecording = () => {
    if (!isRecording) return;
    if (microphone) microphone.disconnect();
    if (processor) processor.disconnect();
    if (audioContext) audioContext.close();
    cancelAnimationFrame(animationId);
    if (audioChunks.length > 0) processAudioChunk();
    setIsRecording(false);
    setStatus('Ready');
  };

  const processAudio = (e) => {
    console.log("start: processAudio");
    if (!isRecording) return;
    const inputData = e.inputBuffer.getChannelData(0);
    audioChunks.push(new Float32Array(inputData));
    const chunkSize = SAMPLE_RATE * CHUNK_DURATION;
    if (audioChunks.reduce((sum, chunk) => sum + chunk.length, 0) >= chunkSize) {
      processAudioChunk();
    }
    console.log("end: processAudio");
  };

  const processAudioChunk = async () => {
    console.log("start: processAudioChunk");
    if (audioChunks.length === 0) return;
    const combined = mergeFloat32Arrays(audioChunks);
    audioChunks = [];
    const wavBuffer = convertToWav(combined, SAMPLE_RATE, CHANNELS, BIT_DEPTH);
    try {
      setStatus('Sending to Whisper...');
      const { success, result, error } = await window.electronAPI.transcribeAudio(wavBuffer);
      if (success) {
        setTranscripts(prev => [{ segments: result.segments || [], timestamp: new Date() }, ...prev]);
        setStatus('Recording...');
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

  return React.createElement('div', { style: { fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif', maxWidth: '900px', margin: '0 auto', padding: '20px', backgroundColor: '#f5f5f5' } },
    React.createElement('h1', null, 'Real-Time Whisper Transcription'),
    React.createElement('div', { style: { background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', marginBottom: '20px' } },
      React.createElement('button', { onClick: startRecording, disabled: isRecording, style: { padding: '10px 20px', fontSize: '16px', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '10px', backgroundColor: isRecording ? '#ccc' : '#2ecc71', color: 'white' } }, 'Start Recording'),
      React.createElement('button', { onClick: stopRecording, disabled: !isRecording, style: { padding: '10px 20px', fontSize: '16px', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#e74c3c', color: 'white' } }, 'Stop Recording'),
      React.createElement('div', { style: { margin: '15px 0', padding: '10px', borderRadius: '4px', backgroundColor: '#f8f9fa', fontWeight: 'bold' } }, status),
      React.createElement('small', { style: { color: '#7f8c8d' } }, 'Keyboard shortcuts: Press \'S\' to start, \'X\' to stop')
    ),
    React.createElement('div', { style: { background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' } },
      React.createElement('h2', null, 'Transcription Results'),
      React.createElement('div', null,
        transcripts.map((entry, idx) => React.createElement(TranscriptEntry, { key: idx, entry: entry }))
      )
    )
  );
}

function TranscriptEntry({ entry }) {
  if (!Array.isArray(entry.segments) || entry.segments.length === 0) return null;
  return React.createElement('div', { style: { marginBottom: '15px', padding: '10px', background: '#f8f9fa', borderRadius: '5px', borderLeft: '3px solid #3498db' } },
    React.createElement('div', null, React.createElement('strong', null, entry.timestamp.toLocaleTimeString())),
    React.createElement('div', { style: { marginTop: '5px', lineHeight: '1.5' } },
      entry.segments.filter(segment => segment.speech && segment.speech.trim()).map((segment, i) => React.createElement('span', { key: i, style: { marginRight: '4px', padding: '2px 4px', borderRadius: '3px', backgroundColor: '#e8f4fc', cursor: 'pointer' }, title: `${segment.start} - ${segment.end}` }, segment.speech))
    )
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));