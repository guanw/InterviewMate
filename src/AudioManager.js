// Audio Manager class to encapsulate audio-related state and refs
window.AudioManager = class AudioManager {
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
};