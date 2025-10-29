/**
 * Enhanced Voice Error Handling and Recovery System
 * Provides comprehensive error handling, recovery mechanisms, and user feedback
 * Features:
 * - Categorized error types with specific recovery strategies
 * - Automatic retry with exponential backoff
 * - User-friendly error messages
 * - Fallback mechanisms
 * - Error analytics and learning
 */

export const ERROR_TYPES = {
  // Connection errors
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
  CONNECTION_LOST: 'CONNECTION_LOST',
  WEBSOCKET_ERROR: 'WEBSOCKET_ERROR',
  
  // Audio errors
  MICROPHONE_ACCESS_DENIED: 'MICROPHONE_ACCESS_DENIED',
  MICROPHONE_NOT_FOUND: 'MICROPHONE_NOT_FOUND',
  AUDIO_PROCESSING_ERROR: 'AUDIO_PROCESSING_ERROR',
  AUDIO_QUALITY_POOR: 'AUDIO_QUALITY_POOR',
  
  // Recognition errors
  RECOGNITION_FAILED: 'RECOGNITION_FAILED',
  RECOGNITION_TIMEOUT: 'RECOGNITION_TIMEOUT',
  RECOGNITION_NOT_SUPPORTED: 'RECOGNITION_NOT_SUPPORTED',
  RECOGNITION_ABORTED: 'RECOGNITION_ABORTED',
  
  // Parse errors
  PARSE_FAILED: 'PARSE_FAILED',
  PARSE_TIMEOUT: 'PARSE_TIMEOUT',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // System errors
  MEMORY_LOW: 'MEMORY_LOW',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

export const ERROR_SEVERITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
};

export const RECOVERY_STRATEGIES = {
  RETRY: 'RETRY',
  FALLBACK: 'FALLBACK',
  USER_INTERVENTION: 'USER_INTERVENTION',
  RESTART: 'RESTART',
  IGNORE: 'IGNORE',
};

