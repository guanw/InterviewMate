// Audio Configuration Constants
export const SAMPLE_RATE = 16000;
export const CHANNELS = 1;
export const BIT_DEPTH = 16;
export const PAUSE_DELAY = 4000; // 4 seconds, configurable
export const MAX_LENGTH = 50000; // keep last 50000 characters
export const FILLER_WORDS = [
    'um', 'uh', 'ah', 'er', 'hmm', 'mhm', 'uh-huh', 'uh huh',
    'like', 'you know', 'so', 'well', 'okay', 'yeah', 'yes', 'no',
    'huh', 'oh', 'wow', 'hey', 'hi', 'bye', 'thanks', 'thank you',
    'please', 'sorry', 'excuse me', 'pardon'
];