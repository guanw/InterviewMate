const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onIndicatorUpdate: (callback) => {
    ipcRenderer.on('update-indicator', (event, data) => callback(event, data));
  }
});