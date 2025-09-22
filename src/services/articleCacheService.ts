import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CachedArticle {
  url: string;
  content: string;
  title: string;
  timestamp: number;
  size: number;
}

export interface CacheMetadata {
  totalSize: number;
  articleCount: number;
  lastCleanup: number;
}

class ArticleCacheService {
  private static instance: ArticleCacheService;
  private inMemoryCache = new Map<string, CachedArticle>();

  // Cache configuration
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly MAX_ARTICLES = 100;
  private readonly CLEANUP_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

  // Storage keys
  private readonly CACHE_PREFIX = 'article_cache_';
  private readonly METADATA_KEY = 'cache_metadata';

  private constructor() {
    // Initialize cleanup on app start
    this.performPeriodicCleanup();
  }

  public static getInstance(): ArticleCacheService {
    if (!ArticleCacheService.instance) {
      ArticleCacheService.instance = new ArticleCacheService();
    }
    return ArticleCacheService.instance;
  }

  /**
   * Get article content from cache
   */
  async getArticleContent(url: string): Promise<string | null> {
    try {
      const cacheKey = this.getCacheKey(url);

      // Check in-memory cache first
      const memoryCache = this.inMemoryCache.get(cacheKey);
      if (memoryCache && this.isValidCache(memoryCache.timestamp)) {
        return memoryCache.content;
      }

      // Check persistent storage
      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (cachedData) {
        const parsed: CachedArticle = JSON.parse(cachedData);

        if (this.isValidCache(parsed.timestamp)) {
          // Update in-memory cache
          this.inMemoryCache.set(cacheKey, parsed);
          return parsed.content;
        } else {
          // Remove expired cache
          await this.removeFromCache(url);
        }
      }
    } catch (error) {
      console.error('Error getting cached article:', error);
    }

    return null;
  }

  /**
   * Cache article content
   */
  async cacheArticleContent(url: string, content: string, title: string): Promise<boolean> {
    try {
      const cacheKey = this.getCacheKey(url);
      const timestamp = Date.now();
      const size = new Blob([content]).size;

      const cachedArticle: CachedArticle = {
        url,
        content,
        title,
        timestamp,
        size
      };

      // Check if we need to free up space
      await this.ensureSpaceAvailable(size);

      // Store in memory
      this.inMemoryCache.set(cacheKey, cachedArticle);

      // Store persistently
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cachedArticle));

      // Update metadata
      await this.updateCacheMetadata(size, 1);

