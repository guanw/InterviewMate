/**
 * LLM Processing Module
 * Handles conversation analysis using modular LLM providers with caching
 */

const { responseCache } = require('../ResponseCache.js');
const { llmManager } = require('./LLMManager.js');
const llmConfig = require('./config.js');

// Import centralized logging
const { log: info, error: logError } = require('../src/Logging.js');

// Initialize LLM manager with configuration
llmManager.initialize(llmConfig);

/**
 * Analyze conversation using LLM with caching
 * @param {string} conversationBuffer - The conversation text to analyze
 * @param {Object} interviewData - Optional interview question data
 * @param {boolean} forceNewAnalysis - Whether to bypass cache
 * @returns {Object} Analysis result
 */
async function analyzeConversation(conversationBuffer, interviewData = null, forceNewAnalysis = false) {
    info('Received conversationBuffer:', conversationBuffer);
    info('Type:', typeof conversationBuffer);
    info('Force new analysis:', forceNewAnalysis);

    try {
        // Get current interview data
        const hasInterviewData = interviewData && interviewData.problem;

        info('Interview data available:', !!hasInterviewData);
        if (hasInterviewData) {
            info('Current interview question:', interviewData.problem?.title || 'Unknown title');
        }

        let prompt = '';
        let cacheKey = '';

        if (hasInterviewData) {
            // Priority 1: Analyze extracted interview question
            info('🎯 Prioritizing extracted interview metadata for analysis');

            const problemTitle = interviewData.problem?.title || 'Unknown problem';
            const problemDescription = interviewData.problem?.description || 'No description available';

            // Extract code if available
            let codeInfo = 'No code provided';
            if (interviewData.code) {
                const codeData = interviewData.code.monaco || interviewData.code.codemirror || interviewData.code.textarea;
                if (codeData && codeData.content) {
                    codeInfo = `Starting Code:\n${codeData.content}`;
                }
            }

            prompt = `You are a senior technical interviewer helping with a coding problem.

**PRIMARY QUESTION TO ANALYZE:**
Title: ${problemTitle}
Description: ${problemDescription}

${codeInfo !== 'No code provided' ? `**STARTING CODE:**\n${codeInfo}` : ''}

${conversationBuffer && conversationBuffer.trim() ? `**FOLLOW-UP CONTEXT FROM CONVERSATION:**\n${conversationBuffer}` : ''}

**ANALYSIS REQUIREMENTS:**
1. First, provide a detailed solution to the primary question with:
   - Clear explanation of the approach
   - Step-by-step algorithm
   - Time and space complexity analysis
   - Complete, working PYTHON code solution
   - Test cases and edge cases

2. If there's follow-up conversation context, address any additional questions or clarifications mentioned

3. If the conversation contains follow-up questions about the main problem, answer those as well

IMPORTANT: Always provide code solutions in PYTHON, regardless of any starting code language detected.`;

            // Create cache key from the question content
            cacheKey = `${problemTitle}\n${problemDescription}\n${codeInfo}`;

        } else {
            // Fallback: Original conversationBuffer-only analysis
            info('🔄 Using conversationBuffer-only analysis (no extracted interview data)');
            prompt = `Analyze this technical interview conversation. If the last part is a question, provide a detailed solution with PYTHON code examples.\n\nConversation:\n${conversationBuffer}`;
            cacheKey = conversationBuffer || '';
        }

        // Check cache first (unless force new analysis is requested)
        if (!forceNewAnalysis) {
            const cachedResult = responseCache.findSimilar(cacheKey);
            if (cachedResult) {
                info('✅ Cache hit! Returning cached analysis');
                return {
                    success: true,
                    response: cachedResult.response,
                    analysisType: hasInterviewData ? 'interview-metadata-priority' : 'conversation-buffer-only',
                    cached: true,
                    cacheHit: true
                };
            }
        }

        info('Cache miss or forced analysis, sending prompt to LLM...');
        const response = await llmManager.analyze(prompt);
        info('LLM analysis completed successfully');

        // Cache the result
        responseCache.store(cacheKey, response, {
            analysisType: hasInterviewData ? 'interview-metadata-priority' : 'conversation-buffer-only',
            hasInterviewData,
            promptLength: prompt.length
        });

        return {
            success: true,
            response,
            analysisType: hasInterviewData ? 'interview-metadata-priority' : 'conversation-buffer-only',
            cached: false,
            cacheHit: false
        };

    } catch (error) {
        logError('LLM error:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    analyzeConversation
};