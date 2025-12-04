import React, { useState, useEffect } from 'react';
import { useSearch } from './SearchContext.js';

function SearchBox({ textToSearch, onClose }) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { searchMatches, currentMatchIndex, updateSearchResults, goToNextMatch, goToPreviousMatch } = useSearch();
  const inputRef = React.useRef(null);

  // Perform search when query or text changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      updateSearchResults([], -1);
      return;
    }

    const matches = [];
    try {
      const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedQuery, 'gi');

      let match;
      while ((match = regex.exec(textToSearch)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0]
        });
        if (matches.length > 100) break;
      }
    } catch (error) {
      // Invalid regex, ignore
    }

    const newIndex = matches.length > 0 ? 0 : -1;
    updateSearchResults(matches, newIndex);
  }, [searchQuery, textToSearch]);

  // Auto-focus input when search becomes visible
  useEffect(() => {
    if (showSearch && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showSearch]);

  const handleInputChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      goToNextMatch();
    } else if (e.key === 'Escape') {
      closeSearch();
    }
  };


  const closeSearch = () => {
    setShowSearch(false);
    setSearchQuery('');
    updateSearchResults([], -1);
    onClose();
  };

  const toggleSearch = () => {
    setShowSearch(prev => !prev);
  };

  // Expose toggle function to parent
  useEffect(() => {
    // This allows parent to control visibility
    window.toggleSearchBox = toggleSearch;
    return () => {
      delete window.toggleSearchBox;
    };
  }, []);

  if (!showSearch) return null;

  return React.createElement('div', { className: 'search-overlay' },
    React.createElement('div', { className: 'search-box' },
      React.createElement('input', {
        type: 'text',
        className: 'search-input',
        placeholder: 'Search in AI analysis...',
        value: searchQuery,
        onChange: handleInputChange,
        onKeyDown: handleKeyDown,
        ref: inputRef
      }),
      React.createElement('div', { className: 'search-controls' },
        React.createElement('button', {
          className: 'search-btn',
          onClick: goToPreviousMatch,
          disabled: searchMatches.length === 0,
          title: 'Previous match (Shift+Enter)'
        }, '↑'),
        React.createElement('span', { className: 'search-count' },
          searchMatches.length > 0 ? `${currentMatchIndex + 1} of ${searchMatches.length}` : 'No matches'
        ),
        React.createElement('button', {
          className: 'search-btn',
          onClick: goToNextMatch,
          disabled: searchMatches.length === 0,
          title: 'Next match (Enter)'
        }, '↓'),
        React.createElement('button', {
          className: 'search-close',
          onClick: onClose,
          title: 'Close search (Esc)'
        }, '×')
      )
    )
  );
}

export { SearchBox };