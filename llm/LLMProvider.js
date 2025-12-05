/**
 * LLM Provider Interface
 * Defines the contract for LLM providers
 */
class LLMProvider {
  constructor(config) {
    this.config = config;
  }

  /**
   * Analyze conversation using this provider
   * @param {string} prompt - The prompt to send to the LLM
   * @param {Object} options - Optional parameters (temperature, maxTokens, etc.)
   * @returns {Promise<string>} The LLM response
   */
  async analyze(prompt, options = {}) {
    throw new Error('analyze method must be implemented by provider');
  }

  /**
   * Get provider name
   */
  get name() {
    return this.constructor.name;
  }

  /**
   * Get provider capabilities/info
   */
  get info() {
    return {
      name: this.name,
      model: this.config.model || 'unknown',
      maxTokens: this.config.maxTokens || 0
    };
  }
}

module.exports = LLMProvider;