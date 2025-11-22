// AudioWorkletProcessor for real-time audio processing
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffers = [];
    this.isRecording = false;
    this.chunkSize = 44100 * 2; // 2 seconds at 44.1kHz

    // Listen for messages from main thread
    this.port.onmessage = (event) => {
      const { type } = event.data;
      switch (type) {
        case 'start':
          this.isRecording = true;
          this.buffers = [];
          break;
        case 'stop':
          this.isRecording = false;
          // Send remaining buffer
          if (this.buffers.length > 0) {
            this.port.postMessage({
              type: 'audioData',
              data: this.buffers.slice()
            });
          }
          this.buffers = [];
          break;
      }
    };
  }

  process(inputs) {
    if (!this.isRecording) return true;

    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0]; // Mono channel
      if (channelData) {
        // Convert Float32Array to regular array for easier handling
        const buffer = Array.from(channelData);
        this.buffers.push(buffer);

        // Check if we have enough data for a chunk (2 seconds)
        const totalSamples = this.buffers.reduce((sum, arr) => sum + arr.length, 0);
        if (totalSamples >= this.chunkSize) {
          this.port.postMessage({
            type: 'audioData',
            data: this.buffers.slice()
          });
          this.buffers = []; // Clear buffer after sending
        }
      }
    }

    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);