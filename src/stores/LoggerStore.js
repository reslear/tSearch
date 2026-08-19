import {types} from 'mobx-state-tree';
import {getErrorLogger} from '../tools/errorLogger';

const LogEntryModel = types.model('LogEntry', {
  id: types.string,
  timestamp: types.string,
  source: types.string,
  message: types.string,
  stack: types.string,
  code: types.string,
  context: types.frozen(),
});

const LoggerStore = types.model('LoggerStore', {
  logs: types.array(LogEntryModel),
  autoRefresh: types.optional(types.boolean, true),
}).actions((self) => {
  const errorLogger = getErrorLogger();
  let unsubscribe = null;

  return {
    afterCreate() {
      // Load initial logs
      self.logs = errorLogger.getLogs();

      // Subscribe to logger updates if autoRefresh is enabled
      if (self.autoRefresh) {
        unsubscribe = errorLogger.subscribe((logs) => {
          self.logs = logs;
        });
      }
    },

    beforeDestroy() {
      if (unsubscribe) {
        unsubscribe();
      }
    },

    refresh() {
      self.logs = errorLogger.getLogs();
    },

    clearLogs() {
      errorLogger.clearLogs();
      self.logs = [];
    },

    exportJSON() {
      return errorLogger.exportJSON();
    },

    exportCSV() {
      return errorLogger.exportCSV();
    },

    setAutoRefresh(value) {
      self.autoRefresh = value;

      if (value && !unsubscribe) {
        unsubscribe = errorLogger.subscribe((logs) => {
          self.logs = logs;
        });
      } else if (!value && unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    },
  };
}).views((self) => {
  return {
    get logCount() {
      return self.logs.length;
    },

    getLogsBySource(source) {
      return self.logs.filter(log => log.source === source);
    },

    getSources() {
      const sources = new Set();
      self.logs.forEach(log => sources.add(log.source));
      return Array.from(sources).sort();
    },
  };
});

export default LoggerStore;
