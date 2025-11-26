// Centralized logging system for the application
// Allows easy switching between different logging implementations

class Logger {
  constructor() {
    this.logLevel = this.getLogLevel();
    this.externalLogger = null; // Placeholder for external logging service
  }

  // Determine log level from environment or default to 'info'
  getLogLevel() {
    if (typeof process !== 'undefined' && process.env) {
      const level = process.env.LOG_LEVEL || 'info';
      const levels = { error: 0, warn: 1, info: 2, debug: 3 };
      return levels[level] !== undefined ? level : 'info';
    }
    return 'info';
  }

  // Core logging method
  log(level, message, ...args) {
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };

    // Check if we should log this level
    if (levels[level] <= levels[this.logLevel]) {
      // Log to console
      const consoleMethod = level === 'error' ? 'error' :
                           level === 'warn' ? 'warn' :
                           level === 'debug' ? 'debug' : 'log';

      // eslint-disable-next-line no-console
      console[consoleMethod](`[${level.toUpperCase()}]`, message, ...args);

      // Log to external service if configured
      if (this.externalLogger) {
        this.externalLogger.log(level, message, ...args);
      }
    }
  }

  // Convenience methods for different log levels
  debug(message, ...args) {
    this.log('debug', message, ...args);
  }

  info(message, ...args) {
    this.log('info', message, ...args);
  }

  warn(message, ...args) {
    this.log('warn', message, ...args);
  }

  error(message, ...args) {
    this.log('error', message, ...args);
  }

  performance(metric, value, unit = 'ms') {
    this.info(`Performance metric - ${metric}: ${value}${unit}`);
  }
}

// Create singleton instance
const logger = new Logger();

// Create convenience methods
const log = logger.info.bind(logger);
const error = logger.error.bind(logger);
const warn = logger.warn.bind(logger);
const debug = logger.debug.bind(logger);

// ES6 module exports (works in both Node.js and browsers with bundlers)
export { logger, log, error, warn, debug };

// CommonJS exports for backward compatibility
if (typeof module !== 'undefined' && module.exports) {
  // Node.js/CommonJS
  module.exports = { logger, log, error, warn, debug };
} else if (typeof exports !== 'undefined') {
  // CommonJS alternative
  exports.logger = logger;
  exports.log = log;
  exports.error = error;
  exports.warn = warn;
  exports.debug = debug;
} else {
  // Browser globals fallback
  if (typeof window !== 'undefined') {
    window.logger = logger;
    window.log = log;
    window.error = error;
    window.warn = warn;
    window.debug = debug;
  }
}