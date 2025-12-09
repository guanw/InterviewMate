import React from 'react';
import { SAMPLE_RATE, CHANNELS, BIT_DEPTH, MAX_LENGTH, FILLER_WORDS } from './Constants.js';
import { AudioManager } from './AudioManager.js';
import { TranscriptEntry } from './TranscriptEntry.js';
import { MetricsManager } from './MetricsManager.js';
import { MetricsDisplay } from './MetricsDisplay.js';
import { SearchBox } from './SearchBox.js';
import { SearchProvider, useSearch } from './SearchContext.js';
// VAD import will be handled in main process due to Electron renderer limitations

import { log, error } from './Logging.js';

// Convenience aliases for renderer process
const logError = error;
const info = log;

const { useState, useEffect, useRef } = React;

// Constants
const DEFAULT_ANALYSIS_MESSAGE = 'No analysis yet';


// Helper functions
function mergeFloat32Arrays(arrays) {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Float32Array(totalLength);
  let offset = 0;
  arrays.forEach(arr => {
    result.set(arr, offset);
    offset += arr.length;
  });
  return result;
}

function convertToWav(input, sampleRate, channels, bitDepth) {
  info("start: convertToWav");
  const bytesPerSample = bitDepth / 8;
  const blockAlign = channels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + input.length * bytesPerSample);
  const view = new DataView(buffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + input.length * bytesPerSample, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, input.length * bytesPerSample, true);
  const scale = Math.pow(2, bitDepth - 1);
  for (let i = 0; i < input.length; i++) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    const intSample = sample < 0 ? sample * scale : sample * (scale - 1);
    view.setInt16(44 + (i * 2), intSample, true);
  }
  info("end: convertToWav");
  return new Uint8Array(buffer);
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function App() {
  // UI state variables (trigger re-renders)
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [transcripts, setTranscripts] = useState([]);
  const [llmResponse, setLlmResponse] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [metricsSummary, setMetricsSummary] = useState(null);
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null); // Track extracted interview question
  const [analysisType, setAnalysisType] = useState(null); // Track what type of analysis was performed
  const [cacheStats, setCacheStats] = useState(null); // Cache statistics
  const [lastAnalysisCached, setLastAnalysisCached] = useState(false); // Track if last analysis was from cache
  const [llmProviders, setLLMProviders] = useState(null); // Available LLM providers
  const [currentLLMProvider, setCurrentLLMProvider] = useState(null); // Current LLM provider
  const [compressionInfo, setCompressionInfo] = useState(null); // Compression information

  // Refs for synchronous access in callbacks and audio management
  const conversationBufferRef = useRef(''); // Mirrors conversationBuffer state
  const transcriptScrollRef = useRef(null); // Scroll container ref
  const audioManagerRef = useRef(new AudioManager()); // Encapsulates audio-related state
  const metricsManagerRef = useRef(new MetricsManager()); // Performance metrics tracking


  const performLLMAnalysis = async (buffer) => {
    setIsAnalyzing(true);
    try {
      const llmStart = performance.now();
      const result = await window.electronAPI.analyzeConversation(buffer);
      const llmEnd = performance.now();

      // Track cache hit status
      setLastAnalysisCached(result.cached || false);

      if (result.success) {
        setLlmResponse(result.response);
        setAnalysisType(result.analysisType);
        setCompressionInfo(result.compressionInfo);

        // Update cache stats after analysis
        await updateCacheStats();

        // Only track metrics for actual LLM calls (not cache hits)
        if (!result.cached) {
          metricsManagerRef.current.trackLLMAnalysis(llmStart, llmEnd, buffer.length);
        }
      } else {
        logError('LLM error:', result.error);
        setLlmResponse(`Error: ${result.error}`);
        setAnalysisType(null);
      }
    } catch (err) {
      logError('LLM call failed:', err);
      setLlmResponse('Failed to analyze conversation');
    }
    setIsAnalyzing(false);
  };

  const handleManualAnalysis = async () => {
    const currentBuffer = conversationBufferRef.current;
    info('🎯 Manual analysis button clicked');
    info('Current buffer length:', currentBuffer ? currentBuffer.length : 0);
    info('Current question available:', !!currentQuestion);

    if (currentQuestion) {
      // If we have a question, analyze based on question + conversation (if any)
      const analysisText = currentBuffer && currentBuffer.trim()
        ? `${currentQuestion.title}\n${currentQuestion.description}\n\nConversation: ${currentBuffer}`
        : `${currentQuestion.title}\n${currentQuestion.description}`;

      info('✅ Starting analysis with question:', currentQuestion.title);
      await performLLMAnalysis(analysisText);
    } else if (currentBuffer && currentBuffer.trim()) {
      // Fallback to conversation-only analysis
      info('✅ Starting analysis with conversation buffer');
      await performLLMAnalysis(currentBuffer);
    } else {
      info('⚠️ No content to analyze');
      setLlmResponse('No question or conversation to analyze. Extract a question from the Chrome extension or start speaking.');
    }
  };

  // Audio State (now using refs)

  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = 0; // Scroll to top for latest conversation
    }
  }, [transcripts]);

  // Update metrics summary periodically
  useEffect(() => {
    const updateMetrics = () => {
      setMetricsSummary(metricsManagerRef.current.getMetricsSummary());
    };

    // Update immediately and then every 2 seconds
    updateMetrics();
    const interval = setInterval(updateMetrics, 2000);
    return () => clearInterval(interval);
  }, []);

  // Initialize cache stats and LLM providers
  useEffect(() => {
    updateCacheStats();
    loadLLMProviders();
  }, []);

  // Function to clear metrics
  const clearMetrics = () => {
    metricsManagerRef.current.clearMetrics();
    setMetricsSummary(null);
  };

  // Function to manually clear conversation buffer
  const clearConversationBuffer = () => {
    info('🧹 User manually clearing conversation buffer (keeping current question)');
    conversationBufferRef.current = '';
    setLlmResponse('Conversation buffer cleared. Ready for follow-up questions.');
    setAnalysisType(null);
    setCompressionInfo(null);
  };

  // Cache management functions
  const updateCacheStats = async () => {
    try {
      const stats = await window.electronAPI.getCacheStats();
      setCacheStats(stats);
    } catch (error) {
      logError('Error getting cache stats:', error);
    }
  };

  const clearCache = async () => {
    try {
      const result = await window.electronAPI.clearCache();
      if (result.success) {
        info(`Cache cleared: removed ${result.removedCount} entries`);
        await updateCacheStats();
      } else {
        logError('Error clearing cache:', result.error);
      }
    } catch (error) {
      logError('Error clearing cache:', error);
    }
  };

  // LLM Provider management functions
  const loadLLMProviders = async () => {
    try {
      const providers = await window.electronAPI.getLLMProviders();
      setLLMProviders(providers);
      setCurrentLLMProvider(providers.current);
    } catch (error) {
      logError('Error loading LLM providers:', error);
    }
  };

  const switchLLMProvider = async (providerName) => {
    try {
      const result = await window.electronAPI.switchLLMProvider(providerName);
      if (result.success) {
        setCurrentLLMProvider(result.current);
        // Also update the providers list to reflect the change
        setLLMProviders(prev => prev ? { ...prev, current: result.current } : null);
        info(`Switched to LLM provider: ${providerName} (${result.current?.model})`);
      } else {
        logError('Error switching LLM provider:', result.error);
      }
    } catch (error) {
      logError('Error switching LLM provider:', error);
    }
  };

  // Update indicator window with current recording state
  const updateIndicatorState = async () => {
    try {
      await window.electronAPI.updateIndicator({ isRecording });
    } catch (error) {
      logError('Error updating indicator:', error);
    }
  };

  // Search functionality - now handled by SearchBox component via context
  const { searchMatches, currentMatchIndex } = useSearch();

  // Helper function to render text with highlights
  const renderHighlightedText = (text) => {
    if (searchMatches.length === 0) {
      return text;
    }

    const elements = [];
    let lastIndex = 0;

    searchMatches.forEach((match, index) => {
      // Add text before match
      if (match.start > lastIndex) {
        elements.push(text.substring(lastIndex, match.start));
      }

      // Add highlighted match
      const isCurrent = index === currentMatchIndex;
      elements.push(
        React.createElement('mark', {
          key: `highlight-${index}`,
          className: isCurrent ? 'search-highlight current' : 'search-highlight'
        }, match.text)
      );

      lastIndex = match.end;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      elements.push(text.substring(lastIndex));
    }

    return elements;
  };

  const startRecording = async () => {
    info("start: startRecording");
    try {
      setStatus('Initializing microphone...');

      // Reset VAD for new recording session
      try {
        await window.electronAPI.resetVAD();
        info("✅ VAD reset for new recording session");
      } catch (error) {
        info("⚠️ VAD reset failed, continuing anyway:", error.message);
      }

      // Start metrics tracking session
      metricsManagerRef.current.startRecordingSession();

      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });

      // Resume audio context if suspended (required by some browsers)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);

      // Load and create AudioWorklet
      await audioContext.audioWorklet.addModule('src/AudioWorkletProcessor.js');
      const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');

      // Handle messages from AudioWorklet
      workletNode.port.onmessage = (event) => {
        const { type, data } = event.data;
        if (type === 'audioData') {
          // Process audio chunks from worklet
          const combined = mergeFloat32Arrays(data.map(arr => new Float32Array(arr)));
          audioManagerRef.current.setAudioChunks([combined]);
          processAudioChunk();
        }
      };

      analyser.connect(workletNode);
      workletNode.connect(audioContext.destination);

      audioManagerRef.current.setAudioContext(audioContext);
      audioManagerRef.current.setAnalyser(analyser);
      audioManagerRef.current.setMicrophone(microphone);
      audioManagerRef.current.setWorkletNode(workletNode);
      audioManagerRef.current.clearAudioChunks();
      audioManagerRef.current.setIsRecording(true);

      // Start the worklet
      workletNode.port.postMessage({ type: 'start' });

      setIsRecording(true);
      setStatus('Recording...');
      // Update indicator if visible
      updateIndicatorState();
    } catch (error) {
      logError("Audio error:", error);
      setStatus(`Error: ${error.message}`);
    }
    info("end: startRecording");
  };

  const stopRecording = () => {
    if (!isRecording) return;
    info("Stopping recording...");
    audioManagerRef.current.setIsRecording(false);
    setIsRecording(false);
    setStatus('Stopping...');

    // Stop AudioWorklet
    const workletNode = audioManagerRef.current.getWorkletNode();
    if (workletNode) {
      workletNode.port.postMessage({ type: 'stop' });
      workletNode.disconnect();
    }

    // Disconnect audio nodes
    const microphone = audioManagerRef.current.getMicrophone();
    if (microphone) microphone.disconnect();
    const analyser = audioManagerRef.current.getAnalyser();
    if (analyser) analyser.disconnect();
    const audioContext = audioManagerRef.current.getAudioContext();
    if (audioContext) audioContext.close();

    // Clear any audio chunks
    audioManagerRef.current.clearAudioChunks();
    setStatus('Ready');
    // Update indicator if visible
    updateIndicatorState();
  };

  const processAudioChunk = async () => {
    info("start: processAudioChunk");
    const audioProcessingStart = performance.now();

    // Don't process if recording has been stopped
    if (!audioManagerRef.current.getIsRecording()) {
      info("Recording stopped, skipping audio chunk processing");
      return;
    }
    const chunks = audioManagerRef.current.getAudioChunks();
    if (chunks.length === 0) return;
    const combined = mergeFloat32Arrays(chunks);
    audioManagerRef.current.clearAudioChunks(); // Reset even if error

    // Process VAD to determine if we should transcribe
    try {
      const vadResult = await window.electronAPI.processVAD(combined.buffer.slice());
      info(`VAD: ${vadResult.success ? 'processed' : 'failed'}`);

      // Check if we should skip transcription based on VAD
      const shouldSkip = await window.electronAPI.shouldSkipTranscription();
      if (shouldSkip) {
        info("🎤 VAD: Skipping transcription - low speech activity detected");
        return; // Skip transcription entirely
      }
    } catch (error) {
      info("⚠️ VAD processing failed, proceeding with transcription anyway:", error.message);
      // Continue with transcription if VAD fails
    }

    const wavBuffer = convertToWav(combined, SAMPLE_RATE, CHANNELS, BIT_DEPTH);

    const audioProcessingEnd = performance.now();
    metricsManagerRef.current.trackAudioProcessing(audioProcessingStart, audioProcessingEnd, wavBuffer.length);

    try {
      setStatus('Sending to Whisper...');
      const transcriptionStart = performance.now();
      const { success, result, error } = await window.electronAPI.transcribeAudio(wavBuffer);
      const transcriptionEnd = performance.now();
      metricsManagerRef.current.trackTranscription(transcriptionStart, transcriptionEnd, wavBuffer.length);
      if (success) {
        const segments = Array.isArray(result) ? result : [];

        // Filter segments for both UI display and conversation buffer - unified approach
        const meaningfulSegments = [];
        const noiseSegments = [];

        segments.forEach(segment => {
          const speech = segment.speech?.trim();
          if (!speech) {
            noiseSegments.push({ ...segment, filterReason: 'empty' });
            return;
          }

          // Check if segment contains any bracketed or parenthesized content
          const hasBrackets = speech.includes('[') || speech.includes(']');
          const hasParentheses = speech.includes('(') || speech.includes(')');

          let cleanedSpeech = speech;
          let filterReason = null;

          if (hasBrackets || hasParentheses) {
            // Remove content within brackets/parentheses for display, but filter out the segment entirely
            cleanedSpeech = speech.replace(/\[[^\]]*\]/g, '').trim();
            cleanedSpeech = cleanedSpeech.replace(/\([^)]*\)/g, '').trim();
            filterReason = 'contains_annotations';
          }

          // Apply unified filtering logic (same for UI and LLM buffer)
          const speechLower = speech.toLowerCase();

          if (!filterReason) {
            if (speechLower.includes('blank audio') ||
                speechLower.includes('blank_audio') ||
                speechLower === 'blank audio' ||
                speechLower === 'blank_audio' ||
                speechLower.includes('inaudible') ||
                speechLower === '[inaudible]' ||
                speechLower === '(inaudible)' ||
                (speechLower.includes('blank') && speechLower.includes('audio')) ||
                speechLower.includes('[blank') ||
                speechLower.includes('blank]')) {
              filterReason = 'whisper_artifact';
            } else if (FILLER_WORDS.some(filler => speechLower === filler)) {
              filterReason = 'filler_word';
            } else if (speech.length < 2) {
              filterReason = 'too_short';
            }
          }

          if (filterReason) {
            noiseSegments.push({ ...segment, filterReason, cleanedSpeech: speech }); // Show original for noise
          } else {
            // Keep everything else for both UI and conversation buffer
            meaningfulSegments.push({ ...segment, cleanedSpeech });
          }
        });

        // Create transcript entry with unified filtering
        const newEntry = {
          segments: meaningfulSegments,
          noiseSegments,
          timestamp: new Date(),
          totalSegments: segments.length,
          meaningfulCount: meaningfulSegments.length,
          noiseCount: noiseSegments.length
        };
        setTranscripts(prev => [newEntry, ...prev]);

        // Use meaningfulSegments directly for conversation buffer (no separate filtering)
        const filteredSegments = meaningfulSegments;

        // Only proceed if we have meaningful segments
        if (filteredSegments.length > 0) {
          const newText = filteredSegments.map(s => s.cleanedSpeech).join(' ');
          const maxLength = MAX_LENGTH;
          const currentBuffer = conversationBufferRef.current;
          const updated = currentBuffer + (currentBuffer ? ' ' : '') + newText;
          const final = updated.length > maxLength ? updated.slice(-maxLength) : updated;
          conversationBufferRef.current = final;
          info(`✅ Added ${newText.length} chars from ${filteredSegments.length} filtered segments (annotations removed)`);
        } else {
          info('🚫 Filtered out all segments - no meaningful speech detected');
        }
        if (audioManagerRef.current.getIsRecording()) {
          setStatus('Recording...');
        }
        info("success: processAudioChunk");
      } else {
        logError("error: processAudioChunk --", error);
        throw new Error(error);
      }
    } catch (error) {
      logError("Transcription error: processAudioChunk --", error);
      setStatus(`Transcription Error: ${error.message}`);
    }
  };

  // Keyboard event listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Allow search input to handle its own events
      if (e.target.tagName === 'INPUT' && e.target.classList.contains('search-input')) return;

      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Cmd/Ctrl + F to toggle search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        if (window.toggleSearchBox) {
          window.toggleSearchBox();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen for menu events from main process
  useEffect(() => {
    const handleShowMetrics = () => setShowMetricsModal(true);
    window.electronAPI?.onShowMetrics?.(handleShowMetrics);

    return () => {
      window.electronAPI?.removeShowMetricsListener?.(handleShowMetrics);
    };
  }, []);

  // Listen for global shortcut events from main process
  useEffect(() => {
    const handleTriggerStartRecording = () => {
      info('Received global shortcut: Start Recording');
      if (!isRecording) {
        startRecording();
      }
    };

    const handleTriggerStopRecording = () => {
      info('Received global shortcut: Stop Recording');
      if (isRecording) {
        stopRecording();
      }
    };

    // Set up listeners (these would need to be added to preload.js first)
    // For now, we'll handle them directly if the API exists
    if (window.electronAPI?.onTriggerStartRecording) {
      window.electronAPI.onTriggerStartRecording(handleTriggerStartRecording);
    }
    if (window.electronAPI?.onTriggerStopRecording) {
      window.electronAPI.onTriggerStopRecording(handleTriggerStopRecording);
    }

    return () => {
      if (window.electronAPI?.removeTriggerStartRecordingListener) {
        window.electronAPI.removeTriggerStartRecordingListener(handleTriggerStartRecording);
      }
      if (window.electronAPI?.removeTriggerStopRecordingListener) {
        window.electronAPI.removeTriggerStopRecordingListener(handleTriggerStopRecording);
      }
    };
  }, [isRecording]);

  // Listen for interview question data from extension
  useEffect(() => {
    info('🔧 Setting up interview question listener...');

    const handleInterviewQuestionReceived = (event, data) => {
      info('📥 EVENT FIRED: Received interview question data from extension:', data);
      info('📥 Event type:', event.type);
      info('📥 Data structure:', Object.keys(data || {}));

      if (data?.data?.problem) {
        setCurrentQuestion(data.data.problem);
        info('🎯 New question available for analysis:', data.data.problem.title);
      } else {
        info('⚠️ No problem data found in received payload');
        info('📋 Full data structure:', JSON.stringify(data, null, 2));
      }
    };

    // Verify the API exists before setting up listener
    if (window.electronAPI?.onInterviewQuestionReceived) {
      info('✅ Interview question API found, setting up listener...');
      window.electronAPI.onInterviewQuestionReceived(handleInterviewQuestionReceived);
      info('✅ Interview question listener setup complete');
    } else {
      info('❌ Interview question API not available!');
    }

    // Cleanup function - this runs on unmount
    return () => {
      info('🧹 Cleaning up interview question listener...');
      if (window.electronAPI?.removeInterviewQuestionReceivedListener) {
        window.electronAPI.removeInterviewQuestionReceivedListener(handleInterviewQuestionReceived);
      }
    };
  }, []); // Empty array is correct here - we only want to set up the listener once

  return React.createElement('div', null,
    React.createElement('div', { className: 'top-row' },
      React.createElement('div', { className: 'control-panel' },
        React.createElement('button', { onClick: startRecording, disabled: isRecording, className: isRecording ? 'start-btn disabled' : 'start-btn' }, 'Start Recording'),
        React.createElement('button', { onClick: stopRecording, disabled: !isRecording, className: 'stop-btn' }, 'Stop Recording'),

        // Manual Analysis Button (always available)
        React.createElement('button', {
          onClick: handleManualAnalysis,
          disabled: isAnalyzing || (!currentQuestion && !conversationBufferRef.current?.trim()),
          className: 'analyze-btn'
        }, isAnalyzing ? '🔄 Analyzing...' : '🧠 Analyze Conversation'),

        React.createElement('div', { className: 'status' }, status),

        React.createElement('button', {
          onClick: clearConversationBuffer,
          disabled: isAnalyzing,
          className: 'clear-btn'
        }, '🧹 Clear Conversation'),
        React.createElement('div', { className: 'buffer-display' }, `Buffer: ${conversationBufferRef.current.length} chars`),

        // Cache status and controls
        cacheStats && React.createElement('div', { className: 'cache-status' },
          React.createElement('span', null, `Cache: ${cacheStats.size}/${cacheStats.maxSize}`),
          lastAnalysisCached && React.createElement('span', { className: 'cache-hit-indicator' }, '⚡ Cached'),
          React.createElement('button', {
            onClick: clearCache,
            className: 'clear-cache-btn',
            title: 'Clear analysis cache'
          }, '🗑️')
        ),

        // LLM Provider selector
        currentLLMProvider && React.createElement('div', { className: 'llm-provider-selector' },
          React.createElement('span', null, `LLM: ${currentLLMProvider.key || currentLLMProvider.name.toLowerCase().replace('provider', '')} (${currentLLMProvider.model})`),
          llmProviders && llmProviders.available.length > 1 && React.createElement('select', {
            value: currentLLMProvider.key || currentLLMProvider.name.toLowerCase().replace('provider', ''),
            onChange: (e) => switchLLMProvider(e.target.value),
            className: 'llm-provider-select'
          },
            llmProviders.available.map(provider =>
              React.createElement('option', { key: provider, value: provider },
                provider.charAt(0).toUpperCase() + provider.slice(1)
              )
            )
          )
        ),

        // Test button for interview data
        React.createElement('button', {
          onClick: async () => {
            // Simulate receiving interview data for testing
            const testData = {
              type: 'interview-question-question',
              timestamp: new Date().toISOString(),
              extensionId: 'test-extension',
              data: {
                problem: {
                  title: 'Two Sum',
                  description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.'
                }
              }
            };
            info('🧪 Test: Setting test interview data...');

            try {
              // Use the new IPC method to set test data in LocalServer
              const result = await window.electronAPI.setTestInterviewData(testData);
              if (result.success) {
                info('🎯 Test: Interview data set successfully in both frontend and backend');
              } else {
                logError('Error setting test data:', result.error);
              }
            } catch (error) {
              logError('Error setting test interview data:', error);
            }
          },
          className: 'test-btn'
        }, '🧪 Test Question'),
      ),
      React.createElement('div', { className: 'llm-container' },
        React.createElement('h2', null, 'AI Analysis'),
        // Current question info or guidance
        currentQuestion ? React.createElement('div', { className: 'current-question' },
          React.createElement('div', null,
            React.createElement('strong', null, '📋 Current Question: '),
            React.createElement('span', null, currentQuestion.title || 'Unknown title'),
          ),
          React.createElement('button', {
            onClick: async () => {
              try {
                await window.electronAPI.clearInterviewData();
                setCurrentQuestion(null);
                info('🧹 Current question cleared by user');
              } catch (error) {
                logError('Error clearing interview data:', error);
              }
            },
            className: 'clear-question-btn'
          }, 'Clear')
        ) : conversationBufferRef.current && conversationBufferRef.current.trim() && React.createElement('div', { className: 'tip-message' },
          React.createElement('strong', null, '💡 Tip: '),
          'Extract a question from the Chrome extension to get priority analysis. ',
          React.createElement('span', { className: 'tip-span' },
            'Current analysis is based on conversation only.'
          )
        ),
        // Analysis type indicator
        analysisType && React.createElement('div', { className: 'analysis-type' },
          analysisType === 'interview-metadata-priority' ?
            '🎯 Analysis based on extracted interview question + conversation context' :
            '💬 Analysis based on conversation only'
        ),
        // Compression info indicator
        compressionInfo && React.createElement('div', { className: 'compression-info' },
          compressionInfo.performed
            ? `🗜️ Conversation ${compressionInfo.method}: ${compressionInfo.originalChars} → ${compressionInfo.compressedChars} chars (${compressionInfo.compressionRatio}% reduction)`
            : `🗜️ Processing skipped: ${compressionInfo.reason}`
        ),
        isAnalyzing ? React.createElement('p', null, 'Analyzing conversation...') : React.createElement('div', { className: 'llm-response' }, renderHighlightedText(llmResponse || DEFAULT_ANALYSIS_MESSAGE))
      )
    ),
    React.createElement('div', { className: 'transcript-container' },
      React.createElement('h2', null, 'Transcription Results'),
      React.createElement('div', { ref: transcriptScrollRef, style: { height: '500px', overflowY: 'auto' } },
        transcripts.map((entry, idx) => React.createElement(TranscriptEntry, { key: idx, entry }))
      )
    ),
    React.createElement(SearchBox, {
      textToSearch: llmResponse || DEFAULT_ANALYSIS_MESSAGE,
      onClose: () => {} // SearchBox handles its own closing
    }),
    // Metrics Modal
    showMetricsModal && React.createElement('div', { className: 'modal-overlay', onClick: () => setShowMetricsModal(false) },
      React.createElement('div', { className: 'modal-content', onClick: (e) => e.stopPropagation() },
        React.createElement('div', { className: 'modal-header' },
          React.createElement('h2', null, 'Performance Metrics'),
          React.createElement('button', { className: 'modal-close', onClick: () => setShowMetricsModal(false) }, '×')
        ),
        React.createElement('div', { className: 'modal-body' },
          React.createElement(MetricsDisplay, { metrics: metricsSummary, onClearMetrics: clearMetrics })
        )
      )
    )
  );
}

// Wrapper component with SearchProvider
function AppWithSearchProvider() {
  return React.createElement(SearchProvider, null,
    React.createElement(App, null)
  );
}

export { AppWithSearchProvider as App };