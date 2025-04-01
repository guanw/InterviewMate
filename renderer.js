// // renderer.js
// window.electronAPI.onSpeechRecognized((event, result) => {
//   console.log('Recognition result:', result);
//   appendTranscript(result.text);
// });

// window.electronAPI.onSpeechStart(() => {
//   console.log('Speech started');
//   updateStatus('Speech detected...');
// });

// window.electronAPI.onSpeechEnd(() => {
//   console.log('Speech ended');
//   updateStatus('Waiting for speech input...');
// });

// function updateStatus(message) {
//   document.getElementById('status').innerText = message;
// }

// function appendTranscript(text) {
//   const transcriptDiv = document.getElementById('transcript');
//   transcriptDiv.innerText += text + '\n';
// }

// // Start recognition when ready
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    window.electronAPI.startRecognition();
  }, 5000);
});