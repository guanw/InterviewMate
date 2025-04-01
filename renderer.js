
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

// renderer.js
// Start recognition when ready
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const recognitionResp = await window.electronAPI.startRecognition();
    console.log(recognitionResp);
  } catch (error) {
    console.error('Recognition error:', error);
  }

  const res = await window.electronAPI.test();
  console.log(res);
});