export class OCRProcessor {
  constructor() {
    this.worker = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Wait for Tesseract to be available globally
      if (typeof Tesseract === 'undefined') {
        throw new Error('Tesseract.js not loaded');
      }

      this.worker = await Tesseract.createWorker('eng');
      this.isInitialized = true;
      console.log('OCR worker initialized');
    } catch (error) {
      console.error('Failed to initialize OCR worker:', error);
      throw error;
    }
  }

  async processImage(imageData) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('Processing image with OCR...');
      const { data: { text } } = await this.worker.recognize(imageData);
      console.log('OCR completed, extracted text length:', text.length);
      return text.trim();
    } catch (error) {
      console.error('OCR processing error:', error);
      throw error;
    }
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }
}