// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  test: () => ipcRenderer.invoke('client-test'),
  transcribeAudio: (audioBuffer) => ipcRenderer.invoke('transcribe-audio', audioBuffer),
  analyzeConversation: (conversationBuffer) => ipcRenderer.invoke('analyze-conversation', conversationBuffer),

  // Metrics modal handling
  onShowMetrics: (callback) => {
    ipcRenderer.on('show-metrics', callback);
  },
  removeShowMetricsListener: (callback) => {
    ipcRenderer.removeListener('show-metrics', callback);
  }
});