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
 * Compress conversation buffer using Groq to reduce token usage for Qwen API
 * @param {string} conversationBuffer - The conversation text to compress
 * @returns {string} Compressed conversation summary
 */
async function compressConversationBuffer(conversationBuffer) {
    if (!conversationBuffer || conversationBuffer.trim().length === 0) {
        return conversationBuffer;
    }

    try {
        info(`🗜️ Compressing conversation buffer (${conversationBuffer.length} chars) using Groq before sending to Qwen`);

        // If the conversation is already reasonably short, don't compress
        if (conversationBuffer.length < 1000) {
            info('ℹ️ Conversation buffer is already reasonably short, skipping compression');
            return conversationBuffer;
        }

        // Try intelligent compression first
        const compressionPrompt = `Summarize this interview conversation in a much shorter form, keeping only the essential technical content:

${conversationBuffer}

Summary:`;

        const compressed = await llmManager.analyzeWithProvider('groq', compressionPrompt, { temperature: 0.1, maxTokens: 500 });
        const compressedTrimmed = compressed.trim();

        info(`🔍 Compression result: ${conversationBuffer.length} chars → ${compressedTrimmed.length} chars`);

        // If compression actually reduced size significantly, use it
        if (compressedTrimmed.length < conversationBuffer.length * 0.8 && compressedTrimmed.length > 50) {
            const reductionPercent = ((conversationBuffer.length - compressedTrimmed.length) / conversationBuffer.length * 100).toFixed(1);
            info(`✅ Conversation compressed: ${conversationBuffer.length} chars → ${compressedTrimmed.length} chars (${reductionPercent}% reduction)`);
            return compressedTrimmed;
        } else {
            // Fallback: simple truncation approach
            info('⚠️ Intelligent compression failed, using truncation fallback');
            const maxLength = 800;
            if (conversationBuffer.length > maxLength) {
                const truncated = conversationBuffer.substring(0, maxLength) + '...';
                info(`✅ Conversation truncated: ${conversationBuffer.length} chars → ${truncated.length} chars`);
                return truncated;
            }
            return conversationBuffer;
        }

    } catch (error) {
        logError('❌ Conversation compression failed:', error);
        // Fallback to truncation if compression fails
        info('⚠️ Using truncation fallback due to compression failure');
        const maxLength = 800;
        if (conversationBuffer.length > maxLength) {
            const truncated = conversationBuffer.substring(0, maxLength) + '...';
            info(`✅ Conversation truncated: ${conversationBuffer.length} chars → ${truncated.length} chars`);
            return truncated;
        }
        return conversationBuffer;
    }
}

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
    info('Interview data received:', interviewData ? 'present' : 'null');

    try {
        // Get current interview data
        const hasInterviewData = interviewData && interviewData.problem;

        info('hasInterviewData:', hasInterviewData);
        info('interviewData structure:', interviewData ? Object.keys(interviewData) : 'N/A');
        if (hasInterviewData) {
            info('Current interview question:', interviewData.problem?.title || 'Unknown title');
        } else {
            info('No interview data found - will use conversation-buffer-only analysis');
        }

        // Compress conversation buffer if using Qwen provider to reduce token costs
        let processedConversationBuffer = conversationBuffer;
        let compressionInfo = null;
        const currentProvider = llmManager.getCurrentProviderInfo();
        if (currentProvider && currentProvider.key === 'qwen' && conversationBuffer && conversationBuffer.trim()) {
            info('🔄 Qwen provider detected - compressing conversation buffer to reduce token usage');
            const originalLength = conversationBuffer.length;
            const compressedResult = await compressConversationBuffer(conversationBuffer);
            const compressedLength = compressedResult.length;
            const actuallyReduced = compressedLength < originalLength;

            if (actuallyReduced) {
                processedConversationBuffer = compressedResult;
                const isTruncated = compressedResult.endsWith('...');
                const method = isTruncated ? 'truncated' : 'summarized';
                compressionInfo = {
                    performed: true,
                    method,
                    originalChars: originalLength,
                    compressedChars: compressedLength,
                    compressionRatio: ((originalLength - compressedLength) / originalLength * 100).toFixed(1)
                };
                info(`✅ Buffer processed: ${originalLength} → ${compressedLength} chars (${compressionInfo.compressionRatio}% reduction via ${method})`);
            } else {
                // Should not happen with new logic, but fallback
                processedConversationBuffer = conversationBuffer;
                compressionInfo = {
                    performed: false,
                    reason: 'no_reduction_achieved',
                    originalChars: originalLength,
                    attemptedChars: compressedLength
                };
                info(`⚠️ Buffer processing did not reduce size (${originalLength} → ${compressedLength}), using original`);
            }
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

${processedConversationBuffer && processedConversationBuffer.trim() ? `**FOLLOW-UP CONTEXT FROM CONVERSATION:**\n${processedConversationBuffer}` : ''}

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
            prompt = `Analyze this technical interview conversation. If the last part is a question, provide a detailed solution with PYTHON code examples.\n\nConversation:\n${processedConversationBuffer}`;
            cacheKey = processedConversationBuffer || '';
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
                    cacheHit: true,
                    compressionInfo
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
            cacheHit: false,
            compressionInfo
        };

    } catch (error) {
        logError('LLM error:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    analyzeConversation
};