export function TranscriptEntry({ entry }) {
  if (!Array.isArray(entry.segments) || entry.segments.length === 0) return null;

  const filteredSegments = entry.segments.filter(segment => segment.speech && segment.speech.trim());

  return React.createElement('div', { className: 'transcript-entry' },
    React.createElement('div', null, React.createElement('strong', null, entry.timestamp.toLocaleTimeString())),
    React.createElement('div', { className: 'transcript-content' },
      filteredSegments.map((segment, i) => React.createElement('span', { key: i, className: 'speech-segment', title: `${segment.start} - ${segment.end}` }, segment.speech + (i < filteredSegments.length - 1 ? ' ' : '')))
    )
  );
}