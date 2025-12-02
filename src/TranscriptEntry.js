import React from 'react';

function TranscriptEntryComponent({ entry }) {
  // Handle both old format (just segments) and new format (segments + noiseSegments)
  const meaningfulSegments = entry.segments || [];
  const noiseSegments = entry.noiseSegments || [];
  const totalSegments = entry.totalSegments || meaningfulSegments.length;

  // If no segments at all, return null
  if (totalSegments === 0) return null;

  // Helper function to render text with bracketed/parenthesized content highlighted
  function renderTextWithHighlights(text, isNoise, filterReason) {
    if (!isNoise || filterReason !== 'contains_annotations') {
      return text;
    }

    // For contains_annotations noise segments, highlight the bracketed parts
    const parts = [];
    let lastIndex = 0;
    const regex = /(\[[^\]]*\]|\([^)]*\))/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      // Add the bracketed/parenthesized content with special styling
      parts.push(React.createElement('span', {
        key: `highlight-${match.index}`,
        style: {
          textDecoration: 'underline',
          fontWeight: 'bold',
          color: '#ff6b6b'
        }
      }, match[0]));
      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  }

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
            const displayText = renderTextWithHighlights(speech, true, segment.filterReason);
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
            }, displayText, isLast ? '' : ' ');
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

export const TranscriptEntry = React.memo(TranscriptEntryComponent);