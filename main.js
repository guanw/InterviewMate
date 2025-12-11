const { app, BrowserWindow, ipcMain, Menu, globalShortcut, screen } = require('electron');
console.log('Electron app imported:', typeof app, app ? 'defined' : 'undefined');

const { whisper } = require('whisper-node');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { responseCache } = require('./ResponseCache.js');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Import local server
const LocalServer = require('./src/LocalServer.js');

// Import VAD Manager
const VADManager = require('./src/VADManager.js');

// Import centralized logging
const { log: info, error: logError } = require('./src/Logging.js');

// Import LLM processing
const { analyzeConversation } = require('./llm/LLM.js');
const { llmManager } = require('./llm/LLMManager.js');

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
  IPC_TRIGGER_ANALYZE_CONVERSATION
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

// Create the floating indicator window
function createIndicatorWindow() {
  if (indicatorWindow && !indicatorWindow.isDestroyed()) {
    return; // Already exists
  }

  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;

  indicatorWindow = new BrowserWindow({
    width: 220,
    height: 120,
    x: width - 230, // Top-right corner with some margin
    y: 40,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: true, // Make focusable for debugging
    show: false, // Start hidden
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true, // Enable DevTools
      preload: path.join(__dirname, 'indicator-preload.js')
    }
  });

  indicatorWindow.loadFile('indicator.html');

  // Hide from taskbar and alt-tab
  indicatorWindow.setSkipTaskbar(true);
  indicatorWindow.setAlwaysOnTop(true, 'floating');

  indicatorWindow.on('ready-to-show', () => {
    // Show by default
    indicatorWindow.show();

    // Auto-open DevTools in development mode
    if (process.env.NODE_ENV === 'development') {
      setTimeout(() => {
        indicatorWindow.webContents.openDevTools();
      }, 1000); // Give it time to load
    }

    // Add keyboard shortcut to open DevTools on indicator window
    // Use Cmd+Option+U (Mac) or Ctrl+Shift+U (Windows/Linux)
    indicatorWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'u' && (input.control || input.meta) && input.alt) {
        indicatorWindow.webContents.openDevTools();
        event.preventDefault();
      }
    });
  });

  indicatorWindow.on('closed', () => {
    indicatorWindow = null;
  });
}

// LLM processing is now handled in LLM.js

