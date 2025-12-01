// preload.js
const { contextBridge, ipcRenderer } = require('electron');
const {
  IPC_TRANSCRIBE_AUDIO,
  IPC_ANALYZE_CONVERSATION,
  IPC_PROCESS_VAD,
  IPC_SHOULD_SKIP_TRANSCRIPTION,
  IPC_RESET_VAD,
  IPC_GET_VAD_STATS,
  IPC_GET_SERVER_STATUS,
  IPC_RESTART_SERVER,
  IPC_SHOW_METRICS,
  IPC_INTERVIEW_QUESTION_RECEIVED,
  IPC_CLEAR_INTERVIEW_DATA
} = require('./src/IPCConstants.js');

contextBridge.exposeInMainWorld('electronAPI', {
  transcribeAudio: (audioBuffer) => ipcRenderer.invoke(IPC_TRANSCRIBE_AUDIO, audioBuffer),
  analyzeConversation: (conversationBuffer) => ipcRenderer.invoke(IPC_ANALYZE_CONVERSATION, conversationBuffer),

  // VAD processing
  processVAD: (audioBuffer) => ipcRenderer.invoke(IPC_PROCESS_VAD, audioBuffer),
  shouldSkipTranscription: () => ipcRenderer.invoke(IPC_SHOULD_SKIP_TRANSCRIPTION),
  resetVAD: () => ipcRenderer.invoke(IPC_RESET_VAD),
  getVADStats: () => ipcRenderer.invoke(IPC_GET_VAD_STATS),

  // Server status and control
  getServerStatus: () => ipcRenderer.invoke(IPC_GET_SERVER_STATUS),
  restartServer: () => ipcRenderer.invoke(IPC_RESTART_SERVER),

  // Metrics modal handling
  onShowMetrics: (callback) => {
    ipcRenderer.on(IPC_SHOW_METRICS, callback);
  },
  removeShowMetricsListener: (callback) => {
    ipcRenderer.removeListener(IPC_SHOW_METRICS, callback);
  },

  // Interview question handling
  onInterviewQuestionReceived: (callback) => {
    ipcRenderer.on(IPC_INTERVIEW_QUESTION_RECEIVED, callback);
  },
  removeInterviewQuestionReceivedListener: (callback) => {
    ipcRenderer.removeListener(IPC_INTERVIEW_QUESTION_RECEIVED, callback);
  },

  // Clear interview data
  clearInterviewData: () => ipcRenderer.invoke(IPC_CLEAR_INTERVIEW_DATA)
});