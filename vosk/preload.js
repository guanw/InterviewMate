// preload.js
const { contextBridge, ipcRenderer } = require('electron');
const { Recognizer } = require('electron-vosk-speech')

contextBridge.exposeInMainWorld('electronAPI', {
    startRecognition: () => {
        recognizer = new Recognizer({
            ipcRenderer,
            onSpeechStart: () => console.log('voice_start'),
            onSpeechEnd: () => console.log('voice_stop'),
            onSpeechRecognized: (res) => console.log('recognized: ', res),
            onStartRecognize: () => console.log('onRecognizeStart'),
            onAllStart: () => console.log('onAllStart'),
            onAllStop: () => console.log('onAllStop'),
            options: {
              languageCode: 'en',
              save: false,
              idleDelay: 60000,
            }
          });
          recognizer.startAll();
          return ipcRenderer.invoke('start-recognition');
      },
});

