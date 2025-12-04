import React, { createContext, useContext, useState } from 'react';

// Create the Search Context
const SearchContext = createContext();

// Custom hook to use the Search Context
export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
}

// Search Provider Component
export function SearchProvider({ children }) {
  const [searchMatches, setSearchMatches] = useState([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

  const updateSearchResults = (matches, currentIndex) => {
    setSearchMatches(matches);
    setCurrentMatchIndex(currentIndex);
  };

  const clearSearch = () => {
    setSearchMatches([]);
    setCurrentMatchIndex(-1);
  };

  const goToNextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIndex = (currentMatchIndex + 1) % searchMatches.length;
    setCurrentMatchIndex(nextIndex);
    scrollToMatch(nextIndex);
  };

  const goToPreviousMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIndex = currentMatchIndex <= 0 ? searchMatches.length - 1 : currentMatchIndex - 1;
    setCurrentMatchIndex(prevIndex);
    scrollToMatch(prevIndex);
  };

  const scrollToMatch = (index) => {
    if (index < 0 || index >= searchMatches.length) return;

    // Find the highlighted mark element for this match
    const markElements = document.querySelectorAll('.search-highlight.current');
    if (markElements.length > 0) {
      const targetElement = markElements[0]; // Should be the current match
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    } else {
      // Fallback: scroll the container to show highlighted content
      const llmContainer = document.querySelector('.llm-container');
      if (llmContainer) {
        const highlightedElements = llmContainer.querySelectorAll('.search-highlight');
        if (highlightedElements.length > index) {
          highlightedElements[index].scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }
      }
    }
  };

  const value = {
    searchMatches,
    currentMatchIndex,
    updateSearchResults,
    clearSearch,
    goToNextMatch,
    goToPreviousMatch
  };

  return React.createElement(SearchContext.Provider, { value }, children);
}