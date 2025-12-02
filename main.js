const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const { whisper } = require('whisper-node');
const OpenAI = require('openai');
const path = require('path');
const fs = require('fs');
const os = require('os');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Import local server
const LocalServer = require('./src/LocalServer.js');

// Import VAD Manager
const VADManager = require('./src/VADManager.js');

// Import centralized logging
const { log: info, error: logError } = require('./src/Logging.js');

// Import IPC constants
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
  IPC_CLEAR_INTERVIEW_DATA
} = require('./src/IPCConstants.js');

// Audio constants (matching src/Constants.js)
const SAMPLE_RATE = 16000;

// Enable hot reloading in development
if (process.env.NODE_ENV !== 'production') {
  try {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
      hardResetMethod: 'exit'
    });
  } catch (err) {
    info('electron-reload not found, running without hot reload');
  }
}

info('process.env.DASHSCOPE_API_KEY: ', process.env.DASHSCOPE_API_KEY)
const llm = new OpenAI({
    apiKey: process.env.DASHSCOPE_API_KEY,
    baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
});

let mainWindow;
let localServer;
let vadManager;

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false
    }
  });

  // Prevent window content from being captured by screen sharing tools
  mainWindow.setContentProtection(true);
  mainWindow.setSkipTaskbar(true);
  mainWindow.setMenuBarVisibility(false);

  mainWindow.loadFile('index.html');

  // Initialize and start the local server
  try {
    localServer = new LocalServer(ipcMain);
    localServer.start(mainWindow).then(() => {
      info('Local server started successfully');
    }).catch((error) => {
      logError('Failed to start local server:', error);
    });
  } catch (error) {
    logError('Error initializing local server:', error);
  }

  // Initialize VAD Manager
  try {
    vadManager = new VADManager();
    info('VAD Manager initialized');
  } catch (error) {
    logError('Error initializing VAD Manager:', error);
  }

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
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Performance Metrics',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => {
            mainWindow.webContents.send(IPC_SHOW_METRICS);
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

ipcMain.handle(IPC_TRANSCRIBE_AUDIO, async (_, audioBuffer) => {
  info('ipc-main: transcribe-audio');
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
    logError('Transcription error:', error);
    return { success: false, error: error.message };
  } finally {
    // Clean up temp file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Stop the local server before quitting
    if (localServer) {
      localServer.stop();
    }
    app.quit();
  }
});

// Stop server when app is quitting
app.on('will-quit', () => {
  if (localServer) {
    localServer.stop();
  }
});

