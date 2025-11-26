class VADManager {
  constructor() {
    this.audioLevelHistory = [];
    this.isInitialized = true; // Simple VAD doesn't need initialization
    this.sampleRate = 16000;
    this.frameSize = 1024; // Process in chunks
  }

  async processAudioChunk(audioBuffer) {
    try {
      // Calculate RMS (Root Mean Square) volume level
      let sum = 0;
      for (let i = 0; i < audioBuffer.length; i++) {
        sum += audioBuffer[i] * audioBuffer[i];
      }
      const rms = Math.sqrt(sum / audioBuffer.length);

      // Convert to dB scale (rough approximation)
      const dbLevel = rms > 0 ? 20 * Math.log10(rms) : -100;

      // Store in history (keep last 10 seconds of data)
      const now = Date.now();
      this.audioLevelHistory.push({
        timestamp: now,
        rms,
        dbLevel,
        isSpeech: dbLevel > -40 // Simple threshold: -40dB = speech
      });

      // Keep only recent history (last 10 seconds)
      this.audioLevelHistory = this.audioLevelHistory.filter(
        entry => (now - entry.timestamp) < 10000
      );

      const isSpeech = dbLevel > -40;
      const confidence = Math.min(1.0, Math.max(0.0, (dbLevel + 60) / 40)); // Normalize to 0-1

      info(`🎤 VAD: ${isSpeech ? 'SPEECH' : 'SILENCE'} (RMS: ${rms.toFixed(4)}, dB: ${dbLevel.toFixed(1)}, conf: ${(confidence * 100).toFixed(1)}%)`);

      return {
        timestamp: now,
        speechProbability: confidence,
        isSpeech,
        confidence,
        rms,
        dbLevel
      };
    } catch (error) {
      logError('❌ VAD processing error:', error);
      return {
        timestamp: Date.now(),
        speechProbability: 0.5,
        isSpeech: true, // Default to speech to avoid blocking
        confidence: 0.5,
        error: error.message
      };
    }
  }

  getRecentSpeechActivity(windowMs = 5000) {
    const now = Date.now();
    const recentLevels = this.audioLevelHistory.filter(entry =>
      (now - entry.timestamp) < windowMs
    );

    if (recentLevels.length === 0) return { isActive: false, averageConfidence: 0 };

    const speechLevels = recentLevels.filter(entry => entry.isSpeech);
    const averageConfidence = recentLevels.reduce((sum, entry) => sum + entry.confidence, 0) / recentLevels.length;
    const averageDb = recentLevels.reduce((sum, entry) => sum + entry.dbLevel, 0) / recentLevels.length;

    return {
      isActive: speechLevels.length > 0,
      speechRatio: speechLevels.length / recentLevels.length,
      averageConfidence,
      averageDbLevel: averageDb,
      totalSamples: recentLevels.length,
      speechSamples: speechLevels.length
    };
  }

  shouldSkipTranscription() {
    const activity = this.getRecentSpeechActivity(3000); // Last 3 seconds

    // Skip if no speech detected in recent window
    if (!activity.isActive) {
      info('🚫 VAD: Skipping transcription - no speech detected recently');
      return true;
    }

    // Skip if speech ratio is too low (mostly silence/background)
    if (activity.speechRatio < 0.3) {
      info(`🚫 VAD: Skipping transcription - only ${(activity.speechRatio * 100).toFixed(1)}% speech detected`);
      return true;
    }

    // Skip if average volume is too low
    if (activity.averageDbLevel < -45) {
      info(`🚫 VAD: Skipping transcription - too quiet (${activity.averageDbLevel.toFixed(1)}dB)`);
      return true;
    }

    return false;
  }

  reset() {
    this.audioLevelHistory = [];
    info('🔄 VAD audio level history reset');
  }

  getStats() {
    const total = this.audioLevelHistory.length;
    const speech = this.audioLevelHistory.filter(entry => entry.isSpeech).length;
    const avgConfidence = total > 0 ?
      this.audioLevelHistory.reduce((sum, entry) => sum + entry.confidence, 0) / total : 0;
    const avgDb = total > 0 ?
      this.audioLevelHistory.reduce((sum, entry) => sum + entry.dbLevel, 0) / total : 0;

    return {
      totalSamples: total,
      speechSamples: speech,
      silenceSamples: total - speech,
      speechRatio: total > 0 ? speech / total : 0,
      averageConfidence: avgConfidence,
      averageDbLevel: avgDb
    };
  }
}

// Temporary logging functions (should be imported from Logging.js)
const info = console.log;
const logError = console.error;

module.exports = VADManager;