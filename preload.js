// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startRecognition: () => ipcRenderer.invoke('start-recognition'),
//   onSpeechRecognized: (callback) => ipcRenderer.on('speech-recognized', callback),
//   onSpeechStart: (callback) => ipcRenderer.on('speech-start', callback),
//   onSpeechEnd: (callback) => ipcRenderer.on('speech-end', callback)
});