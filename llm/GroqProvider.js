const LLMProvider = require('./LLMProvider.js');

class GroqProvider extends LLMProvider {
  constructor(config) {
    super(config);
    // Groq uses OpenAI-compatible API
    const OpenAI = require('openai');
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://api.groq.com/openai/v1'
    });
  }

  async analyze(prompt, options = {}) {
    const completion = await this.client.chat.completions.create({
      model: this.config.model || 'qwen/qwen3-32b',
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      max_tokens: options.maxTokens || this.config.maxTokens || 6000, // Groq has higher limits
      temperature: options.temperature !== undefined ? options.temperature : (this.config.temperature || 0.7)
    });

    return completion.choices[0].message.content;
  }
}

module.exports = GroqProvider;