let mainWindow;
let indicatorWindow;
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

  // Create indicator window
  createIndicatorWindow();

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

  // Register global shortcuts for window movement
  const registerWindowShortcuts = () => {
    // Movement step size (pixels)
    const MOVE_STEP = 50;

    // Get screen bounds for bounds checking
    const getScreenBounds = () => {
      const primaryDisplay = screen.getPrimaryDisplay();
      return primaryDisplay.workArea; // Use work area to avoid taskbar/dock
    };

    // Move window function with bounds checking
    const moveWindow = (deltaX, deltaY) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;

      const [currentX, currentY] = mainWindow.getPosition();
      const screenBounds = getScreenBounds();
      const [width, height] = mainWindow.getSize();

      // Calculate new position
      let newX = currentX + deltaX;
      let newY = currentY + deltaY;

      // Keep window within screen bounds
      newX = Math.max(screenBounds.x, Math.min(newX, screenBounds.x + screenBounds.width - width));
      newY = Math.max(screenBounds.y, Math.min(newY, screenBounds.y + screenBounds.height - height));

      mainWindow.setPosition(newX, newY);
    };

    // Register movement shortcuts
    globalShortcut.register('CmdOrCtrl+Up', () => moveWindow(0, -MOVE_STEP));
    globalShortcut.register('CmdOrCtrl+Down', () => moveWindow(0, MOVE_STEP));
    globalShortcut.register('CmdOrCtrl+Left', () => moveWindow(-MOVE_STEP, 0));
    globalShortcut.register('CmdOrCtrl+Right', () => moveWindow(MOVE_STEP, 0));

    // Register random positioning shortcut
    globalShortcut.register('CmdOrCtrl+M', () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;

      const screenBounds = screen.getPrimaryDisplay().workArea;
      const [width, height] = mainWindow.getSize();

      // Calculate available area (accounting for window size)
      const availableWidth = screenBounds.width - width;
      const availableHeight = screenBounds.height - height;

      // Generate random position within bounds for main window
      const randomX = screenBounds.x + Math.floor(Math.random() * availableWidth);
      const randomY = screenBounds.y + Math.floor(Math.random() * availableHeight);

      mainWindow.setPosition(randomX, randomY);
      info(`Main window randomized via shortcut to position: (${randomX}, ${randomY})`);

      // Also randomize indicator window position to one of three top positions
      if (indicatorWindow && !indicatorWindow.isDestroyed()) {
        const indicatorWidth = 220; // Width of indicator window

        // Choose one of three positions: left, center, right at the top
        const positions = [
          { x: screenBounds.x + 10, y: screenBounds.y + 40, name: 'left-top' }, // Left top
          { x: screenBounds.x + Math.floor((screenBounds.width - indicatorWidth) / 2), y: screenBounds.y + 40, name: 'center-top' }, // Center top
          { x: screenBounds.x + screenBounds.width - indicatorWidth - 10, y: screenBounds.y + 40, name: 'right-top' } // Right top
        ];

        const randomPosition = positions[Math.floor(Math.random() * positions.length)];
        indicatorWindow.setPosition(randomPosition.x, randomPosition.y);
        info(`Indicator window moved to ${randomPosition.name} position: (${randomPosition.x}, ${randomPosition.y})`);
      }
    });

    // Register recording shortcuts
    globalShortcut.register('CmdOrCtrl+Shift+S', () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      info('Global shortcut: Start Recording triggered');
      mainWindow.webContents.send(IPC_TRIGGER_START_RECORDING);
    });

    globalShortcut.register('CmdOrCtrl+Shift+X', () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      info('Global shortcut: Stop Recording triggered');
      mainWindow.webContents.send(IPC_TRIGGER_STOP_RECORDING);
    });

    info('Window movement shortcuts registered: Cmd/Ctrl + Arrow Keys, Cmd/Ctrl + M (randomize)');
    info('Recording shortcuts registered: Cmd/Ctrl + Shift + S (start), Cmd/Ctrl + Shift + X (stop)');

    // Register global shortcut for analyze conversation
    globalShortcut.register('CmdOrCtrl+Shift+/', () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      info('Global shortcut: Analyze Conversation triggered');
      mainWindow.webContents.send(IPC_TRIGGER_ANALYZE_CONVERSATION);
    });
    info('Analyze conversation shortcut registered: Cmd/Ctrl + Shift + /');

    // Register global shortcut to open DevTools on indicator window
    globalShortcut.register('CmdOrCtrl+Shift+U', () => {
      if (indicatorWindow && !indicatorWindow.isDestroyed()) {
        info('Opening DevTools on indicator window');
        indicatorWindow.webContents.openDevTools();
      } else {
        info('Indicator window not available for DevTools');
      }
    });
    info('DevTools shortcut registered: Cmd/Ctrl + Shift + U (for indicator window)');
  };

  // Register the shortcuts
  registerWindowShortcuts();
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
  // Unregister global shortcuts
  globalShortcut.unregisterAll();

  if (localServer) {
    localServer.stop();
  }
});

