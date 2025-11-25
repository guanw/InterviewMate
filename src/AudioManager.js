// Audio Manager class to encapsulate audio-related state and refs
export class AudioManager {
  constructor() {
    this.isRecording = false;
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.workletNode = null;
    this.audioChunks = [];
    this.vadManager = null; // Will be initialized when VAD is available
  }

  setIsRecording(value) { this.isRecording = value; }
  getIsRecording() { return this.isRecording; }

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

  // VAD-related methods
  setVADManager(vadManager) { this.vadManager = vadManager; }
  getVADManager() { return this.vadManager; }

  async processVAD(audioBuffer, sampleRate) {
    if (this.vadManager) {
      return await this.vadManager.processAudioChunk(audioBuffer, sampleRate);
    }
    // Return default if VAD not available
    return { isSpeech: true, confidence: 0.5, speechProbability: 0.5 };
  }

  shouldSkipTranscription() {
    return this.vadManager ? this.vadManager.shouldSkipTranscription() : false;
  }

  getVADStats() {
    return this.vadManager ? this.vadManager.getStats() : null;
  }

  resetVAD() {
    if (this.vadManager) {
      this.vadManager.reset();
    }
  }
}