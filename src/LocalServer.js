const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { log } = require('./Logging.js');
const { IPC_INTERVIEW_QUESTION_RECEIVED } = require('./IPCConstants.js');

class LocalServer {
  constructor(ipcMain) {
    this.ipcMain = ipcMain;
    this.app = null;
    this.server = null;
    this.wss = null;
    this.mainWindow = null;
    this.isRunning = false;
    this.PORT = 8080;
    this.currentInterviewData = null; // Store current extracted interview metadata
  }

  async start(mainWindow) {
    if (this.isRunning) {
      log('Server is already running');
      return;
    }

    this.mainWindow = mainWindow;

    try {
      // Create Express app
      this.app = express();

      // Middleware
      this.app.use(cors());
      this.app.use(express.json());

      // Health check endpoint
      this.app.get('/api/health', (req, res) => {
        res.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          message: 'Interview Extractor Server (Electron) is running'
        });
      });

      // Main data endpoint - receives extracted Interview content
      this.app.post('/api/interview-question-data', (req, res) => {
        this.handleInterviewData(req.body);
        res.json({
          success: true,
          message: 'Data received successfully',
          processedAt: new Date().toISOString()
        });
      });

      // Start HTTP server
      this.server = this.app.listen(this.PORT, () => {
        log(`🚀 Interview Extractor Server running on port ${this.PORT}`);
        log(`📊 Health check: http://localhost:${this.PORT}/api/health`);
        log(`📥 Data endpoint: http://localhost:${this.PORT}/api/interview-question-data`);
        log('Waiting for data from Chrome extension...\n');
        this.isRunning = true;
      });

    } catch (error) {
      error('Error starting server:', error);
      throw error;
    }
  }

  handleInterviewData(data) {
    try {
      log('\n=== Interview Data Received ===');
      log('Timestamp:', data.timestamp);
      log('Extension ID:', data.extensionId);
      log('URL:', data.data?.url);

      // Store the interview data in memory for analysis
      this.currentInterviewData = {
        ...data.data,
        receivedAt: data.timestamp,
        extensionId: data.extensionId
      };

      if (data.data?.problem) {
        log('\n--- Problem Information ---');
        log('Title:', data.data.problem.title);
      }

      if (data.data?.code) {
        log('\n--- Code Information ---');
        log('Code Type:', data.data.code.monaco ? 'Monaco' :
                                        data.data.code.codemirror ? 'CodeMirror' :
                                        data.data.code.textarea ? 'Textarea' : 'None');

        const codeData = data.data.code.monaco || data.data.code.codemirror || data.data.code.textarea || {};
        log('Content:', codeData.content ?
            `${codeData.content.substring(0, 100)}...` : 'No content');
        log('Language:', codeData.language || 'unknown');
      }

      log('\n💾 Interview data stored in memory for analysis');
      log('🎯 New question available for analysis via conversationBuffer');

      // Process the data (save to file)
      this.processExtractedData(data.data);

      // Send to renderer via IPC
      if (this.mainWindow) {
        log('📤 Sending IPC event to renderer: interview-question-received');
        this.mainWindow.webContents.send(IPC_INTERVIEW_QUESTION_RECEIVED, {
          type: 'interview-question-question',
          timestamp: data.timestamp,
          extensionId: data.extensionId,
          data: data.data
        });
        log('✅ IPC event sent successfully');
      } else {
        log('❌ Main window not available for IPC');
      }

    } catch (error) {
      error('Error processing Interview data:', error);
    }
  }

  processExtractedData(data) {
    try {
      // Save data to file for demonstration
      const filename = `interview-question-data-${Date.now()}.json`;
      const dataDir = path.join(__dirname, '..', 'extracted-data');

      // Create data directory if it doesn't exist
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(data, null, 2));
      log(`📁 Data saved to: ${path.join(dataDir, filename)}`);

    } catch (error) {
      error('Error saving data:', error);
    }
  }

  stop() {
    if (this.server) {
      this.server.close(() => {
        log('Server closed');
        this.isRunning = false;
      });
    }
  }

  // Get server status for IPC communication
  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.PORT,
      endpoints: {
        health: `http://localhost:${this.PORT}/api/health`,
        data: `http://localhost:${this.PORT}/api/interview-question-data`,
      }
    };
  }

  // Get current interview data for analysis
  getCurrentInterviewData() {
    return this.currentInterviewData;
  }

  // Clear current interview data (when user extracts new question)
  clearCurrentInterviewData() {
    log('🧹 Clearing current interview data from memory');
    this.currentInterviewData = null;
  }

  // Check if interview data is available
  hasInterviewData() {
    return this.currentInterviewData !== null;
  }
}

module.exports = LocalServer;
