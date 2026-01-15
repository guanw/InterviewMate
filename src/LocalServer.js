const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { createWorker } = require("tesseract.js");
const { log } = require("./Logging.js");
const { IPC_INTERVIEW_QUESTION_RECEIVED } = require("./IPCConstants.js");

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
      log("Server is already running");
      return;
    }

    this.mainWindow = mainWindow;

    try {
      // Create Express app
      this.app = express();

      // Middleware
      this.app.use(cors());
      this.app.use(express.json({ limit: "50mb" }));

      // Health check endpoint
      this.app.get("/api/health", (req, res) => {
        res.json({
          status: "healthy",
          timestamp: new Date().toISOString(),
          message: "Interview Extractor Server (Electron) is running",
        });
      });

      // OCR extraction endpoint - receives screenshot for OCR processing
      this.app.post("/api/extract-ocr", (req, res) => {
        this.handleOCRData(req.body);
        res.json({
          success: true,
          message: "OCR data received and processing started",
          processedAt: new Date().toISOString(),
        });
      });

      // Start HTTP server
      this.server = this.app.listen(this.PORT, () => {
        log(`🚀 Interview Extractor Server running on port ${this.PORT}`);
        log(`📊 Health check: http://localhost:${this.PORT}/api/health`);
        log(
          `📥 Data endpoint: http://localhost:${this.PORT}/api/interview-question-data`,
        );
        log("Waiting for data from Chrome extension...\n");
        this.isRunning = true;
      });
    } catch (error) {
      log("Error starting server:", error);
      throw error;
    }
  }

  async handleOCRData(data) {
    try {
      log("\n=== OCR Data Received ===");
      log("Timestamp:", data.timestamp);
      log("Extension ID:", data.extensionId);
      log("URL:", data.url);

      // Decode base64 image
      const base64Data = data.image.replace(/^data:image\/png;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      log("Image buffer size:", buffer.length, "bytes");

      // Perform OCR
      log("🔄 Starting OCR processing...");
      const worker = await createWorker("eng");
      const {
        data: { text },
      } = await worker.recognize(buffer);
      await worker.terminate();

      log("✅ OCR processing completed");
      log("OCR Text length:", text.length, "characters");
      log(
        "OCR Text Extracted (first 200 chars):",
        text.substring(0, 200) + (text.length > 200 ? "..." : ""),
      );

      // Store the OCR data in memory for analysis
      this.currentInterviewData = {
        text,
        url: data.url,
        receivedAt: data.timestamp,
        extensionId: data.extensionId,
      };

      log("\n💾 OCR data stored in memory for analysis");
      log("🎯 New OCR text available for LLM analysis");

      // Process the data (save to file)
      this.processOCRData({ text, url: data.url });

      // Send to renderer via IPC
      if (this.mainWindow) {
        log("📤 Sending IPC event to renderer: ocr-question-received");
        this.mainWindow.webContents.send(IPC_INTERVIEW_QUESTION_RECEIVED, {
          type: "ocr-question",
          timestamp: data.timestamp,
          extensionId: data.extensionId,
          data: { text, url: data.url },
        });
        log("✅ IPC event sent successfully");
      } else {
        log("❌ Main window not available for IPC");
      }
    } catch (error) {
      log("❌ Error processing OCR data:", error);
      console.error("OCR Error details:", error);
    }
  }

  processOCRData(data) {
    try {
      // Save OCR data to file
      const filename = `ocr-data-${Date.now()}.json`;
      const dataDir = path.join(__dirname, "..", "extracted-data");

      // Create data directory if it doesn't exist
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      fs.writeFileSync(
        path.join(dataDir, filename),
        JSON.stringify(data, null, 2),
      );
      log(`📁 OCR data saved to: ${path.join(dataDir, filename)}`);
    } catch (error) {
      log("Error saving OCR data:", error);
    }
  }

  stop() {
    if (this.server) {
      this.server.close(() => {
        log("Server closed");
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
      },
    };
  }

  // Get current interview data for analysis
  getCurrentInterviewData() {
    return this.currentInterviewData;
  }

  // Clear current interview data (when user extracts new question)
  clearCurrentInterviewData() {
    log("🧹 Clearing current interview data from memory");
    this.currentInterviewData = null;
  }

  // Check if interview data is available
  hasInterviewData() {
    return this.currentInterviewData !== null;
  }
}

module.exports = LocalServer;
