export class MetricsManager {
  constructor(maxEntries = 50) {
    this.maxEntries = maxEntries;
    this.metrics = {
      audioProcessing: [], // Time from audio chunk received to processed
      transcription: [],   // Time from sending to Whisper to receiving results
      llmAnalysis: [],     // Time from sending to LLM to receiving response
      audioChunks: [],     // Audio chunk sizes and processing times
      totalLatency: []     // End-to-end latency (recording start to final result)
    };
    this.currentSession = {
      recordingStartTime: null,
      lastTranscriptionTime: null,
      lastLLMTime: null
    };
  }

  // Start timing for a recording session
  startRecordingSession() {
    this.currentSession.recordingStartTime = performance.now();
    console.log('Started recording session metrics tracking');
  }

  // End timing for a recording session
  endRecordingSession() {
    this.currentSession.recordingStartTime = null;
    this.currentSession.lastTranscriptionTime = null;
    this.currentSession.lastLLMTime = null;
  }

  // Track audio processing time
  trackAudioProcessing(startTime, endTime, chunkSize) {
    const duration = endTime - startTime;
    this.metrics.audioProcessing.push({
      timestamp: Date.now(),
      duration,
      chunkSize
    });

    // Keep only recent entries
    if (this.metrics.audioProcessing.length > this.maxEntries) {
      this.metrics.audioProcessing.shift();
    }

    console.log(`Audio processing: ${duration.toFixed(2)}ms for ${chunkSize} bytes`);
  }

  // Track transcription time
  trackTranscription(startTime, endTime, audioSize) {
    const duration = endTime - startTime;
    this.metrics.transcription.push({
      timestamp: Date.now(),
      duration,
      audioSize
    });

    // Keep only recent entries
    if (this.metrics.transcription.length > this.maxEntries) {
      this.metrics.transcription.shift();
    }

    // Calculate total latency if we have a recording start time
    if (this.currentSession.recordingStartTime) {
      const totalLatency = endTime - this.currentSession.recordingStartTime;
      this.metrics.totalLatency.push({
        timestamp: Date.now(),
        duration: totalLatency,
        type: 'transcription'
      });

      if (this.metrics.totalLatency.length > this.maxEntries) {
        this.metrics.totalLatency.shift();
      }
    }

    this.currentSession.lastTranscriptionTime = endTime;
    console.log(`Transcription: ${duration.toFixed(2)}ms for ${audioSize} bytes`);
  }

  // Track LLM analysis time
  trackLLMAnalysis(startTime, endTime, bufferLength) {
    const duration = endTime - startTime;
    this.metrics.llmAnalysis.push({
      timestamp: Date.now(),
      duration,
      bufferLength
    });

    // Keep only recent entries
    if (this.metrics.llmAnalysis.length > this.maxEntries) {
      this.metrics.llmAnalysis.shift();
    }

    // Calculate total latency if we have a recording start time
    if (this.currentSession.recordingStartTime) {
      const totalLatency = endTime - this.currentSession.recordingStartTime;
      this.metrics.totalLatency.push({
        timestamp: Date.now(),
        duration: totalLatency,
        type: 'llm'
      });

      if (this.metrics.totalLatency.length > this.maxEntries) {
        this.metrics.totalLatency.shift();
      }
    }

    this.currentSession.lastLLMTime = endTime;
    console.log(`LLM Analysis: ${duration.toFixed(2)}ms for ${bufferLength} chars`);
  }

  // Get current metrics summary
  getMetricsSummary() {
    const calculateStats = (entries) => {
      if (entries.length === 0) return { count: 0, avg: 0, min: 0, max: 0, latest: 0 };

      const durations = entries.map(e => e.duration);
      return {
        count: entries.length,
        avg: durations.reduce((a, b) => a + b, 0) / durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations),
        latest: entries[entries.length - 1]?.duration || 0
      };
    };

    return {
      audioProcessing: calculateStats(this.metrics.audioProcessing),
      transcription: calculateStats(this.metrics.transcription),
      llmAnalysis: calculateStats(this.metrics.llmAnalysis),
      totalLatency: calculateStats(this.metrics.totalLatency)
    };
  }

  // Get recent metrics for display
  getRecentMetrics(count = 10) {
    return {
      audioProcessing: this.metrics.audioProcessing.slice(-count),
      transcription: this.metrics.transcription.slice(-count),
      llmAnalysis: this.metrics.llmAnalysis.slice(-count),
      totalLatency: this.metrics.totalLatency.slice(-count)
    };
  }

  // Clear all metrics
  clearMetrics() {
    Object.keys(this.metrics).forEach(key => {
      this.metrics[key] = [];
    });
    this.endRecordingSession();
    console.log('Metrics cleared');
  }
}