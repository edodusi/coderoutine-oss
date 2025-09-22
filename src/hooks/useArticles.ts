import { useState, useEffect, useCallback } from 'react';
import { Article, UserArticleProgress, ArticleWithProgress } from '../types';
import { firebaseService } from '../services/firebaseService';
import { useApp } from '../context/AppContext';

export interface UseArticlesResult {
  articles: ArticleWithProgress[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useArticles = (pageSize: number = 20): UseArticlesResult => {
  const { state, getArticleWithProgress } = useApp();
  const [articles, setArticles] = useState<ArticleWithProgress[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [nextDocId, setNextDocId] = useState<string | null>(null);

  const mergeArticleWithProgress = useCallback((article: Article): ArticleWithProgress => {
    const progress = state.articleHistory.find(p => p.articleId === article.id);

    return {
      ...article,
      progress: progress || null,
      status: (progress?.isRead ? 'read' : 'unread') as 'read' | 'unread' | 'expired',
      isExpired: false, // We can implement expiry logic later if needed
      canMarkAsRead: true, // We can implement read restrictions later if needed
    };
  }, [state.articleHistory]);

  const fetchArticles = useCallback(async (lastDocId: string | null = null, append: boolean = false) => {
    try {
      console.log(`🔄 useArticles: Fetching articles (lastDocId: ${lastDocId || 'null'}, append: ${append}, pageSize: ${pageSize})`);
      setLoading(true);
      setError(null);

      const response = await firebaseService.getAllArticles(pageSize, lastDocId);
      console.log(`📚 useArticles: Fetched ${response.articles.length} articles from Firebase`);

      if (response.articles.length === 0) {
        console.log('📭 useArticles: No more articles available');
        setHasMore(false);
        if (!append) {
          setArticles([]);
        }
        return;
      }

      const articlesWithProgress = response.articles.map(mergeArticleWithProgress);
      console.log(`🔗 useArticles: Merged ${articlesWithProgress.length} articles with local progress`);

      if (append) {
        setArticles(prev => {
          // Avoid duplicates by filtering out articles that already exist
          const existingIds = new Set(prev.map(a => a.id));
          const newArticles = articlesWithProgress.filter(a => !existingIds.has(a.id));
          console.log(`➕ useArticles: Adding ${newArticles.length} new articles to existing ${prev.length}`);
          return [...prev, ...newArticles];
        });
      } else {
        console.log(`🔄 useArticles: Replacing articles with ${articlesWithProgress.length} new items`);
        setArticles(articlesWithProgress);
      }

      // Update pagination state
      setHasMore(response.hasNextPage);
      setNextDocId(response.nextCursor);

      console.log(`🔄 useArticles: Updated pagination - hasMore: ${response.hasNextPage}, nextDocId: ${response.nextCursor ? 'present' : 'null'}`);
    } catch (err) {
      console.error('❌ useArticles: Error fetching articles:', err);
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
      await fetchArticles(nextDocId, true);
    }
  }, [fetchArticles, loading, hasMore, nextDocId]);

  const refresh = useCallback(async () => {
    setNextDocId(null);
    setHasMore(true);
    await fetchArticles(null, false);
  }, [fetchArticles]);

  // Initial fetch
  useEffect(() => {
    console.log('🚀 useArticles: Initial fetch triggered');
    fetchArticles(null, false);
  }, []);

  // Re-merge articles when local progress changes
  useEffect(() => {
    if (articles.length > 0) {
      console.log(`🔄 useArticles: Re-merging ${articles.length} articles with updated local progress`);
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
    loadMore,
    refresh,
  };
};

export const useHomeArticles = (): UseArticlesResult => {
  return useArticles(5);
};
