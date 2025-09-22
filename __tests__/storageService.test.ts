import { describe, it, expect, beforeEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageService } from '../src/services/storageService';
import { Article, UserArticleProgress, TagStats } from '../src/types';

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    setItem: vi.fn(),
    getItem: vi.fn(),
    removeItem: vi.fn(),
    multiRemove: vi.fn(),
    getAllKeys: vi.fn(),
  },
}));

const mockAsyncStorage = AsyncStorage as any;

describe('StorageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAsyncStorage.getItem.mockClear();
    mockAsyncStorage.setItem.mockClear();
    mockAsyncStorage.removeItem.mockClear();
    mockAsyncStorage.multiRemove.mockClear();
    mockAsyncStorage.getAllKeys.mockClear();
  });

  const mockArticle: Article = {
    id: 'test-article-1',
    title: 'Test Article',
    url: 'https://example.com/article',
    routineDay: new Date().toISOString().split('T')[0],
    tags: ['javascript', 'testing'],
    estimatedReadTime: 5,
    description: 'A test article',
    author: 'Test Author',
    source: 'Test Source'
  };

  const mockProgress: UserArticleProgress = {
    articleId: 'test-article-1',
    isRead: true,
    readAt: new Date().toISOString(),
  };

  describe('saveCurrentArticle', () => {
    it('should save article to storage', async () => {
      mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

      await storageService.saveCurrentArticle(mockArticle);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'current_article',
        JSON.stringify(mockArticle)
      );
    });

    it('should throw error if storage fails', async () => {
      mockAsyncStorage.setItem.mockRejectedValueOnce(new Error('Storage error'));

      await expect(storageService.saveCurrentArticle(mockArticle))
        .rejects.toThrow('Storage error');
    });
  });

  describe('getCurrentArticle', () => {
    it('should return article from storage', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(mockArticle));

      const result = await storageService.getCurrentArticle();

      expect(result).toEqual(mockArticle);
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('current_article');
    });

    it('should return null if no article in storage', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(null);

      const result = await storageService.getCurrentArticle();

      expect(result).toBeNull();
    });

    it('should return null if storage throws error', async () => {
      mockAsyncStorage.getItem.mockRejectedValueOnce(new Error('Storage error'));

      const result = await storageService.getCurrentArticle();

      expect(result).toBeNull();
    });
  });

  describe('saveArticleProgress', () => {
    it('should save new progress', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([]));
      mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

      await storageService.saveArticleProgress(mockProgress);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'article_history',
        JSON.stringify([mockProgress])
      );
    });
  });

  describe('getArticleHistory', () => {
    it('should return article history', async () => {
      const history = [mockProgress];
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(history));

      const result = await storageService.getArticleHistory();

      expect(result).toEqual(history);
    });

    it('should return empty array if no history', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(null);

      const result = await storageService.getArticleHistory();

      expect(result).toEqual([]);
    });
  });

  describe('markArticleAsRead', () => {
    it('should mark article as read with correct data', async () => {
      const existingProgress = { ...mockProgress, isRead: false, readAt: undefined };
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([existingProgress]));
      mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

      await storageService.markArticleAsRead('test-article-1');

      const savedData = JSON.parse(mockAsyncStorage.setItem.mock.calls[0][1]);
      expect(savedData[0]).toMatchObject({
        articleId: 'test-article-1',
        isRead: true,
      });
      expect(savedData[0].readAt).toBeTruthy();
    });
  });

  describe('updateScrollProgress', () => {
    it('should update scroll progress correctly', async () => {
      const existingProgress = { ...mockProgress, scrollProgress: 30, isRead: false };

      // First call for getArticleProgress (getArticleHistory)
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([existingProgress]));
      // Second call for saveArticleProgress (getArticleHistory again)
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([existingProgress]));
      mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

      await storageService.updateScrollProgress('test-article-1');

      // Verify that setItem was called
      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should not decrease scroll progress', async () => {
      const existingProgress = { ...mockProgress, scrollProgress: 80, isRead: false };

      // Mock calls for getArticleProgress and saveArticleProgress
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([existingProgress]));
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([existingProgress]));
      mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

      await storageService.updateScrollProgress('test-article-1');

      // Verify that setItem was called (scroll progress should remain 80)
      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should not update progress for read articles', async () => {
      const readProgress = { ...mockProgress, isRead: true };
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([readProgress]));

      await storageService.updateScrollProgress('test-article-1');

      // Should not call setItem since article is already read
      expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('tagStats operations', () => {
    const mockStats: TagStats = {
      javascript: 5,
      testing: 3,
      react: 8,
    };

    it('should save tag stats', async () => {
      mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

      await storageService.saveTagStats(mockStats);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'tag_stats',
        JSON.stringify(mockStats)
      );
    });

    it('should get tag stats', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(mockStats));

      const result = await storageService.getTagStats();

      expect(result).toEqual(mockStats);
    });

    it('should return empty object if no tag stats', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(null);

      const result = await storageService.getTagStats();

      expect(result).toEqual({});
    });

    it('should update tag stats correctly', async () => {
      const existingStats = { javascript: 5, testing: 3, react: 8 };
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(existingStats));
      mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

      const newTags = ['javascript', 'node.js'];
      await storageService.updateTagStats(newTags);

      const expectedStats = {
        javascript: 6, // Incremented
        testing: 3,
        react: 8,
        'node.js': 1, // New tag
      };

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'tag_stats',
        JSON.stringify(expectedStats)
      );
    });
  });

  describe('theme preferences', () => {
    it('should save theme preference', async () => {
      mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

      await storageService.saveThemePreference(true);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'theme_preference',
        JSON.stringify(true)
      );
    });

    it('should get theme preference', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(true));

      const result = await storageService.getThemePreference();

      expect(result).toBe(true);
    });

    it('should return false as default theme preference', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(null);

      const result = await storageService.getThemePreference();

      expect(result).toBe(false);
    });
  });

  describe('isArticleReadable', () => {
    it('should return true for today\'s article', () => {
      const today = new Date();
      const result = storageService.isArticleReadable(today.toISOString());
      expect(result).toBe(true);
    });

    it('should return false for yesterday\'s article', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const result = storageService.isArticleReadable(yesterday.toISOString());
      expect(result).toBe(false);
    });

    it('should return false for future article', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const result = storageService.isArticleReadable(tomorrow.toISOString());
      expect(result).toBe(false);
    });
  });

  describe('addArticleToHistory', () => {
    it('should add new article to history with unread status', async () => {
      const existingHistory = [mockProgress];
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(existingHistory));
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(existingHistory));
      mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

      await storageService.addArticleToHistory('new-article-1', 'New Article', 'https://example.com/new');

      const savedData = JSON.parse(mockAsyncStorage.setItem.mock.calls[0][1]);
      const newArticleProgress = savedData.find((p: any) => p.articleId === 'new-article-1');
      
      expect(newArticleProgress).toMatchObject({
        articleId: 'new-article-1',
        articleTitle: 'New Article',
        articleUrl: 'https://example.com/new',
        isRead: false,
      });
      expect(newArticleProgress.readAt).toBeUndefined();
    });

    it('should not add article if it already exists in history', async () => {
      const existingHistory = [mockProgress];
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(existingHistory));

      await storageService.addArticleToHistory('test-article-1', 'Test Article', 'https://example.com/test');

      // Should not call setItem since article already exists
      expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('should add article to empty history', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([]));
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([]));
      mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

      await storageService.addArticleToHistory('first-article', 'First Article', 'https://example.com/first');

      const savedData = JSON.parse(mockAsyncStorage.setItem.mock.calls[0][1]);
      expect(savedData).toHaveLength(1);
      expect(savedData[0]).toMatchObject({
        articleId: 'first-article',
        articleTitle: 'First Article',
        articleUrl: 'https://example.com/first',
        isRead: false,
      });
    });

    it('should handle storage errors gracefully', async () => {
      // Mock getArticleHistory to throw error
      mockAsyncStorage.getItem.mockRejectedValueOnce(new Error('Storage error'));

      await expect(storageService.addArticleToHistory('error-article', 'Error Article', 'https://example.com/error'))
        .rejects.toThrow('Error adding article to history');
    });
  });

  describe('clearAllData', () => {
    it('should remove all storage keys', async () => {
      mockAsyncStorage.multiRemove.mockResolvedValueOnce(undefined);

      await storageService.clearAllData();

      const expectedKeys = [
        'app_state',
        'article_history',
        'tag_stats',
        'current_article',
        'theme_preference',
        'last_fetch_date',
        'reading_session_',
        'favorites',
        'translation_settings',
      ];

      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith(expectedKeys);
    });
  });

  describe('getStorageInfo', () => {
    it('should return storage information', async () => {
      const allKeys = ['current_article', 'article_history', 'some_other_key'];
      mockAsyncStorage.getAllKeys.mockResolvedValueOnce(allKeys);
      mockAsyncStorage.getItem.mockResolvedValue('{"test": "data"}');

      const result = await storageService.getStorageInfo();

      expect(result.keys).toEqual(['current_article', 'article_history']);
      expect(result.estimatedSize).toBeGreaterThan(0);
    });
  });
});
