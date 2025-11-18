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

  return React.createElement('div', { style: { marginBottom: '15px', padding: '10px', background: '#f8f9fa', borderRadius: '5px', borderLeft: '3px solid #3498db' } },
    React.createElement('div', null, React.createElement('strong', null, entry.timestamp.toLocaleTimeString())),
    React.createElement('div', { style: { marginTop: '5px', lineHeight: '1.5' } },
      groups.map((group, i) => React.createElement('span', { key: i, style: { marginRight: '4px', padding: '2px 4px', borderRadius: '3px', backgroundColor: '#e8f4fc', cursor: 'pointer' }, title: `${group.start} - ${group.end}` }, group.text))
    )
  );
}

window.TranscriptEntry = TranscriptEntry;