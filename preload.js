// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  transcribeAudio: (audioBuffer) => ipcRenderer.invoke('transcribe-audio', audioBuffer),
  analyzeConversation: (conversationBuffer) => ipcRenderer.invoke('analyze-conversation', conversationBuffer),

  // Server status and control
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
  restartServer: () => ipcRenderer.invoke('restart-server'),

  // Metrics modal handling
  onShowMetrics: (callback) => {
    ipcRenderer.on('show-metrics', callback);
  },
  removeShowMetricsListener: (callback) => {
    ipcRenderer.removeListener('show-metrics', callback);
  },

  // Interview question handling
  onInterviewQuestionReceived: (callback) => {
    ipcRenderer.on('interview-question-received', callback);
  },
  removeInterviewQuestionReceivedListener: (callback) => {
    ipcRenderer.removeListener('interview-question-received', callback);
  },

  // Clear interview data
  clearInterviewData: () => ipcRenderer.invoke('clear-interview-data')
});