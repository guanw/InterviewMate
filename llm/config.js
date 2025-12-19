/**
 * LLM Configuration
 * Defines settings for different LLM providers
 */

const llmConfig = {
  // Default provider to use
  default: 'groq', // Changed from 'qwen' to 'groq' as requested

  // Provider-specific configurations
  qwen: {
    model: 'qwen3-max-2025-09-23',
    maxTokens: 4000,
    temperature: 0.7
  },

  groq: {
    model: 'qwen/qwen3-32b', // Qwen 32B model on Groq
    maxTokens: 20000, // Groq has higher limits
    temperature: 0.7
  }
};

module.exports = llmConfig;