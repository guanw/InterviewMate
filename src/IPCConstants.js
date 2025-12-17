// IPC Channel Constants
// Shared between main process (main.js) and renderer process (preload.js)

const IPC_TRANSCRIBE_AUDIO = 'transcribe-audio';
const IPC_ANALYZE_CONVERSATION = 'analyze-conversation';
const IPC_PROCESS_VAD = 'process-vad';
const IPC_SHOULD_SKIP_TRANSCRIPTION = 'should-skip-transcription';
const IPC_RESET_VAD = 'reset-vad';
const IPC_GET_VAD_STATS = 'get-vad-stats';
const IPC_GET_SERVER_STATUS = 'get-server-status';
const IPC_RESTART_SERVER = 'restart-server';
const IPC_SHOW_METRICS = 'show-metrics';
const IPC_INTERVIEW_QUESTION_RECEIVED = 'interview-question-received';
const IPC_CLEAR_INTERVIEW_DATA = 'clear-interview-data';
const IPC_GET_CACHE_STATS = 'get-cache-stats';
const IPC_CLEAR_CACHE = 'clear-cache';
const IPC_GET_LLM_PROVIDERS = 'get-llm-providers';
const IPC_SWITCH_LLM_PROVIDER = 'switch-llm-provider';
const IPC_GET_CURRENT_LLM_PROVIDER = 'get-current-llm-provider';
const IPC_MOVE_WINDOW = 'move-window';
const IPC_RANDOMIZE_WINDOW_POSITION = 'randomize-window-position';
const IPC_SET_TEST_INTERVIEW_DATA = 'set-test-interview-data';
const IPC_TRIGGER_START_RECORDING = 'trigger-start-recording';
const IPC_TRIGGER_STOP_RECORDING = 'trigger-stop-recording';
const IPC_UPDATE_INDICATOR = 'update-indicator';
const IPC_TRIGGER_ANALYZE_CONVERSATION = 'trigger-analyze-conversation';
const IPC_SCROLL_LLM_UP = 'scroll-llm-up';
const IPC_SCROLL_LLM_DOWN = 'scroll-llm-down';

module.exports = {
  IPC_TRANSCRIBE_AUDIO,
  IPC_ANALYZE_CONVERSATION,
  IPC_PROCESS_VAD,
  IPC_SHOULD_SKIP_TRANSCRIPTION,
  IPC_RESET_VAD,
  IPC_GET_VAD_STATS,
  IPC_GET_SERVER_STATUS,
  IPC_RESTART_SERVER,
  IPC_SHOW_METRICS,
  IPC_INTERVIEW_QUESTION_RECEIVED,
  IPC_CLEAR_INTERVIEW_DATA,
  IPC_GET_CACHE_STATS,
  IPC_CLEAR_CACHE,
  IPC_GET_LLM_PROVIDERS,
  IPC_SWITCH_LLM_PROVIDER,
  IPC_GET_CURRENT_LLM_PROVIDER,
  IPC_MOVE_WINDOW,
  IPC_RANDOMIZE_WINDOW_POSITION,
  IPC_SET_TEST_INTERVIEW_DATA,
  IPC_TRIGGER_START_RECORDING,
  IPC_TRIGGER_STOP_RECORDING,
  IPC_UPDATE_INDICATOR,
  IPC_TRIGGER_ANALYZE_CONVERSATION,
  IPC_SCROLL_LLM_UP,
  IPC_SCROLL_LLM_DOWN
};