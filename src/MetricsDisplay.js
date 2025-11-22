export function MetricsDisplay({ metrics, onClearMetrics }) {
  if (!metrics) return null;

  const formatTime = (ms) => {
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const MetricCard = ({ title, data, unit = 'ms', formatter = formatTime }) =>
    React.createElement('div', { className: 'metric-card' },
      React.createElement('h4', null, title),
      React.createElement('div', { className: 'metric-stats' },
        React.createElement('div', { className: 'stat' },
          React.createElement('span', { className: 'label' }, 'Count:'),
          React.createElement('span', { className: 'value' }, data.count)
        ),
        React.createElement('div', { className: 'stat' },
          React.createElement('span', { className: 'label' }, 'Avg:'),
          React.createElement('span', { className: 'value' }, formatter(data.avg))
        ),
        React.createElement('div', { className: 'stat' },
          React.createElement('span', { className: 'label' }, 'Min:'),
          React.createElement('span', { className: 'value' }, formatter(data.min))
        ),
        React.createElement('div', { className: 'stat' },
          React.createElement('span', { className: 'label' }, 'Max:'),
          React.createElement('span', { className: 'value' }, formatter(data.max))
        ),
        React.createElement('div', { className: 'stat' },
          React.createElement('span', { className: 'label' }, 'Latest:'),
          React.createElement('span', { className: 'value' }, formatter(data.latest))
        )
      )
    );

  return React.createElement('div', { className: 'metrics-container' },
    React.createElement('div', { className: 'metrics-header' },
      React.createElement('h3', null, 'Performance Metrics'),
      React.createElement('button', {
        onClick: onClearMetrics,
        className: 'clear-metrics-btn'
      }, 'Clear Metrics')
    ),
    React.createElement('div', { className: 'metrics-grid' },
      React.createElement(MetricCard, {
        title: 'Audio Processing',
        data: metrics.audioProcessing
      }),
      React.createElement(MetricCard, {
        title: 'Transcription',
        data: metrics.transcription
      }),
      React.createElement(MetricCard, {
        title: 'LLM Analysis',
        data: metrics.llmAnalysis
      }),
      React.createElement(MetricCard, {
        title: 'Total Latency',
        data: metrics.totalLatency
      })
    )
  );
}