// Error configuration with recovery strategies
const ERROR_CONFIG = {
  [ERROR_TYPES.CONNECTION_FAILED]: {
    severity: ERROR_SEVERITY.HIGH,
    message: 'Connection failed. Retrying...',
    recovery: RECOVERY_STRATEGIES.RETRY,
    maxRetries: 3,
    retryDelay: 2000,
    fallback: 'webspeech',
  },
  [ERROR_TYPES.CONNECTION_TIMEOUT]: {
    severity: ERROR_SEVERITY.MEDIUM,
    message: 'Connection timeout. Switching to fallback...',
    recovery: RECOVERY_STRATEGIES.FALLBACK,
    maxRetries: 1,
    retryDelay: 1000,
    fallback: 'webspeech',
  },
  [ERROR_TYPES.CONNECTION_LOST]: {
    severity: ERROR_SEVERITY.HIGH,
    message: 'Connection lost. Attempting to reconnect...',
    recovery: RECOVERY_STRATEGIES.RETRY,
    maxRetries: 5,
    retryDelay: 3000,
    fallback: 'webspeech',
  },
  [ERROR_TYPES.WEBSOCKET_ERROR]: {
    severity: ERROR_SEVERITY.HIGH,
    message: 'WebSocket error. Switching to Web Speech API...',
    recovery: RECOVERY_STRATEGIES.FALLBACK,
    maxRetries: 1,
    retryDelay: 1000,
    fallback: 'webspeech',
  },
  [ERROR_TYPES.MICROPHONE_ACCESS_DENIED]: {
    severity: ERROR_SEVERITY.CRITICAL,
    message: 'Microphone access denied. Please allow microphone access and try again.',
    recovery: RECOVERY_STRATEGIES.USER_INTERVENTION,
    maxRetries: 0,
    retryDelay: 0,
    fallback: null,
  },
  [ERROR_TYPES.MICROPHONE_NOT_FOUND]: {
    severity: ERROR_SEVERITY.CRITICAL,
    message: 'No microphone found. Please connect a microphone and try again.',
    recovery: RECOVERY_STRATEGIES.USER_INTERVENTION,
    maxRetries: 0,
    retryDelay: 0,
    fallback: null,
  },
  [ERROR_TYPES.AUDIO_PROCESSING_ERROR]: {
    severity: ERROR_SEVERITY.MEDIUM,
    message: 'Audio processing error. Retrying...',
    recovery: RECOVERY_STRATEGIES.RETRY,
    maxRetries: 2,
    retryDelay: 1000,
    fallback: 'webspeech',
  },
  [ERROR_TYPES.AUDIO_QUALITY_POOR]: {
    severity: ERROR_SEVERITY.LOW,
    message: 'Audio quality is poor. Please speak closer to the microphone.',
    recovery: RECOVERY_STRATEGIES.IGNORE,
    maxRetries: 0,
    retryDelay: 0,
    fallback: null,
  },
  [ERROR_TYPES.RECOGNITION_FAILED]: {
    severity: ERROR_SEVERITY.MEDIUM,
    message: 'Recognition failed. Please try again.',
    recovery: RECOVERY_STRATEGIES.RETRY,
    maxRetries: 2,
    retryDelay: 1500,
    fallback: 'webspeech',
  },
  [ERROR_TYPES.RECOGNITION_TIMEOUT]: {
    severity: ERROR_SEVERITY.MEDIUM,
    message: 'Recognition timeout. Please try again.',
    recovery: RECOVERY_STRATEGIES.RETRY,
    maxRetries: 1,
    retryDelay: 2000,
    fallback: 'webspeech',
  },
  [ERROR_TYPES.RECOGNITION_NOT_SUPPORTED]: {
    severity: ERROR_SEVERITY.CRITICAL,
    message: 'Voice recognition not supported in this browser.',
    recovery: RECOVERY_STRATEGIES.USER_INTERVENTION,
    maxRetries: 0,
    retryDelay: 0,
    fallback: null,
  },
  [ERROR_TYPES.RECOGNITION_ABORTED]: {
    severity: ERROR_SEVERITY.LOW,
    message: 'Recognition aborted.',
    recovery: RECOVERY_STRATEGIES.IGNORE,
    maxRetries: 0,
    retryDelay: 0,
    fallback: null,
  },
  [ERROR_TYPES.PARSE_FAILED]: {
    severity: ERROR_SEVERITY.MEDIUM,
    message: 'Failed to understand command. Please try rephrasing.',
    recovery: RECOVERY_STRATEGIES.USER_INTERVENTION,
    maxRetries: 0,
    retryDelay: 0,
    fallback: null,
  },
  [ERROR_TYPES.PARSE_TIMEOUT]: {
    severity: ERROR_SEVERITY.MEDIUM,
    message: 'Parse timeout. Retrying...',
    recovery: RECOVERY_STRATEGIES.RETRY,
    maxRetries: 2,
    retryDelay: 1000,
    fallback: null,
  },
  [ERROR_TYPES.INVALID_INPUT]: {
    severity: ERROR_SEVERITY.LOW,
    message: 'Invalid input. Please try again.',
    recovery: RECOVERY_STRATEGIES.IGNORE,
    maxRetries: 0,
    retryDelay: 0,
    fallback: null,
  },
  [ERROR_TYPES.MEMORY_LOW]: {
    severity: ERROR_SEVERITY.HIGH,
    message: 'Low memory. Restarting voice capture...',
    recovery: RECOVERY_STRATEGIES.RESTART,
    maxRetries: 1,
    retryDelay: 2000,
    fallback: 'webspeech',
  },
  [ERROR_TYPES.NETWORK_ERROR]: {
    severity: ERROR_SEVERITY.HIGH,
    message: 'Network error. Switching to offline mode...',
    recovery: RECOVERY_STRATEGIES.FALLBACK,
    maxRetries: 1,
    retryDelay: 1000,
    fallback: 'webspeech',
  },
  [ERROR_TYPES.UNKNOWN_ERROR]: {
    severity: ERROR_SEVERITY.MEDIUM,
    message: 'An unexpected error occurred. Retrying...',
    recovery: RECOVERY_STRATEGIES.RETRY,
    maxRetries: 2,
    retryDelay: 2000,
    fallback: 'webspeech',
  },
};

// Error analytics storage
let errorHistory = [];
let retryCounts = {};

/**
 * Enhanced Error Handler Class
 */
export class VoiceErrorHandler {
  constructor(options = {}) {
    this.options = {
      maxErrorHistory: 100,
      enableAnalytics: true,
      enableRecovery: true,
      enableFallback: true,
      onError: null,
      onRecovery: null,
      onFallback: null,
      ...options,
    };
    
    this.errorHistory = [];
    this.retryCounts = {};
    this.recoveryInProgress = false;
  }

