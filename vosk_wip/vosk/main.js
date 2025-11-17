

// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { VoskConnector } = require('electron-vosk-speech/src/utils');

let mainWindow;
let vosk;

function createWindow() {
  console.log('Creating window...');
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: true,
    },
  });

  console.log('loading index.html...')
  mainWindow.loadFile('index.html');

  console.log('start the vosk server...')
  // Initialize Vosk Connector
  vosk = new VoskConnector({
    autostart: true,
    sudo: 0,
    docker: {
      image: 'alphacep/kaldi-en',
      version: 'latest',
      port: '2700',
    },
  });

  vosk.init(mainWindow.webContents, (ws) => {
    console.log('Vosk server is ready');

    mainWindow.webContents.session.on('will-download', function voskSpeechSaver(...rest){
		vosk.speechSaverHandler(app.getAppPath(), ws, ...rest)
	})
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle speech recognition requests
ipcMain.handle('start-recognition', () => {
    return 'server starting recognition';
});

ipcMain.handle('client-test', async () => {
    return "hello this is server";
});


// Example of handling speech recognition events
ipcMain.on('speech-recognized', (event, result) => {
    // Handle the recognition result
    console.log('recognized: ', result);
});