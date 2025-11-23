const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

class LocalServer {
  constructor(ipcMain) {
    this.ipcMain = ipcMain;
    this.app = null;
    this.server = null;
    this.wss = null;
    this.mainWindow = null;
    this.isRunning = false;
    this.PORT = 8080;
  }

  async start(mainWindow) {
    if (this.isRunning) {
      console.log('Server is already running');
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
        console.log(`🚀 Interview Extractor Server running on port ${this.PORT}`);
        console.log(`📊 Health check: http://localhost:${this.PORT}/api/health`);
        console.log(`📥 Data endpoint: http://localhost:${this.PORT}/api/interview-question-data`);
        console.log(`⚙️  Config: http://localhost:${this.PORT}/api/config`);
        console.log('Waiting for data from Chrome extension...\n');
        this.isRunning = true;
      });

    } catch (error) {
      console.error('Error starting server:', error);
      throw error;
    }
  }

  handleInterviewData(data) {
    try {
      console.log('\n=== Interview Data Received ===');
      console.log('Timestamp:', data.timestamp);
      console.log('Extension ID:', data.extensionId);
      console.log('URL:', data.data?.url);

      if (data.data?.problem) {
        console.log('\n--- Problem Information ---');
        console.log('Title:', data.data.problem.title);
        console.log('Difficulty:', data.data.problem.difficulty);
        console.log('Tags:', data.data.problem.tags);
      }

      if (data.data?.code) {
        console.log('\n--- Code Information ---');
        console.log('Code Type:', data.data.code.monaco ? 'Monaco' :
                                        data.data.code.codemirror ? 'CodeMirror' :
                                        data.data.code.textarea ? 'Textarea' : 'None');

        const codeData = data.data.code.monaco || data.data.code.codemirror || data.data.code.textarea || {};
        console.log('Content:', codeData.content ?
            `${codeData.content.substring(0, 100)}...` : 'No content');
        console.log('Language:', codeData.language || 'unknown');
      }

      // Process the data
      this.processExtractedData(data.data);

      // Send to renderer via IPC
      if (this.mainWindow) {
        this.mainWindow.webContents.send('interview-question-received', {
          type: 'interview-question-question',
          timestamp: data.timestamp,
          extensionId: data.extensionId,
          data: data.data
        });
      }

    } catch (error) {
      console.error('Error processing Interview data:', error);
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
      console.log(`📁 Data saved to: ${path.join(dataDir, filename)}`);

    } catch (error) {
      console.error('Error saving data:', error);
    }
  }

  stop() {
    if (this.server) {
      this.server.close(() => {
        console.log('Server closed');
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
        config: `http://localhost:${this.PORT}/api/config`
      }
    };
  }
}

module.exports = LocalServer;
