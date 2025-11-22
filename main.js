const { app, BrowserWindow, ipcMain } = require('electron');
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

ipcMain.handle('analyze-conversation', async (_, conversationBuffer) => {
    console.log('Received conversationBuffer:', conversationBuffer);
    console.log('Type:', typeof conversationBuffer);
    try {
        const prompt = `Analyze this technical interview conversation. If the last part is a question, provide a detailed solution with code examples if applicable.\n\nConversation:\n${conversationBuffer}`;
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