// Audio Configuration
const SAMPLE_RATE = 16000;
const CHANNELS = 1;
const BIT_DEPTH = 16;
const CHUNK_DURATION = 5; // seconds

// DOM Elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('status');
const transcriptDiv = document.getElementById('transcript');

// Audio State
let audioContext;
let analyser;
let microphone;
let processor;
let isRecording = false;
let animationId;
let audioChunks = [];

// Initialize
function init() {
  startBtn.disabled = false;
  stopBtn.disabled = true;

  startBtn.addEventListener('click', startRecording);
  stopBtn.addEventListener('click', stopRecording);
}

// Start Recording
async function startRecording() {
  console.log("start: startRecording");
  try {
    statusDiv.textContent = "Initializing microphone...";
    startBtn.disabled = true;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: SAMPLE_RATE
    });

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;

    microphone = audioContext.createMediaStreamSource(stream);
    microphone.connect(analyser);

    // Setup audio processor
    processor = audioContext.createScriptProcessor(4096, CHANNELS, CHANNELS);
    processor.onaudioprocess = processAudio;
    analyser.connect(processor);
    processor.connect(audioContext.destination);

    isRecording = true;
    stopBtn.disabled = false;
    statusDiv.textContent = "Recording...";
  } catch (error) {
    console.log("error: startRecording");
    console.error("Microphone error:", error);
    statusDiv.textContent = `Error: ${error.message}`;
    startBtn.disabled = false;
  }

  console.log("end: startRecording");
}

// Stop Recording
function stopRecording() {
  if (!isRecording) return;

  if (microphone) microphone.disconnect();
  if (processor) processor.disconnect();
  if (audioContext) audioContext.close();

  cancelAnimationFrame(animationId);

  isRecording = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  statusDiv.textContent = "Ready";
}

// Process Audio Chunks
function processAudio(e) {
  console.log("start: processAudio");
  if (!isRecording) return;

  const inputData = e.inputBuffer.getChannelData(0);
  audioChunks.push(new Float32Array(inputData));

  // Process chunks every CHUNK_DURATION seconds
  const chunkSize = SAMPLE_RATE * CHUNK_DURATION;
  if (audioChunks.reduce((sum, chunk) => sum + chunk.length, 0) >= chunkSize) {
    processAudioChunk();
  }

  console.log("end: processAudio");
}

// Process and send audio chunk to Whisper
async function processAudioChunk() {
  console.log("start: processAudioChunk");
  if (audioChunks.length === 0) return;

  // Combine chunks
  const combined = mergeFloat32Arrays(audioChunks);
  audioChunks = [];

  // Convert to WAV format
  const wavBuffer = convertToWav(combined, SAMPLE_RATE, CHANNELS, BIT_DEPTH);

  // Send to main process for transcription
  try {
    statusDiv.textContent = "Sending to Whisper...";
    const { success, result, error } = await window.electronAPI.transcribeAudio(wavBuffer);

    if (success) {
      displayTranscript(result);
      statusDiv.textContent = "Recording...";
      console.log("success: processAudioChunk");
    } else {
      console.log("error: processAudioChunk --", error);
      throw new Error(error);
    }
  } catch (error) {
    console.error("Transcription error: processAudioChunk --", error);
    statusDiv.textContent = `Transcription Error: ${error.message}`;
  }
}

// Convert Float32 to WAV (16-bit PCM)
function convertToWav(input, sampleRate, channels, bitDepth) {
  console.log("start: convertToWav");
  const bytesPerSample = bitDepth / 8;
  const blockAlign = channels * bytesPerSample;

  const buffer = new ArrayBuffer(44 + input.length * bytesPerSample);
  const view = new DataView(buffer);

  // Write WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + input.length * bytesPerSample, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, input.length * bytesPerSample, true);

  // Write 16-bit PCM data
  const scale = Math.pow(2, bitDepth - 1);
  for (let i = 0; i < input.length; i++) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    const intSample = sample < 0 ? sample * scale : sample * (scale - 1);
    view.setInt16(44 + (i * 2), intSample, true);
  }

  console.log("end: convertToWav");
  return new Uint8Array(buffer);
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

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function displayTranscript(result) {
  if (!Array.isArray(result) || result.length === 0) return;

  const timestamp = new Date().toLocaleTimeString();
  const container = document.createElement('div');
  container.className = 'transcript-entry';

  // Create header with timestamp
  const header = document.createElement('div');
  header.innerHTML = `<strong>${timestamp}</strong>`;
  container.appendChild(header);

  // Process each speech segment
  const content = document.createElement('div');
  content.className = 'transcript-content';

  let currentText = '';
  let currentStart = '';
  let currentEnd = '';

  result.forEach((segment, index) => {
    // Skip empty segments
    if (!segment.speech || segment.speech.trim() === '') return;

    // If this segment continues from previous
    if (index > 0 && segment.start === result[index-1].end) {
      currentText += segment.speech;
      currentEnd = segment.end;
    } else {
      // Add previous segment if exists
      if (currentText) {
        const span = createSpeechSpan(currentText, currentStart, currentEnd);
        content.appendChild(span);
      }
      // Start new segment
      currentText = segment.speech;
      currentStart = segment.start;
      currentEnd = segment.end;
    }
  });

  // Add the last segment
  if (currentText) {
    const span = createSpeechSpan(currentText, currentStart, currentEnd);
    content.appendChild(span);
  }

  container.appendChild(content);
  transcriptDiv.insertBefore(container, transcriptDiv.firstChild);

  // Auto-scroll to newest transcript
  transcriptDiv.scrollTop = 0;
}

function createSpeechSpan(text, start, end) {
  const span = document.createElement('span');
  span.className = 'speech-segment';
  span.textContent = text;

  // Add tooltip with timestamps
  span.title = `${start} - ${end}`;

  // Optional: Add click handler to jump to time in audio
  span.style.cursor = 'pointer';
  span.addEventListener('click', () => {
    console.log(`Jump to ${start} in audio`);
    // You could implement audio playback control here
  });

  return span;
}

// Initialize the app
document.addEventListener('DOMContentLoaded', init);