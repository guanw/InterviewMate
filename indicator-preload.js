const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onIndicatorUpdate: (callback) => {
    ipcRenderer.on('update-indicator', (event, data) => callback(event, data));
  },
  onScrollLlmUp: (callback) => {
    ipcRenderer.on('scroll-llm-up', callback);
  },
  removeScrollLlmUpListener: (callback) => {
    ipcRenderer.removeListener('scroll-llm-up', callback);
  },
  onScrollLlmDown: (callback) => {
    ipcRenderer.on('scroll-llm-down', callback);
  },
  removeScrollLlmDownListener: (callback) => {
    ipcRenderer.removeListener('scroll-llm-down', callback);
  },
  sendToMain: (channel, data) => {
    ipcRenderer.send(channel, data);
  }
});