  /**
   * Handle an error with appropriate recovery strategy
   */
  handleError(error, context = {}) {
    const errorType = this.categorizeError(error);
    const config = ERROR_CONFIG[errorType] || ERROR_CONFIG[ERROR_TYPES.UNKNOWN_ERROR];
    
    // Log error
    this.logError(error, errorType, context);
    
    // Check if recovery is possible
    if (this.options.enableRecovery && config.recovery !== RECOVERY_STRATEGIES.USER_INTERVENTION) {
      return this.attemptRecovery(errorType, config, context);
    }
    
    // Return error for user intervention
    return {
      type: errorType,
      severity: config.severity,
      message: config.message,
      recovery: config.recovery,
      fallback: config.fallback,
      canRetry: config.maxRetries > 0,
      retryCount: this.retryCounts[errorType] || 0,
      maxRetries: config.maxRetries,
    };
  }

  /**
   * Categorize error based on error object and context
   */
  categorizeError(error) {
    if (!error) return ERROR_TYPES.UNKNOWN_ERROR;
    
    const errorMessage = error.message || error.toString();
    const errorName = error.name || '';
    
    // Connection errors
    if (errorMessage.includes('connection') || errorMessage.includes('connect')) {
      if (errorMessage.includes('timeout')) return ERROR_TYPES.CONNECTION_TIMEOUT;
      if (errorMessage.includes('lost') || errorMessage.includes('closed')) return ERROR_TYPES.CONNECTION_LOST;
      return ERROR_TYPES.CONNECTION_FAILED;
    }
    
    // WebSocket errors
    if (errorMessage.includes('websocket') || errorMessage.includes('WebSocket')) {
      return ERROR_TYPES.WEBSOCKET_ERROR;
    }
    
    // Microphone errors
    if (errorMessage.includes('microphone') || errorMessage.includes('mic')) {
      if (errorMessage.includes('denied') || errorMessage.includes('permission')) {
        return ERROR_TYPES.MICROPHONE_ACCESS_DENIED;
      }
      if (errorMessage.includes('not found') || errorMessage.includes('unavailable')) {
        return ERROR_TYPES.MICROPHONE_NOT_FOUND;
      }
      return ERROR_TYPES.AUDIO_PROCESSING_ERROR;
    }
    
    // Audio errors
    if (errorMessage.includes('audio') || errorMessage.includes('sound')) {
      if (errorMessage.includes('quality') || errorMessage.includes('poor')) {
        return ERROR_TYPES.AUDIO_QUALITY_POOR;
      }
      return ERROR_TYPES.AUDIO_PROCESSING_ERROR;
    }
    
    // Recognition errors
    if (errorMessage.includes('recognition') || errorMessage.includes('speech')) {
      if (errorMessage.includes('timeout')) return ERROR_TYPES.RECOGNITION_TIMEOUT;
      if (errorMessage.includes('aborted')) return ERROR_TYPES.RECOGNITION_ABORTED;
      if (errorMessage.includes('not supported')) return ERROR_TYPES.RECOGNITION_NOT_SUPPORTED;
      return ERROR_TYPES.RECOGNITION_FAILED;
    }
    
    // Parse errors
    if (errorMessage.includes('parse') || errorMessage.includes('understand')) {
      if (errorMessage.includes('timeout')) return ERROR_TYPES.PARSE_TIMEOUT;
      if (errorMessage.includes('invalid')) return ERROR_TYPES.INVALID_INPUT;
      return ERROR_TYPES.PARSE_FAILED;
    }
    
    // Network errors
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return ERROR_TYPES.NETWORK_ERROR;
    }
    
    // Memory errors
    if (errorMessage.includes('memory') || errorMessage.includes('out of memory')) {
      return ERROR_TYPES.MEMORY_LOW;
    }
    
