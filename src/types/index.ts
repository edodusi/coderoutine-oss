export interface Article {
  id: string;
  title: string;
  url: string;
  routineDay: string; // ISO date string (YYYY-MM-DD)
  tags: string[];
  estimatedReadTime: number; // in minutes
  description?: string;
  author?: string;
  source?: string;
  content?: string;
  needsJavascript?: boolean; // Whether the article requires JavaScript to display properly
  readCount?: number; // Number of times this article has been read
  likeCount?: number; // Number of likes this article has received
  dislikeCount?: number; // Number of dislikes this article has received
  podcastUrl?: string; // URL to the generated podcast MP3 file
  podcastStatus?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'; // Status of podcast generation
}

export interface UserArticleProgress {
  articleId: string;
  articleTitle?: string; // Store title for history display
  articleUrl?: string; // Store URL for external opening
  isRead: boolean;
  readAt?: string; // ISO date string
  voteStatus?: 'liked' | 'disliked' | null; // User's vote on this article
  votedAt?: string; // ISO date string when user voted
  originalRoutineDay?: string; // ISO date string for postponed articles - the day it was originally scheduled
  routineDay?: string; // ISO date string (YYYY-MM-DD) - the day this article was scheduled for
}

export interface TagStats {
  [tagName: string]: number; // tag name -> points (1 point per read article)
}

export interface FavoriteArticle {
  id: string;
  title: string;
  url: string;
  favoritedAt: string; // ISO date string
  routineDay?: string; // ISO date string (YYYY-MM-DD)
  tags?: string[];
  description?: string;
  author?: string;
  source?: string;
}

export interface TranslationSettings {
  preferredLanguage: string | null; // 'it', 'es', 'de', 'fr', or null for no preference
  rememberLanguage: boolean;
  summaryFontSize: 'small' | 'medium' | 'large'; // Font size preference for AI summaries
}

export interface SubscriptionStatus {
  isActive: boolean;
  productId: string | null;
  purchaseTime: string | null;
  expiryTime: string | null;
  lastChecked: string | null;
}

export interface DelayedArticle {
  article: Article;
  delayedAt: string; // ISO date string when article was delayed
  originalRoutineDay: string; // Original routine day for this article
}

export interface AppState {
  currentArticle: Article | null;
  articleHistory: UserArticleProgress[];
  favorites: FavoriteArticle[];
  tagStats: TagStats;
  isDarkTheme: boolean;
  lastFetchDate: string | null;
  translationSettings: TranslationSettings;
  subscriptionStatus: SubscriptionStatus;
  backlogArticles: DelayedArticle[];
  isViewingBacklogArticle: boolean;
  currentBacklogArticleId: string | null;
}

export interface FirebaseArticleData {
  article: Article;
  routineDay: string;
}

export interface PurchaseResult {
  success: boolean;
  error?: string;
  purchaseToken?: string;
}

export interface ReadingSession {
  articleId: string;
  startTime: number;
  endTime?: number;
  scrollEvents: ScrollEvent[];
}

export interface ScrollEvent {
  timestamp: number;
  scrollY: number;
  maxScrollY: number;
  percentage: number;
}

export type ThemeMode = 'light' | 'dark';

export type ReadStatus = 'read' | 'unread' | 'expired';

export interface ArticleWithProgress extends Article {
  progress: UserArticleProgress | null;
  status: ReadStatus;
  isExpired: boolean;
  canMarkAsRead: boolean;
}

export interface MenuItem {
  key: string;
  title: string;
  icon: string;
  route: string;
}

export interface ErrorState {
  message: string;
  code?: string;
  timestamp: number;
}

export interface TranslationData {
  translation: string;
  generatedAt: string;
  language: string;
  cached: boolean;
}

export type SupportedLanguage = 'it' | 'es' | 'de' | 'fr';

export interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  flag: string;
}
