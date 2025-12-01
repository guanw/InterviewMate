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
  IPC_CLEAR_INTERVIEW_DATA
};