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
  IPC_CLEAR_INTERVIEW_DATA,
  IPC_GET_CACHE_STATS,
  IPC_CLEAR_CACHE,
  IPC_GET_LLM_PROVIDERS,
  IPC_SWITCH_LLM_PROVIDER,
  IPC_GET_CURRENT_LLM_PROVIDER,
  IPC_MOVE_WINDOW,
  IPC_RANDOMIZE_WINDOW_POSITION,
  IPC_SET_TEST_INTERVIEW_DATA,
  IPC_TRIGGER_START_RECORDING,
  IPC_TRIGGER_STOP_RECORDING,
  IPC_UPDATE_INDICATOR,
  IPC_TRIGGER_ANALYZE_CONVERSATION,
  IPC_SCROLL_LLM_UP,
  IPC_SCROLL_LLM_DOWN,
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
  clearInterviewData: () => ipcRenderer.invoke(IPC_CLEAR_INTERVIEW_DATA),

  // Set test interview data (for testing purposes)
  setTestInterviewData: (testData) => ipcRenderer.invoke(IPC_SET_TEST_INTERVIEW_DATA, testData),

  // Cache management
  getCacheStats: () => ipcRenderer.invoke(IPC_GET_CACHE_STATS),
  clearCache: () => ipcRenderer.invoke(IPC_CLEAR_CACHE),

  // LLM Provider management
  getLLMProviders: () => ipcRenderer.invoke(IPC_GET_LLM_PROVIDERS),
  switchLLMProvider: (providerName) => ipcRenderer.invoke(IPC_SWITCH_LLM_PROVIDER, providerName),
  getCurrentLLMProvider: () => ipcRenderer.invoke(IPC_GET_CURRENT_LLM_PROVIDER),

  // Window movement
  moveWindow: (direction) => ipcRenderer.invoke(IPC_MOVE_WINDOW, direction),
  randomizeWindowPosition: () => ipcRenderer.invoke(IPC_RANDOMIZE_WINDOW_POSITION),

  // Global shortcut triggers
  onTriggerStartRecording: (callback) => {
    ipcRenderer.on(IPC_TRIGGER_START_RECORDING, callback);
  },
  removeTriggerStartRecordingListener: (callback) => {
    ipcRenderer.removeListener(IPC_TRIGGER_START_RECORDING, callback);
  },
  onTriggerStopRecording: (callback) => {
    ipcRenderer.on(IPC_TRIGGER_STOP_RECORDING, callback);
  },
  removeTriggerStopRecordingListener: (callback) => {
    ipcRenderer.removeListener(IPC_TRIGGER_STOP_RECORDING, callback);
  },

  // Indicator window controls
  updateIndicator: (data) => ipcRenderer.send(IPC_UPDATE_INDICATOR, data),
  onIndicatorUpdate: (callback) => {
    ipcRenderer.on(IPC_UPDATE_INDICATOR, (event, data) => callback(event, data));
  },
  removeIndicatorUpdateListener: (callback) => {
    ipcRenderer.removeListener(IPC_UPDATE_INDICATOR, callback);
  },

  // Global shortcut trigger for analyze conversation
  onTriggerAnalyzeConversation: (callback) => {
    ipcRenderer.on(IPC_TRIGGER_ANALYZE_CONVERSATION, callback);
  },
  removeTriggerAnalyzeConversationListener: (callback) => {
    ipcRenderer.removeListener(IPC_TRIGGER_ANALYZE_CONVERSATION, callback);
  },

  // LLM response scrolling shortcuts
  onScrollLlmUp: (callback) => {
    ipcRenderer.on(IPC_SCROLL_LLM_UP, callback);
  },
  removeScrollLlmUpListener: (callback) => {
    ipcRenderer.removeListener(IPC_SCROLL_LLM_UP, callback);
  },

  onScrollLlmDown: (callback) => {
    ipcRenderer.on(IPC_SCROLL_LLM_DOWN, callback);
  },
  removeScrollLlmDownListener: (callback) => {
    ipcRenderer.removeListener(IPC_SCROLL_LLM_DOWN, callback);
  }
});