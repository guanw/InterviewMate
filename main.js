const { app, BrowserWindow, ipcMain, Menu, desktopCapturer } = require('electron');
const { whisper } = require('whisper-node');
const OpenAI = require('openai');
const path = require('path');
const fs = require('fs');
const os = require('os');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Enable hot reloading in development
if (process.env.NODE_ENV !== 'production') {
  try {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
      hardResetMethod: 'exit'
    });
  } catch (err) {
    console.log('electron-reload not found, running without hot reload');
  }
}

console.log('process.env.DASHSCOPE_API_KEY: ', process.env.DASHSCOPE_API_KEY)
const llm = new OpenAI({
    apiKey: process.env.DASHSCOPE_API_KEY,
    baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
});

let mainWindow;

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true
    }
  });

  // Prevent window content from being captured by screen sharing tools
  mainWindow.setContentProtection(true);
  mainWindow.setSkipTaskbar(true);
  mainWindow.setMenuBarVisibility(false);

  mainWindow.loadFile('index.html');

  // Create application menu
  const template = [
    // App menu (macOS only)
    ...(process.platform === 'darwin' ? [{
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { label: 'Hide', accelerator: 'Cmd+H', role: 'hide' },
        { label: 'Hide Others', accelerator: 'Cmd+Shift+H', role: 'hideOthers' },
        { label: 'Show All', role: 'unhide' },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'Cmd+Q', role: 'quit' }
      ]
    }] : []),
    {
      label: 'View',
      submenu: [
        {
          label: 'Performance Metrics',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => {
            mainWindow.webContents.send('show-metrics');
          }
        },
        { type: 'separator' },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { label: 'Toggle Developer Tools', accelerator: 'CmdOrCtrl+Shift+I', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Toggle Full Screen', accelerator: process.platform === 'darwin' ? 'Cmd+Ctrl+F' : 'F11', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { label: 'Minimize', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
        { label: 'Close', accelerator: 'CmdOrCtrl+W', role: 'close' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
});

ipcMain.handle('transcribe-audio', async (_, audioBuffer) => {
  console.log('ipc-main: transcribe-audio');
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `whisper_temp_${Date.now()}.wav`);

  try {
    // Write the buffer to a temporary file
    fs.writeFileSync(tempFilePath, audioBuffer);

    // Verify the file is in correct format
    const stats = fs.statSync(tempFilePath);
    if (stats.size === 0) throw new Error('Empty audio file');

    // Transcribe with Whisper
    const result = await whisper(tempFilePath, {
        modelName: "small.en",
        modelDownload: true,
        whisperOptions: {
          language: 'auto',         // default (use 'auto' for auto detect)
          word_timestamps: true     // timestamp for every word
        }
    });

    return { success: true, result };
  } catch (error) {
    console.error('Transcription error:', error);
    return { success: false, error: error.message };
  } finally {
    // Clean up temp file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('client-test', async () => {
    return "hello this is server";
});

ipcMain.handle('analyze-conversation', async (_, { conversationBuffer, visualContext }) => {
    console.log('Received conversationBuffer:', conversationBuffer);
    console.log('Visual context provided:', !!visualContext);
    try {
        let prompt = `Analyze this technical interview conversation. If the last part is a question, provide a detailed solution with code examples if applicable.\n\nConversation:\n${conversationBuffer}`;

        if (visualContext) {
            prompt += `\n\nAdditional Context (from screen capture):\n${visualContext}\n\nPlease consider both the spoken conversation and the visual context when providing your analysis.`;
        }

        const completion = await llm.chat.completions.create({
            model: 'qwen3-max-2025-09-23',
            messages: [{ role: 'user', content: prompt }],
            stream: false
        });
        return { success: true, response: completion.choices[0].message.content };
    } catch (error) {
        console.error('LLM error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('capture-screen', async () => {
    try {
        console.log('Capturing screen...');
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 1920, height: 1080 }
        });

        if (sources.length === 0) {
            throw new Error('No screen sources available');
        }

        // Use the first screen (primary display)
        const primaryScreen = sources[0];
        const thumbnail = primaryScreen.thumbnail;

        // Convert to base64 for transfer to renderer
        const imageData = thumbnail.toPNG();
        const base64Image = imageData.toString('base64');

        return { success: true, imageData: base64Image };
    } catch (error) {
        console.error('Screen capture error:', error);
        return { success: false, error: error.message };
    }
});