ipcMain.handle(IPC_ANALYZE_CONVERSATION, async (_, conversationBuffer, forceNewAnalysis = false) => {
    info('Received conversationBuffer:', conversationBuffer);
    info('Type:', typeof conversationBuffer);
    info('Force new analysis:', forceNewAnalysis);

    try {
        // Get current interview data from LocalServer
        const interviewData = localServer ? localServer.getCurrentInterviewData() : null;
        const hasInterviewData = interviewData && localServer.hasInterviewData();

        info('Interview data available:', !!hasInterviewData);
        if (hasInterviewData) {
            info('Current interview question:', interviewData.problem?.title || 'Unknown title');
        }

        let prompt = '';

        if (hasInterviewData) {
            // Priority 1: Analyze extracted interview question
            info('🎯 Prioritizing extracted interview metadata for analysis');

            const problemTitle = interviewData.problem?.title || 'Unknown problem';
            const problemDescription = interviewData.problem?.description || 'No description available';

            // Extract code if available
            let codeInfo = 'No code provided';
            if (interviewData.code) {
                const codeData = interviewData.code.monaco || interviewData.code.codemirror || interviewData.code.textarea;
                if (codeData && codeData.content) {
                    codeInfo = `Starting Code:\n${codeData.content}`;
                }
            }

            prompt = `You are a senior technical interviewer helping with a coding problem.

**PRIMARY QUESTION TO ANALYZE:**
Title: ${problemTitle}
Description: ${problemDescription}

${codeInfo !== 'No code provided' ? `**STARTING CODE:**\n${codeInfo}` : ''}

${conversationBuffer && conversationBuffer.trim() ? `**FOLLOW-UP CONTEXT FROM CONVERSATION:**\n${conversationBuffer}` : ''}

**ANALYSIS REQUIREMENTS:**
1. First, provide a detailed solution to the primary question with:
   - Clear explanation of the approach
   - Step-by-step algorithm
   - Time and space complexity analysis
   - Complete, working PYTHON code solution
   - Test cases and edge cases

2. If there's follow-up conversation context, address any additional questions or clarifications mentioned

3. If the conversation contains follow-up questions about the main problem, answer those as well

IMPORTANT: Always provide code solutions in PYTHON, regardless of any starting code language detected.`;

        } else {
            // Fallback: Original conversationBuffer-only analysis
            info('🔄 Using conversationBuffer-only analysis (no extracted interview data)');
            prompt = `Analyze this technical interview conversation. If the last part is a question, provide a detailed solution with PYTHON code examples.\n\nConversation:\n${conversationBuffer}`;
        }

        info('Sending prompt to LLM...');
        const completion = await llm.chat.completions.create({
            model: 'qwen3-max-2025-09-23',
            messages: [{ role: 'user', content: prompt }],
            stream: false
        });

        const response = completion.choices[0].message.content;
        info('LLM analysis completed successfully');

        return {
            success: true,
            response,
            analysisType: hasInterviewData ? 'interview-metadata-priority' : 'conversation-buffer-only'
        };

    } catch (error) {
        logError('LLM error:', error);
        return { success: false, error: error.message };
    }
});

// IPC handlers for local server communication
ipcMain.handle(IPC_GET_SERVER_STATUS, async () => {
    if (localServer) {
        return {
            success: true,
            status: localServer.getStatus()
        };
    } else {
        return {
            success: false,
            error: 'Server not initialized'
        };
    }
});

ipcMain.handle(IPC_RESTART_SERVER, async () => {
    try {
        if (localServer) {
            localServer.stop();
            await localServer.start(mainWindow);
            return { success: true, message: 'Server restarted successfully' };
        } else {
            localServer = new LocalServer(ipcMain);
            await localServer.start(mainWindow);
            return { success: true, message: 'Server started successfully' };
        }
    } catch (error) {
        logError('Error restarting server:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle(IPC_CLEAR_INTERVIEW_DATA, async () => {
  try {
    if (localServer) {
      localServer.clearCurrentInterviewData();
      return { success: true, message: 'Interview data cleared successfully' };
    } else {
      return { success: false, error: 'Local server not available' };
    }
  } catch (error) {
    logError('Error clearing interview data:', error);
    return { success: false, error: error.message };
  }
});

// VAD-related IPC handlers
ipcMain.handle(IPC_PROCESS_VAD, async (_, audioBuffer) => {
  try {
    if (!vadManager) {
      return { success: false, error: 'VAD Manager not initialized' };
    }

    // Convert buffer back to Float32Array
    const audioData = new Float32Array(audioBuffer);
    const result = await vadManager.processAudioChunk(audioData, SAMPLE_RATE);

    return { success: true, result };
  } catch (error) {
    logError('VAD processing error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle(IPC_SHOULD_SKIP_TRANSCRIPTION, async () => {
  try {
    if (!vadManager) {
      return false; // Default to not skipping if VAD not available
    }

    return vadManager.shouldSkipTranscription();
  } catch (error) {
    logError('VAD skip check error:', error);
    return false; // Default to not skipping on error
  }
});

ipcMain.handle(IPC_RESET_VAD, async () => {
  try {
    if (vadManager) {
      vadManager.reset();
    }
    return { success: true };
  } catch (error) {
    logError('VAD reset error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle(IPC_GET_VAD_STATS, async () => {
  try {
    if (!vadManager) {
      return null;
    }
    return vadManager.getStats();
  } catch (error) {
    logError('VAD stats error:', error);
    return null;
  }
});