      return true;
    } catch (error) {
      console.error('Error caching article:', error);
      return false;
    }
  }

  /**
   * Pre-cache articles in background
   */
  async preCacheArticles(articles: Array<{ url: string; title: string }>): Promise<void> {
    const CORS_PROXIES = [
      'https://thingproxy.freeboard.io/fetch/',
    ];

    for (const article of articles) {
      try {
        // Skip if already cached
        const existing = await this.getArticleContent(article.url);
        if (existing) continue;

        // Try to fetch and cache
        let content = null;
        for (const proxy of CORS_PROXIES) {
          try {
            const proxyUrl = proxy + encodeURIComponent(article.url);
            const response = await fetch(proxyUrl, {
              timeout: 15000,
              headers: {
                'Accept': 'text/html',
                'User-Agent': 'Mozilla/5.0 (compatible; TechArticleReader/1.0)',
              }
            } as any);

            if (response.ok) {
              content = await response.text();
              break;
            }
          } catch (error) {
            continue;
          }
        }

        if (content && content.length > 100) {
          const processedContent = await this.extractReadableContent(content, article.url);
          await this.cacheArticleContent(article.url, processedContent, article.title);
        }

        // Add delay to avoid overwhelming servers
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Failed to pre-cache article: ${article.url}`, error);
      }
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<CacheMetadata> {
    try {
      const metadata = await AsyncStorage.getItem(this.METADATA_KEY);
      if (metadata) {
        return JSON.parse(metadata);
      }
    } catch (error) {
      console.error('Error getting cache stats:', error);
    }

    return {
      totalSize: 0,
      articleCount: 0,
      lastCleanup: Date.now()
    };
  }

  /**
   * Clear all cached articles
   */
  async clearCache(): Promise<void> {
    try {
      // Clear in-memory cache
      this.inMemoryCache.clear();

      // Get all cache keys
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));

      // Remove all cache items
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }

      // Reset metadata
      await AsyncStorage.setItem(this.METADATA_KEY, JSON.stringify({
        totalSize: 0,
        articleCount: 0,
        lastCleanup: Date.now()
      }));
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Remove specific article from cache
   */
  async removeFromCache(url: string): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(url);

      // Get article size before removing
      const cached = this.inMemoryCache.get(cacheKey);
      let size = 0;

      if (!cached) {
        const cachedData = await AsyncStorage.getItem(cacheKey);
        if (cachedData) {
          const parsed: CachedArticle = JSON.parse(cachedData);
          size = parsed.size;
        }
      } else {
        size = cached.size;
      }

      // Remove from memory
      this.inMemoryCache.delete(cacheKey);

      // Remove from storage
      await AsyncStorage.removeItem(cacheKey);

      // Update metadata
      if (size > 0) {
        await this.updateCacheMetadata(-size, -1);
      }
    } catch (error) {
      console.error('Error removing from cache:', error);
    }
  }

  /**
   * Extract readable content from HTML
   */
  private async extractReadableContent(html: string, url: string): Promise<string> {
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');

          // Remove unwanted elements
          const selectorsToRemove = [
            'script', 'style', 'nav', 'header', 'footer', 'aside',
            '[class*="ad"]', '[id*="ad"]', '.advertisement', '.social-share',
            '.comments', '.sidebar', '.menu', '.popup', '.modal',
            'iframe[src*="doubleclick"]', 'iframe[src*="googlesyndication"]'
          ];

          selectorsToRemove.forEach(selector => {
            try {
              const elements = doc.querySelectorAll(selector);
              elements.forEach(el => el.remove());
            } catch (e) {
              // Ignore selector errors
            }
          });

          // Find main content
          const contentSelectors = [
            'article',
            '[role="main"]',
            'main',
            '.article-content',
            '.post-content',
            '.entry-content',
            '.content',
            '.article',
            '.post',
            'body'
          ];

          let contentElement = null;
          for (const selector of contentSelectors) {
            contentElement = doc.querySelector(selector);
            if (contentElement && contentElement.textContent && contentElement.textContent.trim().length > 200) {
              break;
            }
          }

          if (contentElement) {
            let content = contentElement.innerHTML;

            // Clean up content
            content = content
              .replace(/\s(style|class|id|data-[^=]*|on[^=]*)="[^"]*"/g, '')
              .replace(/\s(style|class|id|data-[^=]*|on[^=]*)='[^']*'/g, '');

            // Fix relative URLs
            try {
              const baseUrl = new URL(url).origin;
              content = content
                .replace(/src="\/([^"]*)"/g, `src="${baseUrl}/$1"`)
                .replace(/href="\/([^"]*)"/g, `href="${baseUrl}/$1"`);
            } catch (e) {
              // Ignore URL parsing errors
            }

            resolve(content);
          } else {
            resolve('Article content could not be extracted.');
          }
        } catch (error) {
          console.error('Error extracting content:', error);
          resolve('Content extraction failed.');
        }
      }, 0);
    });
  }

  /**
   * Private helper methods
   */
  private getCacheKey(url: string): string {
    return this.CACHE_PREFIX + encodeURIComponent(url);
  }

  private isValidCache(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_DURATION;
  }

  private async updateCacheMetadata(sizeChange: number, countChange: number): Promise<void> {
    try {
      const current = await this.getCacheStats();
      const updated: CacheMetadata = {
        totalSize: Math.max(0, current.totalSize + sizeChange),
        articleCount: Math.max(0, current.articleCount + countChange),
        lastCleanup: current.lastCleanup
      };

      await AsyncStorage.setItem(this.METADATA_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error updating cache metadata:', error);
    }
  }

  private async ensureSpaceAvailable(requiredSize: number): Promise<void> {
    const stats = await this.getCacheStats();

    if (stats.totalSize + requiredSize > this.MAX_CACHE_SIZE || stats.articleCount >= this.MAX_ARTICLES) {
      await this.performCleanup();
    }
  }

  private async performCleanup(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));

      // Get all cached articles with timestamps
      const articles: Array<{ key: string; timestamp: number; size: number }> = [];

      for (const key of cacheKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const parsed: CachedArticle = JSON.parse(data);
            articles.push({
              key,
              timestamp: parsed.timestamp,
              size: parsed.size
            });
          }
        } catch (error) {
          // Remove corrupted entries
          await AsyncStorage.removeItem(key);
        }
      }

      // Sort by timestamp (oldest first)
      articles.sort((a, b) => a.timestamp - b.timestamp);

      // Remove expired articles
      const now = Date.now();
      const expiredArticles = articles.filter(article =>
        now - article.timestamp > this.CACHE_DURATION
      );

      // Remove excess articles (keep newest)
      const validArticles = articles.filter(article =>
        now - article.timestamp <= this.CACHE_DURATION
      );

      const toRemove = [...expiredArticles];
      if (validArticles.length > this.MAX_ARTICLES) {
        const excess = validArticles.slice(0, validArticles.length - this.MAX_ARTICLES);
        toRemove.push(...excess);
      }

      // Remove articles
      if (toRemove.length > 0) {
        const keysToRemove = toRemove.map(article => article.key);
        await AsyncStorage.multiRemove(keysToRemove);

        // Update metadata
        const removedSize = toRemove.reduce((sum, article) => sum + article.size, 0);
        await this.updateCacheMetadata(-removedSize, -toRemove.length);

        // Clear from memory cache
        toRemove.forEach(article => {
          const url = decodeURIComponent(article.key.replace(this.CACHE_PREFIX, ''));
          this.inMemoryCache.delete(article.key);
        });

        console.log(`Cache cleanup completed. Removed ${toRemove.length} articles.`);
      }

      // Update last cleanup time
      const stats = await this.getCacheStats();
      stats.lastCleanup = Date.now();
      await AsyncStorage.setItem(this.METADATA_KEY, JSON.stringify(stats));

    } catch (error) {
      console.error('Error during cache cleanup:', error);
    }
  }

  private async performPeriodicCleanup(): Promise<void> {
    try {
      const stats = await this.getCacheStats();
      const timeSinceLastCleanup = Date.now() - stats.lastCleanup;

      if (timeSinceLastCleanup > this.CLEANUP_INTERVAL) {
        await this.performCleanup();
      }

      // Schedule next cleanup
      setTimeout(() => {
        this.performPeriodicCleanup();
      }, this.CLEANUP_INTERVAL);

    } catch (error) {
      console.error('Error in periodic cleanup:', error);
      // Retry after 1 hour
      setTimeout(() => {
        this.performPeriodicCleanup();
      }, 60 * 60 * 1000);
    }
  }
}

export const articleCacheService = ArticleCacheService.getInstance();
