// Audio Manager class to encapsulate audio-related state and refs
window.AudioManager = class AudioManager {
  constructor() {
    this.isRecording = false;
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.workletNode = null;
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

  setWorkletNode(node) { this.workletNode = node; }
  getWorkletNode() { return this.workletNode; }

  // Legacy method for backward compatibility
  setProcessor(proc) { this.workletNode = proc; }
  getProcessor() { return this.workletNode; }

  setAudioChunks(chunks) { this.audioChunks = chunks; }
  getAudioChunks() { return this.audioChunks; }
  addAudioChunk(chunk) { this.audioChunks.push(chunk); }
  clearAudioChunks() { this.audioChunks = []; }
};