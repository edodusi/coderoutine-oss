import { useState, useEffect, useCallback } from 'react';
import { Article, UserArticleProgress, ArticleWithProgress } from '../types';
import { firebaseService } from '../services/firebaseService';
import { useApp } from '../context/AppContext';

export interface UseTaggedArticlesResult {
  articles: ArticleWithProgress[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  selectedTags: string[];
  availableTags: string[];
  tagsLoading: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  setSelectedTags: (tags: string[]) => void;
  toggleTag: (tag: string) => void;
  clearTags: () => void;
}

export const useTaggedArticles = (pageSize: number = 20): UseTaggedArticlesResult => {
  const { state, getArticleWithProgress } = useApp();
  const [articles, setArticles] = useState<ArticleWithProgress[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [nextDocId, setNextDocId] = useState<string | null>(null);
  const [selectedTags, setSelectedTagsState] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);

  const mergeArticleWithProgress = useCallback((article: Article): ArticleWithProgress => {
    const progress = state.articleHistory.find(p => p.articleId === article.id);

    return {
      ...article,
      progress: progress || null,
      status: (progress?.isRead ? 'read' : 'unread') as 'read' | 'unread' | 'expired',
      isExpired: false,
      canMarkAsRead: true,
    };
  }, [state.articleHistory]);

  // Fetch available tags
  const fetchTags = useCallback(async () => {
    try {
      setTagsLoading(true);
      console.log('🏷️ useTaggedArticles: Fetching available tags...');
      
      const tags = await firebaseService.getAllTags();
      setAvailableTags(tags);
      console.log(`🏷️ useTaggedArticles: Found ${tags.length} tags`);
      
    } catch (err) {
      console.error('❌ useTaggedArticles: Error fetching tags:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tags');
    } finally {
      setTagsLoading(false);
    }
  }, []);

  // Fetch articles based on selected tags
  const fetchArticles = useCallback(async (tags: string[], lastDocId: string | null = null, append: boolean = false) => {
    try {
      console.log(`🔄 useTaggedArticles: Fetching articles for tags: [${tags.join(', ')}] (lastDocId: ${lastDocId || 'null'}, append: ${append}, pageSize: ${pageSize})`);
      setLoading(true);
      setError(null);

      let response;
      
      if (tags.length > 0) {
        console.log(`🏷️ useTaggedArticles: Fetching articles for tags: [${tags.join(', ')}]`);
        response = await firebaseService.getArticlesByTags(tags, pageSize, lastDocId);
      } else {
        console.log('📚 useTaggedArticles: No tags selected, fetching all articles');
        response = await firebaseService.getAllArticles(pageSize, lastDocId);
      }
      
      console.log(`📚 useTaggedArticles: Fetched ${response.articles.length} articles`);

      if (response.articles.length === 0 && !append) {
        console.log('📭 useTaggedArticles: No articles found for selected tags');
        setArticles([]);
        setHasMore(false);
        return;
      }

      const articlesWithProgress = response.articles.map(mergeArticleWithProgress);
      console.log(`🔗 useTaggedArticles: Merged ${articlesWithProgress.length} articles with local progress`);

      if (append) {
        setArticles(prev => {
          // Avoid duplicates by filtering out articles that already exist
          const existingIds = new Set(prev.map(a => a.id));
          const newArticles = articlesWithProgress.filter(a => !existingIds.has(a.id));
          console.log(`➕ useTaggedArticles: Adding ${newArticles.length} new articles to existing ${prev.length}`);
          return [...prev, ...newArticles];
        });
      } else {
        console.log(`🔄 useTaggedArticles: Replacing articles with ${articlesWithProgress.length} new items`);
        setArticles(articlesWithProgress);
      }

      // Update pagination state
      setHasMore(response.hasNextPage);
      setNextDocId(response.nextCursor);

      console.log(`🔄 useTaggedArticles: Updated pagination - hasMore: ${response.hasNextPage}, nextDocId: ${response.nextCursor ? 'present' : 'null'}`);
    } catch (err) {
      console.error('❌ useTaggedArticles: Error fetching articles:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch articles');
      if (!append) {
        setArticles([]);
      }
    } finally {
      setLoading(false);
    }
  }, [pageSize, mergeArticleWithProgress]);

  const loadMore = useCallback(async () => {
    if (!loading && hasMore) {
      await fetchArticles(selectedTags, nextDocId, true);
    }
  }, [fetchArticles, loading, hasMore, nextDocId, selectedTags]);

  const refresh = useCallback(async () => {
    setNextDocId(null);
    setHasMore(true);
    await fetchArticles(selectedTags, null, false);
  }, [fetchArticles, selectedTags]);

  const setSelectedTags = useCallback((tags: string[]) => {
    console.log(`🏷️ useTaggedArticles: Setting selected tags to: [${tags.join(', ')}]`);
    setSelectedTagsState(tags);
    setNextDocId(null);
    setHasMore(true);
    // Articles will be fetched in useEffect when selectedTags changes
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTagsState(prev => {
      const isSelected = prev.includes(tag);
      const newTags = isSelected 
        ? prev.filter(t => t !== tag)
        : [...prev, tag];
      
      console.log(`🏷️ useTaggedArticles: ${isSelected ? 'Removing' : 'Adding'} tag: ${tag}`);
      return newTags;
    });
    
    // Reset pagination state when tags change
    setNextDocId(null);
    setHasMore(true);
    setArticles([]); // Clear current articles to show loading state
  }, []);

  const clearTags = useCallback(() => {
    console.log('🏷️ useTaggedArticles: Clearing all selected tags');
    setSelectedTagsState([]);
    setNextDocId(null);
    setHasMore(true);
  }, []);

  // Initial fetch of tags
  useEffect(() => {
    console.log('🚀 useTaggedArticles: Initial tags fetch triggered');
    fetchTags();
  }, [fetchTags]);

  // Fetch articles when selected tags change
  useEffect(() => {
    console.log('🚀 useTaggedArticles: Fetching articles for tag selection change');
    // Small delay to prevent rapid fire queries when multiple tags are selected quickly
    const timeoutId = setTimeout(() => {
      fetchArticles(selectedTags, null, false);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [selectedTags]); // Only depend on selectedTags, not fetchArticles to avoid infinite loop

  // Re-merge articles when local progress changes
  useEffect(() => {
    if (articles.length > 0) {
      console.log(`🔄 useTaggedArticles: Re-merging ${articles.length} articles with updated local progress`);
      const updatedArticles = articles.map(article => {
        const progress = state.articleHistory.find(p => p.articleId === article.id);
        return {
          ...article,
          progress: progress || null,
          status: (progress?.isRead ? 'read' : 'unread') as 'read' | 'unread' | 'expired',
          isExpired: false,
          canMarkAsRead: true,
        };
      });
      setArticles(updatedArticles);
    }
  }, [state.articleHistory]);

  return {
    articles,
    loading,
    error,
    hasMore,
    selectedTags,
    availableTags,
    tagsLoading,
    loadMore,
    refresh,
    setSelectedTags,
    toggleTag,
    clearTags,
  };
};