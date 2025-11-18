function TranscriptEntry({ entry }) {
  if (!Array.isArray(entry.segments) || entry.segments.length === 0) return null;

  const groups = [];
  let currentGroup = null;

  entry.segments.forEach((segment, index) => {
    if (!segment.speech || segment.speech.trim() === '') return;

    if (currentGroup && segment.start === currentGroup.end) {
      currentGroup.text += segment.speech;
      currentGroup.end = segment.end;
    } else {
      if (currentGroup) groups.push(currentGroup);
      currentGroup = {
        text: segment.speech,
        start: segment.start,
        end: segment.end
      };
    }
  });

  if (currentGroup) groups.push(currentGroup);

  return React.createElement('div', { className: 'transcript-entry' },
    React.createElement('div', null, React.createElement('strong', null, entry.timestamp.toLocaleTimeString())),
    React.createElement('div', { className: 'transcript-content' },
      groups.map((group, i) => React.createElement('span', { key: i, className: 'speech-segment', title: `${group.start} - ${group.end}` }, group.text))
    )
  );
}

window.TranscriptEntry = TranscriptEntry;