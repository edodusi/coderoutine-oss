import AsyncStorage from '@react-native-async-storage/async-storage';
import { Article, UserArticleProgress, TagStats, AppState, FavoriteArticle, TranslationSettings, DelayedArticle } from '../types';

const STORAGE_KEYS = {
  APP_STATE: 'app_state',
  ARTICLE_HISTORY: 'article_history',
  TAG_STATS: 'tag_stats',
  CURRENT_ARTICLE: 'current_article',
  THEME_PREFERENCE: 'theme_preference',
  LAST_FETCH_DATE: 'last_fetch_date',
  READING_SESSION: 'reading_session_',
  FAVORITES: 'favorites',
  TRANSLATION_SETTINGS: 'translation_settings',
  BACKLOG_ARTICLES: 'backlog_articles',
  DEV_DAY_OFFSET: 'dev_day_offset',
} as const;

class StorageService {
  private static instance: StorageService;

  private constructor() {}

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Saves the current article to storage
   */
  async saveCurrentArticle(article: Article | null): Promise<void> {
    try {
      if (article === null) {
        await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_ARTICLE);
      } else {
        await AsyncStorage.setItem(
          STORAGE_KEYS.CURRENT_ARTICLE,
          JSON.stringify(article)
        );
      }
    } catch (error) {
      console.error('Error saving current article:', error);
      throw error;
    }
  }

  /**
   * Gets the current article from storage
   */
  async getCurrentArticle(): Promise<Article | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_ARTICLE);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting current article:', error);
      return null;
    }
  }

  /**
   * Saves article reading progress
   */
  async saveArticleProgress(progress: UserArticleProgress): Promise<void> {
    try {
      const history = await this.getArticleHistory();
      const existingIndex = history.findIndex(
        p => p.articleId === progress.articleId
      );

      if (existingIndex >= 0) {
        history[existingIndex] = progress;
      } else {
        history.push(progress);
      }

      await AsyncStorage.setItem(
        STORAGE_KEYS.ARTICLE_HISTORY,
        JSON.stringify(history)
      );
    } catch (error) {
      console.error('Error saving article progress:', error);
      throw error;
    }
  }

  /**
   * Gets all article reading history
   */
  async getArticleHistory(): Promise<UserArticleProgress[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ARTICLE_HISTORY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting article history:', error);
      return [];
    }
  }

  /**
   * Gets progress for a specific article
   */
  async getArticleProgress(articleId: string): Promise<UserArticleProgress | null> {
    try {
      const history = await this.getArticleHistory();
      return history.find(p => p.articleId === articleId) || null;
    } catch (error) {
      console.error('Error getting article progress:', error);
      return null;
    }
  }

  /**
   * Marks an article as read
   */
  async markArticleAsRead(
    articleId: string,
    articleTitle?: string,
    articleUrl?: string,
    originalRoutineDay?: string,
    routineDay?: string
  ): Promise<void> {
    try {
      const existingProgress = await this.getArticleProgress(articleId);

      // IMMUTABLE PROTECTION: Don't modify if already read
      if (existingProgress?.isRead) {
        return;
      }

      const progress: UserArticleProgress = {
        articleId,
        articleTitle,
        articleUrl,
        isRead: true,
        readAt: new Date().toISOString(),
        originalRoutineDay,
        routineDay,
      };

      await this.saveArticleProgress(progress);
    } catch (error) {
      console.error('Error marking article as read:', error);
      throw error;
    }
  }

  /**
   * Marks an article as unread (dev mode only)
   */
  async markArticleAsUnread(articleId: string): Promise<void> {
    try {
      const history = await this.getArticleHistory();
      const updatedHistory = history.filter(progress => progress.articleId !== articleId);

      await AsyncStorage.setItem(
        STORAGE_KEYS.ARTICLE_HISTORY,
        JSON.stringify(updatedHistory)
      );
    } catch (error) {
      console.error('Error marking article as unread:', error);
      throw error;
    }
  }

  /**
   * Get the read status of an article
   */
  async getArticleReadStatus(articleId: string): Promise<boolean> {
    try {
      const history = await this.getArticleHistory();
      const progress = history.find(progress => progress.articleId === articleId);

      return progress ? progress.isRead : false;
    } catch (error) {
      console.error('Error getting article read status:', error);
      throw error;
    }
  }

  /**
   * Adds an article to history if it doesn't already exist (without marking as read)
   */
  async addArticleToHistory(
    articleId: string,
    articleTitle?: string,
    articleUrl?: string
  ): Promise<void> {
    try {
      const existingProgress = await this.getArticleProgress(articleId);

      // If article already exists in history, skip
      if (existingProgress) {
        console.log(`📚 StorageService: Article ${articleId} already exists in history, skipping`);
        return;
      }

      console.log(`📝 StorageService: Adding new article ${articleId} to history with unread status`);

      // Add new article to history with unread status
      const progress: UserArticleProgress = {
        articleId,
        articleTitle,
        articleUrl,
        isRead: false,
        readAt: new Date().toISOString(),
      };

      await this.saveArticleProgress(progress);
      console.log(`✅ StorageService: Successfully added article ${articleId} to history`);
    } catch (error) {
      console.error('Error adding article to history:', error);
      throw error;
    }
  }

  /**
   * Updates scroll progress for an article
   */
  async updateScrollProgress(
    articleId: string,
    articleTitle?: string,
    articleUrl?: string
  ): Promise<void> {
    try {
      const existingProgress = await this.getArticleProgress(articleId);

      // IMMUTABLE PROTECTION: Don't update anything for read articles
      if (existingProgress?.isRead) {
        return;
      }

      const progress: UserArticleProgress = {
        articleId,
        articleTitle: articleTitle || existingProgress?.articleTitle,
        articleUrl: articleUrl || existingProgress?.articleUrl,
        isRead: existingProgress?.isRead ?? false, // Preserve existing isRead status
        readAt: existingProgress?.readAt, // Preserve existing readAt
      };

      await this.saveArticleProgress(progress);
    } catch (error) {
      console.error('Error updating scroll progress:', error);
      throw error;
    }
  }

  /**
   * Saves tag statistics
   */
  async saveTagStats(stats: TagStats): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.TAG_STATS,
        JSON.stringify(stats)
      );
    } catch (error) {
      console.error('Error saving tag stats:', error);
      throw error;
    }
  }

  /**
   * Gets tag statistics
   */
  async getTagStats(): Promise<TagStats> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.TAG_STATS);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error getting tag stats:', error);
      return {};
    }
  }

  /**
   * Updates tag statistics when an article is read
   */
  async updateTagStats(tags: string[]): Promise<void> {
    try {
      const stats = await this.getTagStats();

      tags.forEach(tag => {
        stats[tag] = (stats[tag] || 0) + 1;
      });

      await this.saveTagStats(stats);
    } catch (error) {
      console.error('Error updating tag stats:', error);
      throw error;
    }
  }

  /**
   * Saves theme preference
   */
  async saveThemePreference(themeMode: 'light' | 'dark' | 'system' | boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.THEME_PREFERENCE,
        JSON.stringify(themeMode)
      );
    } catch (error) {
      console.error('Error saving theme preference:', error);
      throw error;
    }
  }

  /**
   * Gets theme preference
   */
  async getThemePreference(): Promise<'light' | 'dark' | 'system' | boolean> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.THEME_PREFERENCE);
      return data ? JSON.parse(data) : 'system'; // Default to system theme
    } catch (error) {
      console.error('Error getting theme preference:', error);
      return 'system';
    }
  }

  /**
   * Saves the last fetch date
   */
  async saveLastFetchDate(date: string | null): Promise<void> {
    try {
      if (date === null) {
        await AsyncStorage.removeItem(STORAGE_KEYS.LAST_FETCH_DATE);
      } else {
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_FETCH_DATE, date);
      }
    } catch (error) {
      console.error('Error saving last fetch date:', error);
      throw error;
    }
  }

  /**
   * Gets the last fetch date
   */
  async getLastFetchDate(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.LAST_FETCH_DATE);
    } catch (error) {
      console.error('Error getting last fetch date:', error);
      return null;
    }
  }

  /**
   * Saves complete app state
   */
  async saveAppState(state: Partial<AppState>): Promise<void> {
    try {
      const currentState = await this.getAppState();
      const newState = { ...currentState, ...state };
      await AsyncStorage.setItem(
        STORAGE_KEYS.APP_STATE,
        JSON.stringify(newState)
      );
    } catch (error) {
      console.error('Error saving app state:', error);
      throw error;
    }
  }

  /**
   * Gets complete app state
   */
  async getAppState(): Promise<AppState> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.APP_STATE);
      if (data) {
        return JSON.parse(data);
      }

      // Return default state
      return {
        currentArticle: null,
        articleHistory: [],
        favorites: [],
        tagStats: {},
        isDarkTheme: false,
        lastFetchDate: null,
        translationSettings: {
          preferredLanguage: null,
          rememberLanguage: false,
          summaryFontSize: 'medium',
        },
        subscriptionStatus: {
          isActive: false,
          productId: null,
          purchaseTime: null,
          expiryTime: null,
          lastChecked: null,
        },
        backlogArticles: [],
        isViewingBacklogArticle: false,
        currentBacklogArticleId: null,
      };
    } catch (error) {
      console.error('Error getting app state:', error);
      return {
        currentArticle: null,
        articleHistory: [],
        favorites: [],
        tagStats: {},
        isDarkTheme: false,
        lastFetchDate: null,
        translationSettings: {
          preferredLanguage: null,
          rememberLanguage: false,
          summaryFontSize: 'medium',
        },
        subscriptionStatus: {
          isActive: false,
          productId: null,
          purchaseTime: null,
          expiryTime: null,
          lastChecked: null,
        },
        backlogArticles: [],
        isViewingBacklogArticle: false,
        currentBacklogArticleId: null,
      };
    }
  }

  /**
   * Saves a favorite article
   */
  async saveFavorite(favorite: FavoriteArticle): Promise<void> {
    try {
      const favorites = await this.getFavorites();
      const existingIndex = favorites.findIndex(fav => fav.id === favorite.id);

      if (existingIndex >= 0) {
        favorites[existingIndex] = favorite;
      } else {
        favorites.push(favorite);
      }

      await AsyncStorage.setItem(
        STORAGE_KEYS.FAVORITES,
        JSON.stringify(favorites)
      );
    } catch (error) {
      console.error('Error saving favorite:', error);
      throw error;
    }
  }

  /**
   * Gets all favorite articles
   */
  async getFavorites(): Promise<FavoriteArticle[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.FAVORITES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting favorites:', error);
      return [];
    }
  }

  /**
   * Removes a favorite article
   */
  async removeFavorite(articleId: string): Promise<void> {
    try {
      const favorites = await this.getFavorites();
      const filteredFavorites = favorites.filter(fav => fav.id !== articleId);

      await AsyncStorage.setItem(
        STORAGE_KEYS.FAVORITES,
        JSON.stringify(filteredFavorites)
      );
    } catch (error) {
      console.error('Error removing favorite:', error);
      throw error;
    }
  }

  /**
   * Saves translation settings
   */
  async saveTranslationSettings(settings: TranslationSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.TRANSLATION_SETTINGS,
        JSON.stringify(settings)
      );
    } catch (error) {
      console.error('Error saving translation settings:', error);
      throw error;
    }
  }

  /**
   * Gets translation settings
   */
  async getTranslationSettings(): Promise<TranslationSettings> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.TRANSLATION_SETTINGS);
      return data ? JSON.parse(data) : {
        preferredLanguage: null,
        rememberLanguage: false,
        summaryFontSize: 'medium',
      };
    } catch (error) {
      console.error('Error getting translation settings:', error);
      return {
        preferredLanguage: null,
        rememberLanguage: false,
        summaryFontSize: 'medium',
      };
    }
  }

  /**
   * Clears all stored data (useful for testing or reset)
   */
  async clearAllData(): Promise<void> {
    try {
      // First try AsyncStorage multiRemove
      const keys = Object.values(STORAGE_KEYS);
      await AsyncStorage.multiRemove(keys);

      // For web environments, also clear localStorage directly
      if (typeof window !== 'undefined' && window.localStorage) {
        const storageKeys = Object.values(STORAGE_KEYS);
        storageKeys.forEach(key => {
          window.localStorage.removeItem(key);
        });

        // Also remove any cache-related keys
        const allKeys = Object.keys(window.localStorage);
        allKeys.forEach(key => {
          if (key.startsWith('article_cache_') ||
              key.startsWith('cache_metadata') ||
              key.startsWith('reading_session_')) {
            window.localStorage.removeItem(key);
          }
        });

        console.log('All localStorage data cleared');
      }

      console.log('All storage data cleared successfully');
    } catch (error) {
      console.error('Error clearing all data:', error);
      throw error;
    }
  }

  /**
   * Gets storage info for debugging
   */
  async getStorageInfo(): Promise<{
    keys: string[];
    estimatedSize: number;
  }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let estimatedSize = 0;

      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          estimatedSize += value.length;
        }
      }

      return {
        keys: keys.filter(key =>
          Object.values(STORAGE_KEYS).some(storageKey =>
            key.startsWith(storageKey)
          )
        ),
        estimatedSize,
      };
    } catch (error) {
      console.error('Error getting storage info:', error);
      return { keys: [], estimatedSize: 0 };
    }
  }

  /**
   * Checks if an article can still be marked as read
   * 
   * Current behavior: Articles can be read on any day (no time restrictions).
   * This allows users to catch up on backlog articles at any time.
   * 
   * @param routineDay - The routine day of the article (currently unused)
   * @returns Always returns true
   * @deprecated This function always returns true. Consider removing it and 
   *             updating callers to not check readability restrictions.
   */
  isArticleReadable(_routineDay: string): boolean {
    // Articles can be read on any day - no date restrictions
    return true;
  }

  /**
   * Gets reading session data for an article
   */
  async getReadingSession(articleId: string): Promise<any> {
    try {
      const data = await AsyncStorage.getItem(
        `${STORAGE_KEYS.READING_SESSION}${articleId}`
      );
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting reading session:', error);
      return null;
    }
  }

  /**
   * Saves reading session data
   */
  async saveReadingSession(articleId: string, sessionData: any): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `${STORAGE_KEYS.READING_SESSION}${articleId}`,
        JSON.stringify(sessionData)
      );
    } catch (error) {
      console.error('Error saving reading session:', error);
      throw error;
    }
  }

  /**
   * Mark an article as liked by the user
   */
  async markArticleAsLiked(articleId: string): Promise<void> {
    try {
      const existingProgress = await this.getArticleProgress(articleId);

      // Create or update progress with liked status
      const progress: UserArticleProgress = {
        ...existingProgress,
        articleId,
        isRead: existingProgress?.isRead ?? false,
        voteStatus: 'liked',
        votedAt: new Date().toISOString(),
      };

      await this.saveArticleProgress(progress);
    } catch (error) {
      console.error('Error marking article as liked:', error);
      throw error;
    }
  }

  /**
   * Mark an article as disliked by the user
   */
  async markArticleAsDisliked(articleId: string): Promise<void> {
    try {
      const existingProgress = await this.getArticleProgress(articleId);

      // Create or update progress with disliked status
      const progress: UserArticleProgress = {
        ...existingProgress,
        articleId,
        isRead: existingProgress?.isRead ?? false,
        voteStatus: 'disliked',
        votedAt: new Date().toISOString(),
      };

      await this.saveArticleProgress(progress);
    } catch (error) {
      console.error('Error marking article as disliked:', error);
      throw error;
    }
  }

  /**
   * Remove the vote status of an article
   */
  async removeArticleVoteStatus(articleId: string): Promise<void> {
    try {
      const existingProgress = await this.getArticleProgress(articleId);

      // Create progress entry if it doesn't exist, or update existing one
      const progress: UserArticleProgress = {
        ...existingProgress,
        articleId,
        isRead: existingProgress?.isRead ?? false,
        voteStatus: null,
        votedAt: undefined, // Remove the votedAt timestamp when removing vote
      };

      await this.saveArticleProgress(progress);
    } catch (error) {
      console.error('Error removing article vote status:', error);
      throw error;
    }
  }

  /**
   * Get the vote status of an article
   */
  async getArticleVoteStatus(articleId: string): Promise<'liked' | 'disliked' | null> {
    try {
      const progress = await this.getArticleProgress(articleId);
      return progress?.voteStatus ?? null;
    } catch (error) {
      console.error('Error getting article vote status:', error);
      throw error;
    }
  }

  /**
   * Check if user has already voted on an article
   */
  async hasUserVoted(articleId: string): Promise<boolean> {
    try {
      const voteStatus = await this.getArticleVoteStatus(articleId);
      return voteStatus !== null;
    } catch (error) {
      console.error('Error checking if user has voted:', error);
      throw error;
    }
  }

  /**
   * Save delayed articles to storage
   */
  async saveBacklogArticles(backlogArticles: DelayedArticle[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.BACKLOG_ARTICLES,
        JSON.stringify(backlogArticles)
      );
    } catch (error) {
      console.error('Error saving backlog articles:', error);
      throw error;
    }
  }

  /**
   * Get delayed articles from storage
   */
  async getBacklogArticles(): Promise<DelayedArticle[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.BACKLOG_ARTICLES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting backlog articles:', error);
      return [];
    }
  }

  /**
   * Add an article to the backlog
   */
  async addToBacklog(article: Article): Promise<void> {
    try {
      const currentBacklog = await this.getBacklogArticles();
      const newDelayedArticle: DelayedArticle = {
        article,
        delayedAt: new Date().toISOString(),
        originalRoutineDay: article.routineDay,
      };

      // Add to beginning of array (most recent first)
      const updatedBacklog = [newDelayedArticle, ...currentBacklog];

      // Keep only the most recent 2 articles
      const limitedBacklog = updatedBacklog.slice(0, 2);

      await this.saveBacklogArticles(limitedBacklog);
    } catch (error) {
      console.error('Error adding article to backlog:', error);
      throw error;
    }
  }

  /**
   * Remove an article from the backlog
   */
  async removeFromBacklog(articleId: string): Promise<void> {
    try {
      const currentBacklog = await this.getBacklogArticles();
      const updatedBacklog = currentBacklog.filter(
        (delayedArticle) => delayedArticle.article.id !== articleId
      );
      await this.saveBacklogArticles(updatedBacklog);
    } catch (error) {
      console.error('Error removing article from backlog:', error);
      throw error;
    }
  }

  /**
   * Clean expired articles from backlog (older than 2 days)
   */
  async cleanExpiredBacklogArticles(): Promise<void> {
    try {
      const currentBacklog = await this.getBacklogArticles();
      // Calculate the date 2 days ago
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      // Filter out articles older than 2 days
      const validBacklog = currentBacklog.filter((delayedArticle) => {
        const delayedDate = new Date(delayedArticle.originalRoutineDay);
        return delayedDate.getDate() >= twoDaysAgo.getDate();
      });

      // Only update if there's a change
      if (validBacklog.length !== currentBacklog.length) {
        await this.saveBacklogArticles(validBacklog);
      }
    } catch (error) {
      console.error('Error cleaning expired backlog articles:', error);
      throw error;
    }
  }

  /**
   * Check if an article is in the backlog
   */
  async isArticleInBacklog(articleId: string): Promise<boolean> {
    try {
      const backlog = await this.getBacklogArticles();
      return backlog.some((delayedArticle) => delayedArticle.article.id === articleId);
    } catch (error) {
      console.error('Error checking if article is in backlog:', error);
      return false;
    }
  }

  /**
   * Save development day offset (DEV mode only)
   */
  async saveDevDayOffset(dayOffset: number): Promise<void> {
    try {
      if (!__DEV__) return;
      await AsyncStorage.setItem(STORAGE_KEYS.DEV_DAY_OFFSET, dayOffset.toString());
    } catch (error) {
      console.error('Error saving dev day offset:', error);
      throw error;
    }
  }

  /**
   * Get development day offset (DEV mode only)
   */
  async getDevDayOffset(): Promise<number> {
    try {
      if (!__DEV__) return 0;
      const data = await AsyncStorage.getItem(STORAGE_KEYS.DEV_DAY_OFFSET);
      return data ? parseInt(data, 10) : 0;
    } catch (error) {
      console.error('Error getting dev day offset:', error);
      return 0;
    }
  }

  /**
   * Clear development day offset (DEV mode only)
   */
  async clearDevDayOffset(): Promise<void> {
    try {
      if (!__DEV__) return;
      await AsyncStorage.removeItem(STORAGE_KEYS.DEV_DAY_OFFSET);
    } catch (error) {
      console.error('Error clearing dev day offset:', error);
      throw error;
    }
  }

  /**
   * Generic get method for any key
   */
  async get(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error(`Error getting key ${key}:`, error);
      return null;
    }
  }

  /**
   * Generic set method for any key
   */
  async set(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error(`Error setting key ${key}:`, error);
      throw error;
    }
  }
}

export const storageService = StorageService.getInstance();
export default storageService;
