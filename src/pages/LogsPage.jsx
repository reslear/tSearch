import React from 'react';
import PropTypes from 'prop-types';
import {inject, observer} from 'mobx-react';

@inject('rootStore')
@observer
class LogsPage extends React.Component {
  static propTypes = {
    rootStore: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.state = {
      expandedLogId: null,
      filterSource: null,
    };
  }

  get loggerStore() {
    return this.props.rootStore.logger;
  }

  handleClearLogs = (e) => {
    e.preventDefault();
    if (window.confirm('Are you sure you want to clear all logs?')) {
      this.loggerStore.clearLogs();
    }
  };

  handleExportJSON = (e) => {
    e.preventDefault();
    const data = this.loggerStore.exportJSON();
    this._downloadFile(data, 'logs.json', 'application/json');
  };

  handleExportCSV = (e) => {
    e.preventDefault();
    const data = this.loggerStore.exportCSV();
    this._downloadFile(data, 'logs.csv', 'text/csv');
  };

  _downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  toggleLogExpanded = (logId) => {
    this.setState({
      expandedLogId: this.state.expandedLogId === logId ? null : logId,
    });
  };

  setFilterSource = (source) => {
    this.setState({
      filterSource: source === this.state.filterSource ? null : source,
    });
  };

  render() {
    const logs = this.loggerStore.logs;
    const sources = this.loggerStore.getSources();
    const { filterSource, expandedLogId } = this.state;

    const filteredLogs = filterSource
      ? logs.filter(log => log.source === filterSource)
      : logs;

    return (
      <div className="page page-logs">
        <h2 className="page__title">Extension Logs</h2>

        <div className="logs__stats">
          <div className="stat">
            <span className="stat__label">Total logs:</span>
            <span className="stat__value">{logs.length}</span>
          </div>
          <div className="stat">
            <span className="stat__label">Sources:</span>
            <span className="stat__value">{sources.length}</span>
          </div>
        </div>

        <div className="logs__filters">
          <h3>Filter by source:</h3>
          <button
            className={`filter-btn ${!filterSource ? 'active' : ''}`}
            onClick={() => this.setFilterSource(null)}
          >
            All ({logs.length})
          </button>
          {sources.map(source => (
            <button
              key={source}
              className={`filter-btn ${filterSource === source ? 'active' : ''}`}
              onClick={() => this.setFilterSource(source)}
            >
              {source} ({logs.filter(l => l.source === source).length})
            </button>
          ))}
        </div>

        <div className="logs__controls">
          <button onClick={this.handleExportJSON} className="button">
            Export JSON
          </button>
          <button onClick={this.handleExportCSV} className="button">
            Export CSV
          </button>
          <button onClick={this.handleClearLogs} className="button button--danger">
            Clear logs
          </button>
        </div>

        <div className="logs__list">
          {filteredLogs.length === 0 ? (
            <div className="logs__empty">No logs found</div>
          ) : (
            filteredLogs.map(log => (
              <div key={log.id} className="log-entry">
                <div
                  className="log-entry__header"
                  onClick={() => this.toggleLogExpanded(log.id)}
                >
                  <span className="log-entry__time">{new Date(log.timestamp).toLocaleString()}</span>
                  <span className="log-entry__source">[{log.source}]</span>
                  <span className="log-entry__message">{log.message}</span>
                  {log.code && <span className="log-entry__code">({log.code})</span>}
                </div>
                {expandedLogId === log.id && (
                  <div className="log-entry__details">
                    {log.stack && (
                      <div className="log-entry__stack">
                        <strong>Stack:</strong>
                        <pre>{log.stack}</pre>
                      </div>
                    )}
                    {Object.keys(log.context).length > 0 && (
                      <div className="log-entry__context">
                        <strong>Context:</strong>
                        <pre>{JSON.stringify(log.context, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }
}

export default LogsPage;
