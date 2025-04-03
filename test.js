const { whisper } = require('whisper-node');
const path = require("path");

console.log('whisper: ', whisper);
async function transcribeAudio() {
    try {
        console.log("Starting transcription...");
        const filePath = path.resolve(__dirname, "test_16000.wav");
        console.log("File exists:", require('fs').existsSync(filePath));
        const transcript = await whisper(filePath, {
            modelName: "tiny.en",
            modelDownload: true,
            whisperOptions: {
              language: 'auto',         // default (use 'auto' for auto detect)
              word_timestamps: true     // timestamp for every word
            }
          });
        console.log("Transcription completed:", transcript);
    } catch (error) {
        console.error("Error transcribing audio:", error);
    }
}

transcribeAudio();