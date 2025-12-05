const QwenProvider = require('./QwenProvider.js');
const GroqProvider = require('./GroqProvider.js');

// Import centralized logging
const { log: info, error: logError } = require('../src/Logging.js');

class LLMManager {
  constructor() {
    this.providers = new Map();
    this.currentProvider = null;
    this.currentProviderKey = null;
    this.config = null;
  }

  /**
   * Initialize the LLM manager with configuration
   */
  initialize(config) {
    this.config = config;
    this._loadProviders();
    this._setDefaultProvider();
  }

  /**
   * Load available providers
   */
  _loadProviders() {
    const { DASHSCOPE_API_KEY, GROQ_API_KEY } = process.env;

    // Qwen provider
    if (DASHSCOPE_API_KEY) {
      this.providers.set('qwen', new QwenProvider({
        apiKey: DASHSCOPE_API_KEY,
        model: this.config?.qwen?.model || 'qwen3-max-2025-09-23',
        maxTokens: this.config?.qwen?.maxTokens || 4000
      }));
      info('✅ Qwen provider loaded');
    } else {
      info('⚠️ Qwen provider not available (no DASHSCOPE_API_KEY)');
    }

    // Groq provider
    if (GROQ_API_KEY) {
      this.providers.set('groq', new GroqProvider({
        apiKey: GROQ_API_KEY,
        model: this.config?.groq?.model || 'qwen/qwen3-32b',
        maxTokens: this.config?.groq?.maxTokens || 6000,
        temperature: this.config?.groq?.temperature || 0.7
      }));
      info('✅ Groq provider loaded');
    } else {
      info('⚠️ Groq provider not available (no GROQ_API_KEY)');
    }
  }

  /**
   * Set the default provider based on configuration or availability
   */
  _setDefaultProvider() {
    const defaultProvider = this.config?.default || 'groq'; // Prefer Groq as requested

    if (this.providers.has(defaultProvider)) {
      this.currentProvider = this.providers.get(defaultProvider);
      this.currentProviderKey = defaultProvider;
      info(`🎯 Default LLM provider set to: ${defaultProvider} (${this.currentProvider.info.model})`);
    } else {
      // Fallback to first available provider
      const firstAvailable = this.providers.keys().next().value;
      if (firstAvailable) {
        this.currentProvider = this.providers.get(firstAvailable);
        this.currentProviderKey = firstAvailable;
        info(`⚠️ Requested provider '${defaultProvider}' not available, using: ${firstAvailable}`);
      } else {
        logError('❌ No LLM providers available!');
      }
    }
  }

  /**
   * Switch to a different provider
   */
  switchProvider(providerName) {
    if (this.providers.has(providerName)) {
      this.currentProvider = this.providers.get(providerName);
      this.currentProviderKey = providerName;
      info(`🔄 Switched to LLM provider: ${providerName} (${this.currentProvider.info.model})`);
      return true;
    } else {
      logError(`❌ Provider '${providerName}' not available`);
      return false;
    }
  }

  /**
   * Get current provider info
   */
  getCurrentProviderInfo() {
    if (!this.currentProvider) return null;

    return {
      ...this.currentProvider.info,
      key: this.currentProviderKey
    };
  }

  /**
   * Get list of available providers
   */
  getAvailableProviders() {
    return Array.from(this.providers.keys());
  }

  /**
   * Analyze text using current provider
   */
  async analyze(prompt, options = {}) {
    if (!this.currentProvider) {
      throw new Error('No LLM provider available');
    }

    try {
      info(`🤖 Analyzing with ${this.currentProvider.name} (${this.currentProvider.info.model})`);
      return await this.currentProvider.analyze(prompt, options);
    } catch (err) {
      logError(`❌ LLM analysis failed with ${this.currentProvider.name}:`, err.message);
      throw err;
    }
  }

  /**
   * Analyze text using a specific provider temporarily
   */
  async analyzeWithProvider(providerName, prompt, options = {}) {
    if (!this.providers.has(providerName)) {
      throw new Error(`Provider '${providerName}' not available`);
    }

    const originalProvider = this.currentProvider;
    const originalProviderKey = this.currentProviderKey;

    try {
      // Temporarily switch provider
      this.currentProvider = this.providers.get(providerName);
      this.currentProviderKey = providerName;

      info(`🔄 Temporarily analyzing with ${providerName} (${this.currentProvider.info.model})`);
      const result = await this.currentProvider.analyze(prompt, options);

      return result;
    } catch (err) {
      logError(`❌ Temporary analysis failed with ${providerName}:`, err.message);
      throw err;
    } finally {
      // Always restore original provider
      this.currentProvider = originalProvider;
      this.currentProviderKey = originalProviderKey;
      info(`🔄 Restored to original provider: ${originalProviderKey}`);
    }
  }
}

// Export singleton instance
const llmManager = new LLMManager();

module.exports = {
  LLMManager,
  llmManager
};