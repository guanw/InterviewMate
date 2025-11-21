// Audio Configuration Constants
window.Constants = {
  SAMPLE_RATE: 16000,
  CHANNELS: 1,
  BIT_DEPTH: 16,
  CHUNK_DURATION: 2, // seconds
  PAUSE_DELAY: 4000, // 4 seconds, configurable
  MAX_LENGTH: 50000, // keep last 50000 characters
  MAX_AUDIO_CHUNKS: 50 // Max chunks to prevent memory overflow
};