ipcMain.handle(IPC_ANALYZE_CONVERSATION, async (_, conversationBuffer, forceNewAnalysis = false) => {
    // Get current interview data from LocalServer
    const interviewData = localServer ? localServer.getCurrentInterviewData() : null;

    // Delegate to LLM processing module
    return await analyzeConversation(conversationBuffer, interviewData, forceNewAnalysis);
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

ipcMain.handle(IPC_SET_TEST_INTERVIEW_DATA, async (_, testData) => {
  try {
    if (localServer) {
      // Simulate the LocalServer receiving data like it would from the Chrome extension
      localServer.handleInterviewData(testData);
      return { success: true, message: 'Test interview data set successfully' };
    } else {
      return { success: false, error: 'Local server not available' };
    }
  } catch (error) {
    logError('Error setting test interview data:', error);
    return { success: false, error: error.message };
  }
});


// Handle indicator updates - use ipcMain.on for event-based communication
ipcMain.on(IPC_UPDATE_INDICATOR, (event, data) => {
  try {
    console.log('🔴 [MAIN] Received indicator update:', data); // Debug log
    if (indicatorWindow && !indicatorWindow.isDestroyed()) {
      console.log('📤 [MAIN] Forwarding to indicator window'); // Debug log
      // Send the IPC message to the indicator window
      indicatorWindow.webContents.send(IPC_UPDATE_INDICATOR, data);
    } else {
      console.log('❌ [MAIN] Indicator window not available'); // Debug log
    }
  } catch (error) {
    console.error('❌ [MAIN] Error updating indicator:', error); // Debug log
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

// Cache management IPC handlers
ipcMain.handle(IPC_GET_CACHE_STATS, async () => {
  try {
    return responseCache.getStats();
  } catch (error) {
    logError('Cache stats error:', error);
    return { error: error.message };
  }
});

ipcMain.handle(IPC_CLEAR_CACHE, async () => {
  try {
    const statsBefore = responseCache.getStats();
    responseCache.clear();
    info(`Cache cleared: removed ${statsBefore.size} entries`);
    return { success: true, removedCount: statsBefore.size };
  } catch (error) {
    logError('Cache clear error:', error);
    return { success: false, error: error.message };
  }
});

// LLM Provider management IPC handlers
ipcMain.handle(IPC_GET_LLM_PROVIDERS, async () => {
  try {
    return {
      available: llmManager.getAvailableProviders(),
      current: llmManager.getCurrentProviderInfo()
    };
  } catch (error) {
    logError('Get LLM providers error:', error);
    return { error: error.message };
  }
});

ipcMain.handle(IPC_SWITCH_LLM_PROVIDER, async (_, providerName) => {
  try {
    const success = llmManager.switchProvider(providerName);
    return {
      success,
      current: success ? llmManager.getCurrentProviderInfo() : null
    };
  } catch (error) {
    logError('Switch LLM provider error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle(IPC_GET_CURRENT_LLM_PROVIDER, async () => {
  try {
    return llmManager.getCurrentProviderInfo();
  } catch (error) {
    logError('Get current LLM provider error:', error);
    return { error: error.message };
  }
});

// Window movement IPC handlers
ipcMain.handle(IPC_MOVE_WINDOW, async (_, direction) => {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { success: false, error: 'Window not available' };
    }

    const MOVE_STEP = 50;
    const screenBounds = screen.getPrimaryDisplay().workArea;
    const [currentX, currentY] = mainWindow.getPosition();
    const [width, height] = mainWindow.getSize();

    let deltaX = 0, deltaY = 0;

    switch (direction) {
      case 'up':
        deltaY = -MOVE_STEP;
        break;
      case 'down':
        deltaY = MOVE_STEP;
        break;
      case 'left':
        deltaX = -MOVE_STEP;
        break;
      case 'right':
        deltaX = MOVE_STEP;
        break;
      default:
        return { success: false, error: 'Invalid direction' };
    }

    // Calculate new position with bounds checking
    let newX = currentX + deltaX;
    let newY = currentY + deltaY;

    // Keep window within screen bounds
    newX = Math.max(screenBounds.x, Math.min(newX, screenBounds.x + screenBounds.width - width));
    newY = Math.max(screenBounds.y, Math.min(newY, screenBounds.y + screenBounds.height - height));

    mainWindow.setPosition(newX, newY);
    return { success: true, position: { x: newX, y: newY } };
  } catch (error) {
    logError('Move window error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle(IPC_RANDOMIZE_WINDOW_POSITION, async () => {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { success: false, error: 'Window not available' };
    }

    const screenBounds = screen.getPrimaryDisplay().workArea;
    const [width, height] = mainWindow.getSize();

    // Calculate available area (accounting for window size)
    const availableWidth = screenBounds.width - width;
    const availableHeight = screenBounds.height - height;

    // Generate random position within bounds
    const randomX = screenBounds.x + Math.floor(Math.random() * availableWidth);
    const randomY = screenBounds.y + Math.floor(Math.random() * availableHeight);

    mainWindow.setPosition(randomX, randomY);
    info(`Window randomized to position: (${randomX}, ${randomY})`);
    return { success: true, position: { x: randomX, y: randomY } };
  } catch (error) {
    logError('Randomize window position error:', error);
    return { success: false, error: error.message };
  }
});