// ES6 exports (for React/frontend)
export const SAMPLE_RATE = 16000;
export const CHANNELS = 1;
export const BIT_DEPTH = 16;
export const MAX_LENGTH = 50000; // keep last 50000 characters
export const FILLER_WORDS = [
    // Only the most obvious verbal fillers - be very restrictive to avoid filtering meaningful words
    'um', 'uh', 'ah', 'er', 'hmm', 'mhm', 'uh-huh', 'uh huh'
];

// CommonJS exports (for Electron main process)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SAMPLE_RATE,
        CHANNELS,
        BIT_DEPTH,
        MAX_LENGTH,
        FILLER_WORDS
    };
}