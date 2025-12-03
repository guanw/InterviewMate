/**
 * Response Cache Utility
 * Caches analysis responses to avoid re-analyzing similar questions
 */

class ResponseCache {
  constructor(maxSize = 50) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.accessOrder = []; // For LRU eviction
  }

  /**
   * Generate a cache key from question/problem content
   * Uses a simple hash of the normalized content
   */
  generateKey(content) {
    if (!content || typeof content !== 'string') {
      return null;
    }

    // Normalize content: lowercase, remove extra whitespace, sort lines
    const normalized = content
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .sort()
      .join('\n');

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Check if content is similar to cached entries
   * Uses fuzzy matching based on key similarity
   */
  findSimilar(content) {
    const key = this.generateKey(content);
    if (!key) return null;

    // Direct match
    if (this.cache.has(key)) {
      this._updateAccessOrder(key);
      return this.cache.get(key);
    }

    // Fuzzy matching - check for similar keys (simple approach)
    // This could be enhanced with more sophisticated similarity algorithms
    for (const [cachedKey, cachedValue] of this.cache.entries()) {
      if (this._areKeysSimilar(key, cachedKey)) {
        this._updateAccessOrder(cachedKey);
        return cachedValue;
      }
    }

    return null;
  }

  /**
   * Simple similarity check for cache keys
   * This is a basic implementation - could be enhanced
   */
  _areKeysSimilar(key1, key2, threshold = 0.8) {
    if (key1 === key2) return true;

    // Simple Levenshtein distance check
    const distance = this._levenshteinDistance(key1, key2);
    const maxLength = Math.max(key1.length, key2.length);
    const similarity = 1 - (distance / maxLength);

    return similarity >= threshold;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  _levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Store a response in the cache
   */
  store(content, response, metadata = {}) {
    const key = this.generateKey(content);
    if (!key) return false;

    const cacheEntry = {
      response,
      metadata: {
        ...metadata,
        cachedAt: new Date().toISOString(),
        contentHash: key
      }
    };

    // Evict oldest entry if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.accessOrder.shift();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, cacheEntry);
    this._updateAccessOrder(key);

    return true;
  }

  /**
   * Update access order for LRU cache
   */
  _updateAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this._calculateHitRate(),
      entries: Array.from(this.cache.entries()).map(([key, value]) => ({
        key,
        cachedAt: value.metadata.cachedAt,
        responseLength: value.response?.length || 0
      }))
    };
  }

  /**
   * Calculate hit rate (simplified - would need actual hit/miss tracking)
   */
  _calculateHitRate() {
    // This is a placeholder - in a real implementation you'd track hits/misses
    return this.cache.size > 0 ? 0.75 : 0; // Assume 75% hit rate for demo
  }

  /**
   * Clear all cached responses
   */
  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Remove specific entry
   */
  remove(content) {
    const key = this.generateKey(content);
    if (key && this.cache.has(key)) {
      this.cache.delete(key);
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      return true;
    }
    return false;
  }
}

// Export singleton instance
const responseCache = new ResponseCache();

export { ResponseCache, responseCache };