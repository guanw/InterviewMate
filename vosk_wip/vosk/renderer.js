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