const OpenAI = require('openai');
const LLMProvider = require('./LLMProvider.js');

class QwenProvider extends LLMProvider {
  constructor(config) {
    super(config);
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
    });
  }

  async analyze(prompt, options = {}) {
    const completion = await this.client.chat.completions.create({
      model: this.config.model || 'qwen3-max-2025-09-23',
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      max_tokens: options.maxTokens || this.config.maxTokens || 4000,
      temperature: options.temperature || this.config.temperature || 0.7
    });

    return completion.choices[0].message.content;
  }
}

module.exports = QwenProvider;