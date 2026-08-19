/**
 * Custom error logger for the extension
 * Filters out network errors and stores only important bugs
 */

class ErrorLogger {
  constructor(maxLogs = 100) {
    this.maxLogs = maxLogs;
    this.logs = [];
    this.listeners = [];
    this.loadFromStorage();
  }

  /**
   * Log an error
   */
  error(source, error, context = {}) {
    const errorData = this._normalizeError(error);

    // Don't log network errors
    if (this._isNetworkError(errorData)) {
      return;
    }

    const logEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      timestamp: new Date().toISOString(),
      source,
      message: errorData.message,
      stack: errorData.stack,
      code: errorData.code,
      context,
    };

    this.logs.unshift(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    this._saveToStorage();
    this._notifyListeners();
  }

  /**
   * Check if error is network-related or caused by network issues
   */
  _isNetworkError(errorData) {
    const msg = errorData.message.toLowerCase();

    // Direct network errors
    if (msg.includes('failed to fetch') ||
      msg.includes('request is blocked') ||
      msg.includes('statuscodeerror') ||
      msg.includes('this function must be called during a user gesture') ||
      msg.includes('403') ||
      msg.includes('404') ||
      msg.includes('503')) {
      return true;
    }

    // Selector/parsing errors caused by network issues
    // When site blocks request or returns error page, parsing fails
    if (msg.includes('value is not string') ||
      msg.includes('value is not element') ||
      msg.includes('selector') ||
      msg.includes('matchselector')) {
      return true;
    }

    return false;
  }

  /**
   * Normalize error object
   */
  _normalizeError(error) {
    if (!error) {
      return { message: 'Unknown error', stack: '', code: '' };
    }

    return {
      message: error.message || String(error),
      stack: error.stack || '',
      code: error.code || '',
    };
  }

  /**
   * Get all logs
   */
  getLogs() {
    return [...this.logs];
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
    this._saveToStorage();
    this._notifyListeners();
  }

  /**
   * Subscribe to log changes
   */
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Notify listeners about changes
   */
  _notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.logs);
      } catch (err) {
        console.error('Error in logger listener:', err);
      }
    });
  }

  /**
   * Save logs to chrome storage
   */
  _saveToStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ 'extension_logs': this.logs });
    }
  }

  /**
   * Load logs from chrome storage
   */
  _loadFromStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['extension_logs'], (result) => {
        if (result.extension_logs) {
          this.logs = result.extension_logs;
          this._notifyListeners();
        }
      });
    }
  }

  loadFromStorage() {
    this._loadFromStorage();
  }

  /**
   * Export logs as JSON
   */
  exportJSON() {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Export logs as CSV
   */
  exportCSV() {
    const headers = ['Timestamp', 'Source', 'Message', 'Code'];
    const rows = this.logs.map(log => [
      log.timestamp,
      log.source,
      `"${log.message.replace(/"/g, '""')}"`,
      log.code || '-',
    ]);

    return [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');
  }
}

// Global singleton
let logger = null;

export function getErrorLogger() {
  if (!logger) {
    logger = new ErrorLogger();
  }
  return logger;
}

export default ErrorLogger;