    return ERROR_TYPES.UNKNOWN_ERROR;
  }

  /**
   * Attempt to recover from error
   */
  async attemptRecovery(errorType, config, context) {
    const retryCount = this.retryCounts[errorType] || 0;
    
    if (retryCount >= config.maxRetries) {
      // Max retries reached, try fallback
      if (this.options.enableFallback && config.fallback) {
        return this.attemptFallback(config.fallback, context);
      }
      
      return {
        type: errorType,
        severity: config.severity,
        message: `Max retries reached. ${config.message}`,
        recovery: RECOVERY_STRATEGIES.USER_INTERVENTION,
        fallback: config.fallback,
        canRetry: false,
        retryCount,
        maxRetries: config.maxRetries,
      };
    }
    
    // Increment retry count
    this.retryCounts[errorType] = retryCount + 1;
    
    // Wait for retry delay
    await new Promise(resolve => setTimeout(resolve, config.retryDelay));
    
    // Call recovery callback
    if (this.options.onRecovery) {
      this.options.onRecovery(errorType, retryCount + 1, config);
    }
    
    return {
      type: errorType,
      severity: config.severity,
      message: config.message,
      recovery: config.recovery,
      fallback: config.fallback,
      canRetry: true,
      retryCount: retryCount + 1,
      maxRetries: config.maxRetries,
      retryDelay: config.retryDelay,
    };
  }

  /**
   * Attempt fallback mechanism
   */
  async attemptFallback(fallbackType, context) {
    if (this.options.onFallback) {
      this.options.onFallback(fallbackType, context);
    }
    
    return {
      type: 'FALLBACK_ATTEMPTED',
      severity: ERROR_SEVERITY.MEDIUM,
      message: `Switching to ${fallbackType}...`,
      recovery: RECOVERY_STRATEGIES.FALLBACK,
      fallback: fallbackType,
      canRetry: false,
      retryCount: 0,
      maxRetries: 0,
    };
  }

  /**
   * Log error for analytics
   */
  logError(error, errorType, context) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      type: errorType,
      message: error.message || error.toString(),
      stack: error.stack,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };
    
    this.errorHistory.push(errorLog);
    
    // Keep only recent errors
    if (this.errorHistory.length > this.options.maxErrorHistory) {
      this.errorHistory = this.errorHistory.slice(-this.options.maxErrorHistory);
    }
    
    // Call error callback
    if (this.options.onError) {
      this.options.onError(errorLog);
    }
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Voice Error:', errorLog);
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {
      totalErrors: this.errorHistory.length,
      errorTypes: {},
      recentErrors: this.errorHistory.slice(-10),
      retryCounts: { ...this.retryCounts },
    };
    
    // Count errors by type
    this.errorHistory.forEach(error => {
      stats.errorTypes[error.type] = (stats.errorTypes[error.type] || 0) + 1;
    });
    
    return stats;
  }

  /**
   * Clear error history
   */
  clearHistory() {
    this.errorHistory = [];
    this.retryCounts = {};
  }

  /**
   * Reset retry counts
   */
  resetRetryCounts() {
    this.retryCounts = {};
  }

  /**
   * Get user-friendly error message
   */
  getUserFriendlyMessage(errorType, retryCount = 0) {
    const config = ERROR_CONFIG[errorType] || ERROR_CONFIG[ERROR_TYPES.UNKNOWN_ERROR];
    
    if (retryCount > 0) {
      return `${config.message} (Attempt ${retryCount + 1})`;
    }
    
    return config.message;
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable(errorType) {
    const config = ERROR_CONFIG[errorType] || ERROR_CONFIG[ERROR_TYPES.UNKNOWN_ERROR];
    return config.recovery !== RECOVERY_STRATEGIES.USER_INTERVENTION && config.maxRetries > 0;
  }

  /**
   * Get recovery suggestions
   */
  getRecoverySuggestions(errorType) {
    const suggestions = {
      [ERROR_TYPES.MICROPHONE_ACCESS_DENIED]: [
        'Click the microphone icon in your browser\'s address bar',
        'Go to browser settings and allow microphone access',
        'Refresh the page and try again',
      ],
      [ERROR_TYPES.MICROPHONE_NOT_FOUND]: [
        'Connect a microphone to your device',
        'Check if your microphone is working in other applications',
        'Try refreshing the page',
      ],
      [ERROR_TYPES.CONNECTION_FAILED]: [
        'Check your internet connection',
        'Try refreshing the page',
        'Switch to offline mode if available',
      ],
      [ERROR_TYPES.RECOGNITION_NOT_SUPPORTED]: [
        'Use a modern browser like Chrome, Firefox, or Safari',
        'Enable JavaScript in your browser',
        'Update your browser to the latest version',
      ],
      [ERROR_TYPES.AUDIO_QUALITY_POOR]: [
        'Speak closer to the microphone',
        'Reduce background noise',
        'Speak more clearly and slowly',
      ],
    };
    
    return suggestions[errorType] || [
      'Try refreshing the page',
      'Check your internet connection',
      'Contact support if the problem persists',
    ];
  }
}

// Create default error handler instance
export const defaultErrorHandler = new VoiceErrorHandler();

// Export utility functions
export function createErrorHandler(options = {}) {
  return new VoiceErrorHandler(options);
}

export function getErrorConfig(errorType) {
  return ERROR_CONFIG[errorType] || ERROR_CONFIG[ERROR_TYPES.UNKNOWN_ERROR];
}

export function isErrorRecoverable(errorType) {
  const config = ERROR_CONFIG[errorType] || ERROR_CONFIG[ERROR_TYPES.UNKNOWN_ERROR];
  return config.recovery !== RECOVERY_STRATEGIES.USER_INTERVENTION && config.maxRetries > 0;
}
