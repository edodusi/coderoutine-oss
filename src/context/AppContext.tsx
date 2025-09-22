import React, { createContext, useContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import { AppState as RNAppState } from 'react-native';
import { Article, UserArticleProgress, TagStats, AppState, ArticleWithProgress, ReadStatus, FavoriteArticle, TranslationSettings, SubscriptionStatus, DelayedArticle } from '../types';
import { storageService } from '../services/storageService';
import { firebaseService } from '../services/firebaseService';
import { useSubscription } from '../hooks/useSubscription';
import { articleCacheService } from '../services/articleCacheService';
import { clearAllPremiumAccessCaches } from '../hooks/usePremiumAccess';

// Action types
type AppAction =
  | { type: 'SET_CURRENT_ARTICLE'; payload: Article | null }
  | { type: 'SET_ARTICLE_HISTORY'; payload: UserArticleProgress[] }
  | { type: 'UPDATE_ARTICLE_PROGRESS'; payload: UserArticleProgress }
  | { type: 'ADD_ARTICLE_TO_HISTORY'; payload: { articleId: string; articleTitle?: string; articleUrl?: string } }
  | { type: 'SET_TAG_STATS'; payload: TagStats }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_LAST_FETCH_DATE'; payload: string | null }
  | { type: 'MARK_ARTICLE_READ'; payload: { articleId: string; tags: string[] } }
  | { type: 'MARK_ARTICLE_UNREAD'; payload: { articleId: string } }
  | { type: 'ADD_FAVORITE'; payload: FavoriteArticle }
  | { type: 'REMOVE_FAVORITE'; payload: string }
  | { type: 'SET_FAVORITES'; payload: FavoriteArticle[] }
  | { type: 'SET_TRANSLATION_SETTINGS'; payload: TranslationSettings }
  | { type: 'SET_SUBSCRIPTION_STATUS'; payload: SubscriptionStatus }
  | { type: 'SET_BACKLOG_ARTICLES'; payload: DelayedArticle[] }
  | { type: 'ADD_TO_BACKLOG'; payload: DelayedArticle }
  | { type: 'REMOVE_FROM_BACKLOG'; payload: string }
  | { type: 'SET_VIEWING_BACKLOG_ARTICLE'; payload: { isViewing: boolean; articleId: string | null } }
  | { type: 'RESET_STATE' };

// Extended app state with UI state
interface ExtendedAppState extends AppState {
  isLoading: boolean;
  error: string | null;
}

const initialState: ExtendedAppState = {
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
  isLoading: false,
  error: null,
};

// Reducer function
const appReducer = (state: ExtendedAppState, action: AppAction): ExtendedAppState => {
  switch (action.type) {
    case 'SET_CURRENT_ARTICLE':
      return {
        ...state,
        currentArticle: action.payload,
        error: null,
      };

    case 'SET_ARTICLE_HISTORY':
      return {
        ...state,
        articleHistory: action.payload,
      };

    case 'UPDATE_ARTICLE_PROGRESS':
      const updatedHistory = state.articleHistory.filter(
        progress => progress.articleId !== action.payload.articleId
      );
      updatedHistory.push(action.payload);
      return {
        ...state,
        articleHistory: updatedHistory,
      };

    case 'ADD_ARTICLE_TO_HISTORY':
      const { articleId: newArticleId, articleTitle: newArticleTitle, articleUrl: newArticleUrl } = action.payload;
      // Check if article already exists in history
      const existsInHistory = state.articleHistory.some(p => p.articleId === newArticleId);
      if (existsInHistory) {
        console.log(`📚 Article ${newArticleId} already exists in history, skipping`);
        return state; // Don't modify if already exists
      }

      // Add new article with unread status
      const newArticleProgress: UserArticleProgress = {
        articleId: newArticleId,
        articleTitle: newArticleTitle,
        articleUrl: newArticleUrl,
        isRead: false,
        readAt: new Date().toISOString(),
      };

      const historyWithNewArticle = [...state.articleHistory, newArticleProgress];
      console.log(`✅ Added article ${newArticleId} to history with unread status`);
      return {
        ...state,
        articleHistory: historyWithNewArticle,
      };

    case 'SET_TAG_STATS':
      return {
        ...state,
        tagStats: action.payload,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case 'SET_LAST_FETCH_DATE':
      return {
        ...state,
        lastFetchDate: action.payload,
      };

    case 'MARK_ARTICLE_READ':
      const { articleId, tags } = action.payload;
      const updatedTagStats = { ...state.tagStats };

      // Update tag statistics
      tags.forEach(tag => {
        updatedTagStats[tag] = (updatedTagStats[tag] || 0) + 1;
      });

      // Update article progress
      const existingProgress = state.articleHistory.find(p => p.articleId === articleId);
      console.log(`📖 Existing progress:`, existingProgress);
      const newProgress: UserArticleProgress = {
        ...existingProgress,
        articleId,
        isRead: true,
        readAt: new Date().toISOString(),
      };
      const newHistory = state.articleHistory.filter(p => p.articleId !== articleId);
      newHistory.push(newProgress);

      console.log(`🎯 Article ${articleId} isRead in new history:`, newHistory.find(p => p.articleId === articleId)?.isRead);

      const newState = {
        ...state,
        articleHistory: newHistory,
        tagStats: updatedTagStats,
      };

      return newState;

    case 'MARK_ARTICLE_UNREAD':
      console.log(`🔄 Reducer: Processing MARK_ARTICLE_UNREAD for ${action.payload.articleId}`);
      const filteredHistory = state.articleHistory.filter(progress => progress.articleId !== action.payload.articleId);
      console.log(`🔄 Reducer: Filtered history length:`, filteredHistory.length);
      return {
        ...state,
        articleHistory: filteredHistory,
      };

    case 'ADD_FAVORITE':
      const newFavorites = state.favorites.filter(fav => fav.id !== action.payload.id);
      newFavorites.push(action.payload);
      return {
        ...state,
        favorites: newFavorites,
      };

    case 'REMOVE_FAVORITE':
      return {
        ...state,
        favorites: state.favorites.filter(fav => fav.id !== action.payload),
      };

    case 'SET_FAVORITES':
      return {
        ...state,
        favorites: action.payload,
      };

    case 'SET_TRANSLATION_SETTINGS':
      return {
        ...state,
        translationSettings: action.payload,
      };

    case 'SET_SUBSCRIPTION_STATUS':
      return {
        ...state,
        subscriptionStatus: action.payload,
      };

    case 'SET_BACKLOG_ARTICLES':
      return {
        ...state,
        backlogArticles: action.payload,
      };

    case 'ADD_TO_BACKLOG':
      const updatedBacklog = [action.payload, ...state.backlogArticles];
      // Keep only the most recent 2 articles
      const limitedBacklog = updatedBacklog.slice(0, 2);
      return {
        ...state,
        backlogArticles: limitedBacklog,
      };

    case 'REMOVE_FROM_BACKLOG':
      return {
        ...state,
        backlogArticles: state.backlogArticles.filter(
          delayedArticle => delayedArticle.article.id !== action.payload
        ),
      };

    case 'SET_VIEWING_BACKLOG_ARTICLE':
      return {
        ...state,
        isViewingBacklogArticle: action.payload.isViewing,
        currentBacklogArticleId: action.payload.articleId,
      };

    case 'RESET_STATE':
      return initialState;

    default:
      return state;
  }
};

// Context interface
interface AppContextType {
  state: ExtendedAppState;

  // Article management
  fetchTodaysArticle: () => Promise<void>;
  refreshTodaysArticle: () => Promise<boolean>; // Returns true if article changed
  addArticleToHistory: (articleId: string, articleTitle?: string, articleUrl?: string) => Promise<void>;
  markArticleAsRead: (articleId: string, tags: string[], readTime?: number, reachedBottom?: boolean) => Promise<void>;
  markArticleAsUnread: (articleId: string) => Promise<void>; // Dev mode only

  // History and stats
  getArticleWithProgress: (article: Article) => ArticleWithProgress;
  getReadableArticles: () => ArticleWithProgress[];
  getUnreadArticles: () => ArticleWithProgress[];

  // Utility functions
  isArticleReadToday: (articleId: string) => boolean;
  canMarkAsRead: (routineDay: string) => boolean;
  getReadingStreak: () => number;
  getTotalReadArticles: () => number;

  // Favorites management
  addFavorite: (article: Article) => Promise<void>;
  removeFavorite: (articleId: string) => Promise<void>;
  isFavorite: (articleId: string) => boolean;
  getFavorites: () => FavoriteArticle[];

  // Voting management
  markArticleAsLiked: (articleId: string) => Promise<void>;
  markArticleAsDisliked: (articleId: string) => Promise<void>;
  removeUpvoteFromArticle: (articleId: string) => Promise<void>;
  removeDownvoteFromArticle: (articleId: string) => Promise<void>;
  getArticleVoteStatus: (articleId: string) => Promise<'liked' | 'disliked' | null>;
  hasUserVoted: (articleId: string) => Promise<boolean>;
  updateArticleVoteCounts: (articleId: string, likeChange: number, dislikeChange: number) => void;

  // Error handling
  clearError: () => void;

  // Translation settings
  updateTranslationSettings: (settings: Partial<TranslationSettings>) => Promise<void>;

  // Backlog management
  addToBacklog: (article: Article) => Promise<void>;
  removeFromBacklog: (articleId: string) => Promise<void>;
  getBacklogArticles: () => DelayedArticle[];
  cleanExpiredBacklogArticles: () => Promise<void>;
  isArticleInBacklog: (articleId: string) => boolean;
  setViewingBacklogArticle: (isViewing: boolean, articleId?: string) => void;
  getDisplayedArticle: () => Article | null; // Returns current article or backlog article being viewed

  // Subscription management
  subscriptionStatus: SubscriptionStatus;
  isSubscribed: boolean;
  subscriptionConnected: boolean;
  subscriptionPrice: string;
  purchaseLoading: boolean;
  restoreLoading: boolean;
  subscriptionInitializing: boolean;
  purchaseSubscription: () => Promise<void>;
  restorePurchases: () => Promise<void>;
  refreshSubscriptionStatus: () => Promise<void>;

  // New RevenueCat specific properties
  offerings: any;
  customerInfo: any;
  offeringsLoading: boolean;
  subscriptionError: string | null;
  clearSubscriptionError: () => void;

  // Data management
  refreshData: () => Promise<void>;
  resetAppData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Fetch today's article
  const fetchTodaysArticle = useCallback(async (): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      const articleData = await firebaseService.getTodaysArticle();
      console.log('AppContext - articleData received:', articleData?.article.title);

      if (articleData) {
        const { article } = articleData;
        console.log('AppContext - article to save:', article.id, article.title);

        // Save article and update state
        await storageService.saveCurrentArticle(article);
        await storageService.saveLastFetchDate(new Date().toISOString());

        // Add article to history if it doesn't already exist
        console.log(`📝 Adding article ${article.id} to history if not already present`);
        await storageService.addArticleToHistory(article.id, article.title, article.url);

        dispatch({ type: 'SET_CURRENT_ARTICLE', payload: article });
        dispatch({ type: 'SET_LAST_FETCH_DATE', payload: new Date().toISOString() });
        dispatch({ type: 'ADD_ARTICLE_TO_HISTORY', payload: {
          articleId: article.id,
          articleTitle: article.title,
          articleUrl: article.url
        } });

        console.log('✅ Today\'s article fetched and added to history:', article.title);
      } else {
        console.log('AppContext - No article data received');
        dispatch({ type: 'SET_ERROR', payload: 'No article available for today' });
      }
    } catch (error) {
      console.error('Error fetching today\'s article:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to fetch today\'s article' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  // Refresh today's article and check if it changed
  const refreshTodaysArticle = useCallback(async (): Promise<boolean> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      const currentArticleId = state.currentArticle?.id || null;
      console.log('AppContext - current article ID:', currentArticleId);

      const articleData = await firebaseService.getTodaysArticle();
      console.log('AppContext - new articleData received:', articleData);

      if (articleData) {
        const { article } = articleData;
        const newArticleId = article.id;

        console.log('AppContext - comparing IDs:', { currentArticleId, newArticleId });

        // Check if article changed by comparing IDs
        const articleChanged = currentArticleId !== newArticleId;

        if (articleChanged || currentArticleId === null) {
          console.log('AppContext - article changed or is new, updating...');

          // Save new article and update state
          await storageService.saveCurrentArticle(article);
          await storageService.saveLastFetchDate(new Date().toISOString());

          // Add article to history if it doesn't already exist
          console.log(`📝 Adding refreshed article ${article.id} to history if not already present`);
          await storageService.addArticleToHistory(article.id, article.title, article.url);

          dispatch({ type: 'SET_CURRENT_ARTICLE', payload: article });
          dispatch({ type: 'SET_LAST_FETCH_DATE', payload: new Date().toISOString() });
          dispatch({ type: 'ADD_ARTICLE_TO_HISTORY', payload: {
            articleId: article.id,
            articleTitle: article.title,
            articleUrl: article.url
          } });

          console.log('✅ Today\'s article updated and added to history:', article.title);
          return true; // Article changed
        } else {
          console.log('AppContext - same article, no update needed');
          return false; // Article didn't change
        }
      } else {
        console.log('AppContext - No article data received');
        dispatch({ type: 'SET_ERROR', payload: 'No article available for today' });
        return false;
      }
    } catch (error) {
      console.error('Error refreshing today\'s article:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to refresh today\'s article' });
      return false;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.currentArticle?.id]);

  // Initialize app data on mount (for splash screen)
  useEffect(() => {
    const initializeAppData = async () => {
      try {
        // Load saved data first
        const articleHistory = await storageService.getArticleHistory();
        const tagStats = await storageService.getTagStats();
        const favorites = await storageService.getFavorites();
        const currentArticle = await storageService.getCurrentArticle();
        const lastFetchDate = await storageService.getLastFetchDate();
        const translationSettings = await storageService.getTranslationSettings();
        const backlogArticles = await storageService.getBacklogArticles();

        dispatch({ type: 'SET_CURRENT_ARTICLE', payload: currentArticle });
        dispatch({ type: 'SET_ARTICLE_HISTORY', payload: articleHistory });
        dispatch({ type: 'SET_TAG_STATS', payload: tagStats });
        dispatch({ type: 'SET_FAVORITES', payload: favorites });
        dispatch({ type: 'SET_LAST_FETCH_DATE', payload: lastFetchDate });
        dispatch({ type: 'SET_TRANSLATION_SETTINGS', payload: translationSettings });
        dispatch({ type: 'SET_BACKLOG_ARTICLES', payload: backlogArticles });

        // Clean expired backlog articles on app start
        await storageService.cleanExpiredBacklogArticles();
        const cleanedBacklog = await storageService.getBacklogArticles();
        if (cleanedBacklog.length !== backlogArticles.length) {
          dispatch({ type: 'SET_BACKLOG_ARTICLES', payload: cleanedBacklog });
        }

        console.log('AppContext - App data loaded successfully');
      } catch (error) {
        console.error('Error loading app data:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to load app data' });
      }
    };

    initializeAppData();
  }, []);





  // Add article to history without marking as read
  const addArticleToHistory = useCallback(async (
    articleId: string,
    articleTitle?: string,
    articleUrl?: string
  ): Promise<void> => {
    try {
      // Add to storage
      await storageService.addArticleToHistory(articleId, articleTitle, articleUrl);

      // Update state
      dispatch({ type: 'ADD_ARTICLE_TO_HISTORY', payload: {
        articleId,
        articleTitle,
        articleUrl
      } });

      console.log(`📝 Article ${articleId} added to history`);
    } catch (error) {
      console.error('Error adding article to history:', error);
    }
  }, []);

  // Mark article as unread (dev mode only)
  const markArticleAsUnread = useCallback(async (articleId: string): Promise<void> => {
    try {
      if (!__DEV__) {
        console.warn('markArticleAsUnread is only available in development mode');
        return;
      }

      // Update storage
      await storageService.markArticleAsUnread(articleId);

      // Update state immediately
      console.log(`🔄 AppContext: Dispatching MARK_ARTICLE_UNREAD for ${articleId}`);
      dispatch({ type: 'MARK_ARTICLE_UNREAD', payload: { articleId } });

    } catch (error) {
      console.error('Error marking article as unread:', error);
    }
  }, []);

  // Get article with progress information
  const getArticleWithProgress = useCallback((article: Article): ArticleWithProgress => {
    const progress = state.articleHistory.find(p => p.articleId === article.id) || null;
    const isExpired = !canMarkAsRead(article.routineDay);

    let status: ReadStatus = 'unread';
    if (progress?.isRead) {
      status = 'read';
    } else if (isExpired) {
      status = 'expired';
    }

    return {
      ...article,
      progress,
      status,
      isExpired,
      canMarkAsRead: canMarkAsRead(article.routineDay),
    };
  }, [state.articleHistory]);

  // Get readable articles (today's article if not expired)
  const getReadableArticles = (): ArticleWithProgress[] => {
    if (!state.currentArticle) return [];

    const articleWithProgress = getArticleWithProgress(state.currentArticle);
    return articleWithProgress.canMarkAsRead ? [articleWithProgress] : [];
  };

  // Get unread articles
  const getUnreadArticles = (): ArticleWithProgress[] => {
    if (!state.currentArticle) return [];

    const articleWithProgress = getArticleWithProgress(state.currentArticle);
    return articleWithProgress.status === 'unread' ? [articleWithProgress] : [];
  };

  // Check if article was read today
  const isArticleReadToday = (articleId: string): boolean => {
    const progress = state.articleHistory.find(p => p.articleId === articleId);
    if (!progress || !progress.isRead || !progress.readAt) return false;

    const readDate = new Date(progress.readAt).toDateString();
    const today = new Date().toDateString();
    return readDate === today;
  };

  // Check if article can be marked as read (only on routine day)
  const canMarkAsRead = (routineDay: string): boolean => {
    return storageService.isArticleReadable(routineDay);
  };

  // Get reading streak
  const getReadingStreak = (): number => {
    // 1. Filter for read articles with a valid date and sort them from most to least recent.
    const readArticles = state.articleHistory
      .filter(p => p.isRead && p.readAt)
      .sort((a, b) => new Date(b.readAt!).getTime() - new Date(a.readAt!).getTime());

    // Create a set of dates that count towards streak preservation
    const streakPreservingDates = new Set<string>();

    // Smart routine day inference for articles read on the same day
    const inferRoutineDays = (articles: typeof readArticles) => {
      // Group articles by read date
      const articlesByReadDate = new Map<string, typeof readArticles>();

      articles.forEach(article => {
        if (article.readAt) {
          const readDate = new Date(article.readAt);
          const dateStr = readDate.getUTCFullYear() + '-' +
                         String(readDate.getUTCMonth() + 1).padStart(2, '0') + '-' +
                         String(readDate.getUTCDate()).padStart(2, '0');

          if (!articlesByReadDate.has(dateStr)) {
            articlesByReadDate.set(dateStr, []);
          }
          articlesByReadDate.get(dateStr)!.push(article);
        }
      });

      const routineDays = new Map<string, string>();

      articlesByReadDate.forEach((articlesOnDate, readDateStr) => {
        if (articlesOnDate.length === 1) {
          // Single article read on this date - assume it was for that day
          const article = articlesOnDate[0];
          if (article.routineDay) {
            routineDays.set(article.articleId, article.routineDay);
          } else {
            routineDays.set(article.articleId, readDateStr);
          }
        } else {
          // Multiple articles read on same date - infer they were catching up
          // Sort by article ID to get consistent ordering
          const sortedArticles = [...articlesOnDate].sort((a, b) => a.articleId.localeCompare(b.articleId));

          sortedArticles.forEach((article, index) => {
            if (article.routineDay) {
              routineDays.set(article.articleId, article.routineDay);
            } else {
              // Assume articles were for consecutive days going backwards from read date
              const readDate = new Date(readDateStr + 'T00:00:00.000Z');
              readDate.setUTCDate(readDate.getUTCDate() - index);
              const inferredRoutineDay = readDate.getUTCFullYear() + '-' +
                                       String(readDate.getUTCMonth() + 1).padStart(2, '0') + '-' +
                                       String(readDate.getUTCDate()).padStart(2, '0');
              routineDays.set(article.articleId, inferredRoutineDay);
            }
          });
        }
      });

      return routineDays;
    };

    const articleRoutineDays = inferRoutineDays(readArticles);

    // Add routine day dates for read articles
    readArticles.forEach(article => {
      const routineDay = articleRoutineDays.get(article.articleId);
      if (routineDay) {
        streakPreservingDates.add(routineDay);
      }
    });

    // Add delayed article dates (delay preserves streak for the original routine day)
    state.backlogArticles.forEach(delayedArticle => {
      // originalRoutineDay is already in YYYY-MM-DD format
      streakPreservingDates.add(delayedArticle.originalRoutineDay);
    });

    // Add original routine days for read postponed articles
    readArticles.forEach(article => {
      if (article.originalRoutineDay) {
        // originalRoutineDay is already in YYYY-MM-DD format
        streakPreservingDates.add(article.originalRoutineDay);
      }
    });

    // Get today's date string
    const today = new Date();
    const todayStr = today.getUTCFullYear() + '-' +
                    String(today.getUTCMonth() + 1).padStart(2, '0') + '-' +
                    String(today.getUTCDate()).padStart(2, '0');

    // CRUCIAL: Streak must start from TODAY and go backwards consecutively
    // If today is not read, streak is 0
    if (!streakPreservingDates.has(todayStr)) {
      return 0;
    }

    // Count consecutive days starting from today going backwards
    let streak = 0;
    let checkDate = new Date(todayStr + 'T00:00:00.000Z');

    while (true) {
      const checkDateStr = checkDate.getUTCFullYear() + '-' +
                           String(checkDate.getUTCMonth() + 1).padStart(2, '0') + '-' +
                           String(checkDate.getUTCDate()).padStart(2, '0');

      const hasActivity = streakPreservingDates.has(checkDateStr);
      
      if (hasActivity) {
        streak++;
        // Move to previous day
        checkDate.setUTCDate(checkDate.getUTCDate() - 1);
      } else {
        break;
      }
    }

    // Apply the maximum streak logic (cycle every 7 days)
    if (streak > 7) {
      return (streak - 1) % 7 + 1;
    }

    return streak;
  };

  // Get total read articles
  const getTotalReadArticles = (): number => {
    return state.articleHistory.filter(p => p.isRead).length;
  };

  // Clear error
  const clearAppError = useCallback((): void => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  // Update translation settings
  const updateTranslationSettings = useCallback(async (settings: Partial<TranslationSettings>): Promise<void> => {
    try {
      // Save to storage
      const updatedSettings = {
        ...state.translationSettings,
        ...settings,
      };

      dispatch({ type: 'SET_TRANSLATION_SETTINGS', payload: updatedSettings });
      await storageService.saveTranslationSettings(updatedSettings);

      console.log('Translation settings updated:', updatedSettings);
    } catch (error) {
      console.error('Error updating translation settings:', error);
    }
  }, []);

  // Use subscription hook for IAP functionality
  const {
    isSubscribed,
    offerings,
    customerInfo,
    purchaseLoading,
    restoreLoading,
    offeringsLoading,
    purchaseSubscription: purchasePackage,
    restorePurchases,
    refreshCustomerInfo,
    lastError,
    clearError: clearSubscriptionError,
  } = useSubscription();

  // Update app state when subscription status changes
  useEffect(() => {
    const activeEntitlement = customerInfo?.entitlements.active ?
      Object.values(customerInfo.entitlements.active)[0] : null;

    const subscriptionStatus = {
      isActive: isSubscribed,
      productId: activeEntitlement?.productIdentifier || null,
      purchaseTime: activeEntitlement?.originalPurchaseDate || null,
      expiryTime: activeEntitlement?.expirationDate || null,
      lastChecked: new Date().toISOString(),
    };
    dispatch({ type: 'SET_SUBSCRIPTION_STATUS', payload: subscriptionStatus });

    // Clear premium access caches when subscription status changes
    console.log('🔄 Subscription status changed, clearing premium access caches');
    clearAllPremiumAccessCaches();
  }, [isSubscribed, customerInfo]);

  // Listen for app state changes to refresh subscription status
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        // Refresh subscription status when app becomes active
        console.log('App became active - refreshing subscription status');
        refreshCustomerInfo();
      }
    };

    const subscription = RNAppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [refreshCustomerInfo]);

  // Refresh all data
  const refreshData = useCallback(async (): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      // Refresh from storage
      const articleHistory = await storageService.getArticleHistory();
      const tagStats = await storageService.getTagStats();
      const backlogArticles = await storageService.getBacklogArticles();

      dispatch({ type: 'SET_ARTICLE_HISTORY', payload: articleHistory });
      dispatch({ type: 'SET_TAG_STATS', payload: tagStats });
      dispatch({ type: 'SET_BACKLOG_ARTICLES', payload: backlogArticles });

      // Check for new article
      await fetchTodaysArticle();

      // Get cache stats for debugging
      try {
        const cacheStats = await articleCacheService.getCacheStats();
        console.log('Cache stats:', cacheStats);
      } catch (error) {
        console.log('Could not get cache stats:', error);
      }
    } catch (error) {
      console.error('Error refreshing app data:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [fetchTodaysArticle]);

  // Reset all app data
  const resetAppData = useCallback(async (): Promise<void> => {
    try {
      // Clear storage service data
      await storageService.clearAllData();

      // Clear article cache
      await articleCacheService.clearCache();

      // Clear browser storage if available
      if (typeof window !== 'undefined') {
        // Clear localStorage
        try {
          window.localStorage.clear();
        } catch (e) {
          console.warn('Could not clear localStorage:', e);
        }

        // Clear sessionStorage
        try {
          window.sessionStorage.clear();
        } catch (e) {
          console.warn('Could not clear sessionStorage:', e);
        }

        // Clear IndexedDB if possible
        try {
          if ('indexedDB' in window) {
            // This is a simplified approach - in production you'd want to iterate through databases
            console.log('ℹ️ IndexedDB databases may need manual clearing');
          }
        } catch (e) {
          console.warn('Could not access IndexedDB:', e);
        }
      }

      // Reset app state
      dispatch({ type: 'RESET_STATE' });

      // Force refresh the current article
      await fetchTodaysArticle();
    } catch (error) {
      console.error('Error resetting app data:', error);
      throw error;
    }
  }, [fetchTodaysArticle]);

  // Add favorite article
  const addFavorite = useCallback(async (article: Article): Promise<void> => {
    try {
      const favorite: FavoriteArticle = {
        id: article.id,
        title: article.title,
        url: article.url,
        favoritedAt: new Date().toISOString(),
        routineDay: article.routineDay,
        tags: article.tags,
        description: article.description,
        author: article.author,
        source: article.source,
      };

      // Save to storage
      await storageService.saveFavorite(favorite);

      // Update state
      dispatch({ type: 'ADD_FAVORITE', payload: favorite });
    } catch (error) {
      console.error('Error adding favorite:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to add favorite' });
    }
  }, []);

  // Remove favorite article
  const removeFavorite = useCallback(async (articleId: string): Promise<void> => {
    try {
      // Remove from storage
      await storageService.removeFavorite(articleId);

      // Update state
      dispatch({ type: 'REMOVE_FAVORITE', payload: articleId });
    } catch (error) {
      console.error('Error removing favorite:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to remove favorite' });
    }
  }, []);

  // Check if article is favorite
  const isFavorite = useCallback((articleId: string): boolean => {
    return state.favorites.some(fav => fav.id === articleId);
  }, [state.favorites]);

  // Mark article as liked
  const markArticleAsLiked = useCallback(async (articleId: string): Promise<void> => {
    try {
      await firebaseService.logArticleLike(articleId);
      await storageService.markArticleAsLiked(articleId);

      // Reload article history to reflect the vote
      const updatedHistory = await storageService.getArticleHistory();
      dispatch({ type: 'SET_ARTICLE_HISTORY', payload: updatedHistory });
    } catch (error) {
      console.error('Error marking article as liked:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to like article' });
    }
  }, []);

  // Mark article as disliked
  const markArticleAsDisliked = useCallback(async (articleId: string): Promise<void> => {
    try {
      await firebaseService.logArticleDislike(articleId);
      await storageService.markArticleAsDisliked(articleId);

      // Reload article history to reflect the vote
      const updatedHistory = await storageService.getArticleHistory();
      dispatch({ type: 'SET_ARTICLE_HISTORY', payload: updatedHistory });
    } catch (error) {
      console.error('Error marking article as disliked:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to dislike article' });
    }
  }, []);

  // Remove upvote from article
  const removeUpvoteFromArticle = useCallback(async (articleId: string): Promise<void> => {
    try {
      await storageService.removeArticleVoteStatus(articleId);
      await firebaseService.removeArticleLike(articleId);

      // Reload article history to reflect the vote
      const updatedHistory = await storageService.getArticleHistory();
      dispatch({ type: 'SET_ARTICLE_HISTORY', payload: updatedHistory });
    } catch (error) {
      console.error('Error removing vote from article:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to remove vote' });
    }
  }, []);

  // Remove downvote from article
  const removeDownvoteFromArticle = useCallback(async (articleId: string): Promise<void> => {
    try {
      await storageService.removeArticleVoteStatus(articleId);
      await firebaseService.removeArticleDislike(articleId);

      // Reload article history to reflect the vote
      const updatedHistory = await storageService.getArticleHistory();
      dispatch({ type: 'SET_ARTICLE_HISTORY', payload: updatedHistory });
    } catch (error) {
      console.error('Error removing vote from article:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to remove vote' });
    }
  }, []);

  // Get article vote status
  const getArticleVoteStatus = useCallback(async (articleId: string): Promise<'liked' | 'disliked' | null> => {
    try {
      return await storageService.getArticleVoteStatus(articleId);
    } catch (error) {
      console.error('Error getting article vote status:', error);
      return null;
    }
  }, []);

  // Check if user has voted on an article
  const hasUserVoted = useCallback(async (articleId: string): Promise<boolean> => {
    try {
      return await storageService.hasUserVoted(articleId);
    } catch (error) {
      console.error('Error checking if user has voted:', error);
      return false;
    }
  }, []);

  // Update article vote counts optimistically (for immediate UI feedback)
  const updateArticleVoteCounts = useCallback((articleId: string, likeChange: number, dislikeChange: number): void => {
    if (state.currentArticle && state.currentArticle.id === articleId) {
      dispatch({
        type: 'SET_CURRENT_ARTICLE',
        payload: {
          ...state.currentArticle,
          likeCount: Math.max(0, (state.currentArticle.likeCount || 0) + likeChange),
          dislikeCount: Math.max(0, (state.currentArticle.dislikeCount || 0) + dislikeChange),
        }
      });
    }
  }, [state.currentArticle]);

  // Get all favorites
  const getFavorites = useCallback((): FavoriteArticle[] => {
    return [...state.favorites].sort((a, b) =>
      new Date(b.favoritedAt).getTime() - new Date(a.favoritedAt).getTime()
    );
  }, [state.favorites]);

  // Add article to backlog
  const addToBacklog = useCallback(async (article: Article): Promise<void> => {
    try {
      await storageService.addToBacklog(article);

      const delayedArticle: DelayedArticle = {
        article,
        delayedAt: new Date().toISOString(),
        originalRoutineDay: article.routineDay,
      };

      dispatch({ type: 'ADD_TO_BACKLOG', payload: delayedArticle });
    } catch (error) {
      console.error('Error adding article to backlog:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to delay article' });
    }
  }, []);

  // Remove article from backlog
  const removeFromBacklog = useCallback(async (articleId: string): Promise<void> => {
    try {
      await storageService.removeFromBacklog(articleId);
      dispatch({ type: 'REMOVE_FROM_BACKLOG', payload: articleId });
    } catch (error) {
      console.error('Error removing article from backlog:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to remove article from backlog' });
    }
  }, []);

  // Get backlog articles
  const getBacklogArticles = useCallback((): DelayedArticle[] => {
    return [...state.backlogArticles].sort((a, b) =>
      new Date(b.delayedAt).getTime() - new Date(a.delayedAt).getTime()
    );
  }, [state.backlogArticles]);

  // Clean expired backlog articles
  const cleanExpiredBacklogArticles = useCallback(async (): Promise<void> => {
    try {
      await storageService.cleanExpiredBacklogArticles();
      const updatedBacklog = await storageService.getBacklogArticles();
      dispatch({ type: 'SET_BACKLOG_ARTICLES', payload: updatedBacklog });
    } catch (error) {
      console.error('Error cleaning expired backlog articles:', error);
    }
  }, []);

  // Check if article is in backlog
  const isArticleInBacklog = useCallback((articleId: string): boolean => {
    return state.backlogArticles.some(delayedArticle => delayedArticle.article.id === articleId);
  }, [state.backlogArticles]);

  // Set viewing backlog article
  const setViewingBacklogArticle = useCallback((isViewing: boolean, articleId?: string): void => {
    dispatch({
      type: 'SET_VIEWING_BACKLOG_ARTICLE',
      payload: { isViewing, articleId: articleId || null }
    });
  }, []);

  // Get displayed article (current or backlog being viewed)
  const getDisplayedArticle = useCallback((): Article | null => {
    if (state.isViewingBacklogArticle) {
      if (state.currentBacklogArticleId) {
        const backlogArticle = state.backlogArticles.find(
          delayedArticle => delayedArticle.article.id === state.currentBacklogArticleId
        );
        return backlogArticle?.article || null;
      } else {
        // In backlog mode but no specific article ID means we're in completion state
        return null;
      }
    }
    return state.currentArticle;
  }, [state.currentArticle, state.isViewingBacklogArticle, state.currentBacklogArticleId, state.backlogArticles]);

  // Mark article as read
  const markArticleAsRead = useCallback(async (
    articleId: string,
    tags: string[],
  ): Promise<void> => {
    try {
      // Check if article is already read - IMMUTABLE PROTECTION
      const existingProgress = state.articleHistory.find(p => p.articleId === articleId);
      if (existingProgress?.isRead) {
        return;
      }

      // Get the article being read (could be current article or backlog article)
      const article = getDisplayedArticle();
      if (!article) {
        throw new Error('No article available to mark as read');
      }

      // For backlog articles, we need to allow reading regardless of routine day
      // For current articles, enforce routine day restriction
      if (!state.isViewingBacklogArticle && !canMarkAsRead(article.routineDay)) {
        throw new Error('Article can only be marked as read on its routine day');
      }

      // Update storage - pass originalRoutineDay if this is a backlog article, and always pass routineDay
      const originalRoutineDay = state.isViewingBacklogArticle && state.currentBacklogArticleId === articleId
        ? state.backlogArticles.find(delayedArticle => delayedArticle.article.id === articleId)?.originalRoutineDay
        : undefined;

      await storageService.markArticleAsRead(articleId, article.title, article.url, originalRoutineDay, article.routineDay);

      // Only update tag stats if article was successfully marked as read (not already read)
      const updatedProgress = await storageService.getArticleProgress(articleId);
      if (updatedProgress?.isRead) {
        await storageService.updateTagStats(tags);
      }

      // If reading a backlog article, remove it from backlog but stay in backlog mode
      if (state.isViewingBacklogArticle && state.currentBacklogArticleId === articleId) {
        await storageService.removeFromBacklog(articleId);
        dispatch({ type: 'REMOVE_FROM_BACKLOG', payload: articleId });

        // Clear the current backlog article but keep backlog viewing mode active
        dispatch({ type: 'SET_VIEWING_BACKLOG_ARTICLE', payload: { isViewing: true, articleId: null } });
      }

      // Update state immediately
      dispatch({ type: 'MARK_ARTICLE_READ', payload: { articleId, tags } });

      // Log analytics
      await firebaseService.logArticleRead(articleId);
    } catch (error) {
      console.error('Error marking article as read:', error);
      // Don't show error to user for routine day restrictions - this is normal behavior
    }
  }, [state.articleHistory, state.currentArticle, state.isViewingBacklogArticle, state.currentBacklogArticleId, state.backlogArticles, getDisplayedArticle]);

  const contextValue: AppContextType = {
    state,
    fetchTodaysArticle,
    refreshTodaysArticle,
    addArticleToHistory,
    markArticleAsRead,
    markArticleAsUnread,
    getArticleWithProgress,
    getReadableArticles,
    getUnreadArticles,
    isArticleReadToday,
    canMarkAsRead,
    getReadingStreak,
    getTotalReadArticles,
    addFavorite,
    removeFavorite,
    isFavorite,
    getFavorites,
    addToBacklog,
    removeFromBacklog,
    getBacklogArticles,
    cleanExpiredBacklogArticles,
    isArticleInBacklog,
    setViewingBacklogArticle,
    getDisplayedArticle,
    markArticleAsLiked,
    markArticleAsDisliked,
    removeUpvoteFromArticle,
    removeDownvoteFromArticle,
    getArticleVoteStatus,
    hasUserVoted,
    updateArticleVoteCounts,
    clearError: clearAppError,
    updateTranslationSettings,
    // Subscription management
    subscriptionStatus: state.subscriptionStatus,
    isSubscribed,
    subscriptionConnected: !offeringsLoading && offerings !== null,
    subscriptionPrice: offerings?.availablePackages?.[0]?.product?.priceString || '$9.99',
    purchaseLoading,
    restoreLoading,
    subscriptionInitializing: offeringsLoading,
    purchaseSubscription: async () => {
      if (offerings?.availablePackages?.[0]) {
        await purchasePackage(offerings.availablePackages[0]);
      }
    },
    restorePurchases,
    refreshSubscriptionStatus: refreshCustomerInfo,

    // New RevenueCat specific properties
    offerings,
    customerInfo,
    offeringsLoading,
    subscriptionError: lastError,
    clearSubscriptionError: clearSubscriptionError,
    refreshData,
    resetAppData,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export default AppContext;
