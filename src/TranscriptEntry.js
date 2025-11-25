export function TranscriptEntry({ entry }) {
  // Handle both old format (just segments) and new format (segments + noiseSegments)
  const meaningfulSegments = entry.segments || [];
  const noiseSegments = entry.noiseSegments || [];
  const totalSegments = entry.totalSegments || meaningfulSegments.length;

  // If no segments at all, return null
  if (totalSegments === 0) return null;

  return React.createElement('div', { className: 'transcript-entry' },
    React.createElement('div', null,
      React.createElement('strong', null, entry.timestamp.toLocaleTimeString()),
      totalSegments > meaningfulSegments.length && React.createElement('span', {
        style: { fontSize: '11px', color: '#666', marginLeft: '8px' }
      }, `(${meaningfulSegments.length}/${totalSegments} segments kept)`)
    ),
    React.createElement('div', { className: 'transcript-content' },
      // Show all segments in order, but style filtered ones differently
      [...meaningfulSegments.map(seg => ({ ...seg, isNoise: false })),
       ...noiseSegments.map(seg => ({ ...seg, isNoise: true }))]
        .sort((a, b) => (a.start || 0) - (b.start || 0)) // Sort by timestamp
        .map((segment, i, arr) => {
          const speech = segment.cleanedSpeech || segment.speech;
          const isLast = i === arr.length - 1;

          if (segment.isNoise) {
            // Style filtered segments differently
            return React.createElement('span', {
              key: `noise-${i}`,
              className: 'noise-segment',
              style: {
                color: '#999',
                fontStyle: 'italic',
                textDecoration: 'line-through',
                opacity: 0.6
              },
              title: `Filtered out (${segment.filterReason}) - not added to conversation buffer`
            }, speech + (isLast ? '' : ' '));
          } else {
            // Normal meaningful segments
            return React.createElement('span', {
              key: `meaningful-${i}`,
              className: 'speech-segment',
              title: `${segment.start || 0} - ${segment.end || 0} (added to conversation)`
            }, speech + (isLast ? '' : ' '));
          }
        })
    )
  );
}