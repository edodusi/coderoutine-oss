import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated,
  Alert,
  Modal,
  Share,
  Linking,
  Easing,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import RenderHtml from 'react-native-render-html';
import { firebaseApp } from '../services/firebaseApp';
import { firebaseService } from '../services/firebaseService';
import storageService from '../services/storageService';
import { usePremiumAccess } from '../hooks/usePremiumAccess';
import { usePodcast } from '../context/PodcastContext';
import PodcastPlayer from '../components/PodcastPlayer';
import { getWebViewInjectionScript } from '../utils/webviewInjection';

// Move constants outside to prevent recreation
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RESPONSIVE_BREAKPOINT = 350;

interface AiSummaryData {
  summary: string;
  originalUrl: string;
  generatedAt: string;
  wordCount: number;
}

interface TranslationData {
  translation: string;
  generatedAt: string;
  language: string;
  cached: boolean;
}

type SupportedLanguage = 'it' | 'es' | 'de' | 'fr';

interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  flag: string;
}

// Move constants outside component to prevent recreation
const COLORS = {
  WHITE: '#FFFFFF',
  PRIMARY_BLUE: '#007AFF',
  SECONDARY_BLUE: '#1565C0',
  SUCCESS_GREEN: '#4CAF50',
  GRAY_LIGHT: '#F5F5F5',
  GRAY_MEDIUM: '#757575',
  GRAY_DARK: '#333333',
  GRAY_DARKER: '#666666',
  BORDER_LIGHT: '#E0E0E0',
  BACKGROUND_LIGHT: '#FAFBFC',
  CODE_BG_DARK: '#0D1117',
  CODE_TEXT_LIGHT: '#F0F6FC',
  CODE_BORDER: '#30363D',
  CODE_BG_LIGHT: '#F6F8FA',
  CODE_TEXT_DARK: '#24292F',
  LOADING_PROGRESS_BG: '#F1F8FF',
  LOADING_PROGRESS_BORDER: '#C8E1FF',
  SHADOW_DARK: '#000',
} as const;

const BORDER_RADIUS = {
  SMALL: 4,
  MEDIUM: 8,
  LARGE: 12,
  EXTRA_LARGE: 16,
  ROUND: 20,
} as const;

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
];

const MODAL_SETTING = {
  HEIGHT: 260
} as const;

// Create styles function outside component
interface ThemeType {
  colors: {
    background: string;
    card: string;
    text: string;
    textSecondary: string;
    primary: string;
    secondary: string;
    surface: string;
    border: string;
    buttonInactive: string;
    buttonTextInactive: string;
    buttonTextActive: string;
    podcastButton: string;
    podcastButtonActive: string;
    disabled: string;
    orange: string;
    success: string;
    error: string;
  };
}

const createStyles = (theme: ThemeType, _isDarkMode: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
  },
  contentContainer: {
    flex: 1,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.GRAY_DARK,
    marginBottom: 8,
  },
  backlogBanner: {
    backgroundColor: theme.colors.orange + '20',
    borderColor: theme.colors.orange,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backlogBannerText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.orange,
    fontWeight: '600',
    marginLeft: 8,
  },
  returnButton: {
    backgroundColor: theme.colors.orange,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  returnButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyDescription: {
    fontSize: 16,
    color: COLORS.GRAY_DARKER,
    textAlign: 'center',
    lineHeight: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.WHITE,
  },
  headerButtonsContainer: {
    flexDirection: 'row',
    flex: 1,
    gap: SCREEN_WIDTH > RESPONSIVE_BREAKPOINT ? 8 : 4,
  },
  viewModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SCREEN_WIDTH > RESPONSIVE_BREAKPOINT ? 10 : 6,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: theme.colors.buttonInactive,
    flex: 1,
    justifyContent: 'center',
  },
  activeViewModeButton: {
    backgroundColor: theme.colors.primary,
  },
  disabledViewModeButton: {
    backgroundColor: theme.colors.surface,
    opacity: 0.6,
  },
  loadingButton: {
    opacity: 0.6,
  },
  viewModeText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
    display: SCREEN_WIDTH > RESPONSIVE_BREAKPOINT ? 'flex' : 'none',
    color: theme.colors.buttonTextInactive,
  },
  activeViewModeText: {
    color: theme.colors.buttonTextActive,
  },
  podcastButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: SCREEN_WIDTH > RESPONSIVE_BREAKPOINT ? 12 : 8,
    borderRadius: 6,
    backgroundColor: theme.colors.podcastButton,
    flex: 1,
    justifyContent: 'center',
  },
  activePodcastButton: {
    backgroundColor: theme.colors.podcastButtonActive,
  },
  podcastButtonDisabled: {
    backgroundColor: theme.colors.disabled,
    opacity: 0.6,
  },
  podcastButtonText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
    color: theme.colors.buttonTextActive,
    display: SCREEN_WIDTH > RESPONSIVE_BREAKPOINT ? 'flex' : 'none',
  },
  podcastButtonTextDisabled: {
    color: theme.colors.background,
  },
  podcastButtonTextInactive: {
    color: theme.colors.buttonTextInactive,
  },
  favoriteButton: {
    marginLeft: 'auto',
    padding: 8,
  },
  floatingActions: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    alignItems: 'center',
    zIndex: 1000,
  },
  floatingActionButton: {
    width: 42,
    height: 42,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 6,
  },
  floatingActionButtonComplete: {
    opacity: 0.7,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.BACKGROUND_LIGHT,
    paddingHorizontal: 24,
    minHeight: 400,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.CODE_TEXT_DARK,
    marginTop: 20,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    color: COLORS.GRAY_DARKER,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  loadingProgress: {
    fontSize: 15,
    color: theme.colors.primary,
    marginTop: 12,
    marginBottom: 6,
    textAlign: 'center',
    paddingHorizontal: 32,
    fontWeight: '500',
    backgroundColor: COLORS.LOADING_PROGRESS_BG,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.MEDIUM,
    borderWidth: 1,
    borderColor: COLORS.LOADING_PROGRESS_BORDER,
  },
  summaryContainer: {
    flex: 1,
  },
  summaryContent: {
    padding: 24,
    paddingTop: 16,
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  summaryHeader: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E4E8',
  },
  summaryCardFirstRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryCardFirstRowRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  summaryCardSecondRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 0,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.EXTRA_LARGE,
  },
  summaryBadgeText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  summaryMeta: {
    fontSize: 12,
    color: COLORS.GRAY_DARKER,
    fontWeight: '500',
    flex: 1,
  },
  summaryTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.GRAY_DARK,
    lineHeight: 32,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  summaryAuthor: {
    marginBottom: 24,
    marginHorizontal: 16,
  },
  summaryAuthorText: {
    fontSize: 14,
    color: COLORS.GRAY_DARKER,
    fontWeight: '500',
  },
  originalLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.WHITE,
    borderRadius: BORDER_RADIUS.LARGE,
    marginTop: 32,
    marginBottom: 16,
    marginHorizontal: 24,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    elevation: 1,
  },
  originalLinkText: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    flex: 1,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.GRAY_DARK,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.GRAY_DARKER,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  errorMessage: {
    fontSize: 14,
    color: COLORS.GRAY_DARKER,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.MEDIUM,
  },
  retryButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  slidingPanelOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  slidingPanelBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  slidingPanelContent: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 12,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  dragHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
    opacity: 0.6,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 0,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.GRAY_DARK,
  },
  closeButton: {
    padding: 4,
  },
  actionsList: {
    paddingTop: 2,
  },
  quickActionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  quickActionItem: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 4,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 12,
  },
  separator: {
    height: 1,
    marginHorizontal: 0,
    marginVertical: 0,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 16,
    flex: 1,
    color: COLORS.GRAY_DARK,
  },
  disabledAction: {
    opacity: 0.6,
  },
  disabledActionText: {
    color: COLORS.GRAY_DARKER,
  },
  comingSoonText: {
    fontSize: 10,
    fontStyle: 'italic',
    color: COLORS.GRAY_DARKER,
    marginLeft: 16,
    marginBottom: -2,
  },
  summaryControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingVertical: 0,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 6,
    gap: 4,
  },
  miniButton: {
    width: 28,
    height: 28,
    borderRadius: BORDER_RADIUS.SMALL,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  miniButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  miniButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.GRAY_MEDIUM,
  },
  miniButtonTextActive: {
    color: COLORS.GRAY_LIGHT,
  },
  summaryScreenContainer: {
    flex: 1,
    paddingBottom: 100,
    paddingTop: 2,
  },
  summaryCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 12,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryContentContainer: {
    paddingHorizontal: 16,
    marginTop: 6,
  },
  backToOriginalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderRadius: BORDER_RADIUS.MEDIUM,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  backToOriginalText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  translateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.MEDIUM,
    elevation: 3,
  },
  translateButtonText: {
    color: COLORS.GRAY_LIGHT,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  languageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  languageModalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BORDER_RADIUS.EXTRA_LARGE,
    padding: 0,
    shadowColor: COLORS.SHADOW_DARK,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  languageModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  languageModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  languageModalCloseButton: {
    padding: 4,
  },
  languageModalSubtitle: {
    fontSize: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  languageOptionsContainer: {
    paddingBottom: 20,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  languageFlag: {
    fontSize: 24,
    marginRight: 16,
  },
  languageName: {
    fontSize: 16,
    flex: 1,
    fontWeight: '500',
  },
  errorModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorModalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BORDER_RADIUS.EXTRA_LARGE,
    padding: 0,
    shadowColor: COLORS.SHADOW_DARK,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  errorModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 0,
  },
  errorIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  errorModalCloseButton: {
    padding: 4,
  },
  errorModalBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  errorModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorModalMessage: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  errorModalActions: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 8,
    flexDirection: 'row',
    gap: 12,
  },
  errorModalButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: BORDER_RADIUS.LARGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  celebrationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  celebrationMain: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrationIconContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 32,
    paddingVertical: 24,
    borderRadius: 20,
    elevation: 8,
  },
  celebrationText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D3436',
    marginTop: 12,
    textAlign: 'center',
  },
  celebrationSubtext: {
    fontSize: 16,
    color: '#636E72',
    marginTop: 4,
    textAlign: 'center',
  },
  confettiParticle: {
    position: 'absolute',
    top: '20%',
  },
  devModeButton: {
    borderWidth: 2,
    borderColor: '#FFD700',
    borderStyle: 'dashed',
  },
  devModeText: {
    fontSize: 8,
    color: COLORS.WHITE,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  errorModalButtonSecondary: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: BORDER_RADIUS.LARGE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  errorModalButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  progressBarContainer: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.success,
    borderRadius: 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: 200,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

interface ArticleScreenProps {
  route: {
    params?: {
      routeViewMode?: string;
      timestamp?: number;
    };
  };
}

const ArticleScreen: React.FC<ArticleScreenProps> = React.memo(({ route }) => {
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation();
  const { state,
    markArticleAsRead, markArticleAsUnread, addFavorite, removeFavorite, isFavorite, updateTranslationSettings, markArticleAsLiked, markArticleAsDisliked, getArticleVoteStatus, removeUpvoteFromArticle, removeDownvoteFromArticle, refreshSubscriptionStatus, getDisplayedArticle, setViewingBacklogArticle, getBacklogArticles } = useApp();

  const { checkPremiumAccess, hasPremiumAccess, clearEntitlementCache } = usePremiumAccess();
  const { state: podcastState, hidePlayer } = usePodcast();
  const webViewRef = useRef<WebView>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const celebrationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Memoize styles to prevent recreation on every render
  const styles = useMemo(() => createStyles(theme, isDarkMode), [theme, isDarkMode]);

  // Initialize animation values outside component or use refs properly
  const animationRefs = useRef({
    modalTranslateY: new Animated.Value(300),
    modalOpacity: new Animated.Value(0),
    panY: new Animated.Value(0),
    celebrationOpacity: new Animated.Value(0),
    celebrationScale: new Animated.Value(0),
    confettiAnimations: Array.from({ length: 12 }, () => ({
      translateY: new Animated.Value(-50),
      translateX: new Animated.Value(0),
      rotate: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  }).current;

  // get route parameters and set initial view mode
  const { routeViewMode, timestamp } = route.params ?? {};

  // Split UI state for better performance
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'article' | 'summary'>(
    routeViewMode === 'summary' ? 'summary' : 'article'
  );
  // readingProgress is now handled by progressBarWidth animated value
  const [showCelebration, setShowCelebration] = useState(false);
  const [actionsModalVisible, setActionsModalVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);

  // Animated progress bar
  const progressBarWidth = useRef(new Animated.Value(0)).current;

  // Podcast context
  const { loadPodcast, showPlayer } = usePodcast();

  // Combine AI Summary state
  const [summaryState, setSummaryState] = useState({
    aiSummary: null as AiSummaryData | null,
    summaryLoading: false,
    summaryError: null as string | null,
    autoFetchSummary: false,
    processedSummaryHtml: '',
    summarySize: state.translationSettings.summaryFontSize as 'small' | 'medium' | 'large',
  });

  // Track the last processed timestamp to avoid re-triggering
  const lastProcessedTimestamp = useRef<number | null>(null);

  // Combine translation state
  const [translationState, setTranslationState] = useState({
    translationData: null as TranslationData | null,
    translationLoading: false,
    translationError: null as string | null,
    currentLanguage: null as SupportedLanguage | null,
  });

  // Combine voting state
  const [votingState, setVotingState] = useState({
    voteStatus: null as 'liked' | 'disliked' | null,
    optimisticVoteStatus: null as 'liked' | 'disliked' | null,
    isVoting: false,
  });

  const [currentArticleIsRead, setCurrentArticleIsRead] = useState<boolean | null>(null);
  const [errorModalData, setErrorModalData] = useState<{
    title: string;
    message: string;
    details?: string;
  } | null>(null);

  // Use optimized animation refs
  const { modalTranslateY, modalOpacity, panY, celebrationOpacity, celebrationScale, confettiAnimations } = animationRefs;
  const isAnimating = useRef(false);

  const isViewingBacklogArticle = state.isViewingBacklogArticle;

  // Check for article availability after all hooks
  const currentArticle = getDisplayedArticle();

  // Consolidate article data fetching
  useEffect(() => {
    if (!currentArticle) return;

    const fetchArticleData = async () => {
      try {
        const [readStatus, voteStatus] = await Promise.all([
          storageService.getArticleReadStatus(currentArticle.id),
          getArticleVoteStatus(currentArticle.id)
        ]);

        setCurrentArticleIsRead(readStatus);
        setVotingState(prev => ({
          ...prev,
          voteStatus,
          optimisticVoteStatus: voteStatus,
        }));
      } catch (error) {
        console.error('Error fetching article data:', error);
      }
    };

    fetchArticleData();
  }, [currentArticle?.id, getArticleVoteStatus]);

 // Celebration animation function - optimized
 const triggerCelebration = useCallback(() => {
   setShowCelebration(true);

   // Reset all animations
   celebrationOpacity.setValue(0);
   celebrationScale.setValue(0);
   confettiAnimations.forEach(anim => {
     anim.translateY.setValue(-50);
     anim.translateX.setValue((Math.random() - 0.5) * 200);
     anim.rotate.setValue(0);
     anim.opacity.setValue(0);
   });

   // Main celebration animation
   Animated.sequence([
     Animated.parallel([
       Animated.timing(celebrationOpacity, {
         toValue: 1,
         duration: 300,
         useNativeDriver: true,
       }),
       Animated.spring(celebrationScale, {
         toValue: 1,
         tension: 100,
         friction: 8,
         useNativeDriver: true,
       }),
     ]),
     Animated.timing(celebrationScale, {
       toValue: 1.2,
       duration: 150,
       easing: Easing.out(Easing.quad),
       useNativeDriver: true,
     }),
     Animated.timing(celebrationScale, {
       toValue: 1,
       duration: 150,
       easing: Easing.out(Easing.quad),
       useNativeDriver: true,
     }),
   ]).start();

   // Simplified confetti animation
   const confettiStaggerDelay = 100;
   confettiAnimations.forEach((anim, index) => {
     Animated.sequence([
       Animated.delay(index * confettiStaggerDelay),
       Animated.parallel([
         Animated.timing(anim.opacity, {
           toValue: 1,
           duration: 300,
           useNativeDriver: true,
         }),
         Animated.timing(anim.translateY, {
           toValue: SCREEN_WIDTH + 100,
           duration: 1500,
           easing: Easing.out(Easing.quad),
           useNativeDriver: true,
         }),
         Animated.timing(anim.rotate, {
           toValue: 360,
           duration: 1500,
           useNativeDriver: true,
         }),
       ]),
       Animated.timing(anim.opacity, {
         toValue: 0,
         duration: 200,
         useNativeDriver: true,
       }),
     ]).start();
   });

   // Clear any existing celebration timeout
   if (celebrationTimeoutRef.current) {
     clearTimeout(celebrationTimeoutRef.current);
   }

   // Hide celebration after 2 seconds
   celebrationTimeoutRef.current = setTimeout(() => {
     Animated.timing(celebrationOpacity, {
       toValue: 0,
       duration: 300,
       useNativeDriver: true,
     }).start(() => {
       setShowCelebration(false);
       celebrationTimeoutRef.current = null;
     });
   }, 2000);
 }, [celebrationOpacity, celebrationScale, confettiAnimations]);

  // Memoized callbacks for WebView performance
  const handleWebViewLoadEnd = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Throttled scroll handler for better performance
  const scrollTimeoutRef2 = useRef<NodeJS.Timeout | null>(null);
  const handleWebViewScroll = useCallback((event: any) => {
    if (!currentArticle || viewMode !== 'article') return;

    // Persist the event to prevent React from nullifying it
    if (event?.persist) {
      event.persist();
    }

    // Extract event data immediately to avoid synthetic event pooling issues
    const nativeEvent = event?.nativeEvent;
    if (!nativeEvent?.contentOffset || !nativeEvent?.contentSize || !nativeEvent?.layoutMeasurement) {
      return;
    }

    const scrollY = nativeEvent.contentOffset.y || 0;
    const contentHeight = nativeEvent.contentSize.height || 0;
    const viewHeight = nativeEvent.layoutMeasurement.height || 0;

    // Throttle scroll events
    if (scrollTimeoutRef2.current) return;

    scrollTimeoutRef2.current = setTimeout(() => {
      scrollTimeoutRef2.current = null;

      if (contentHeight - (scrollY + viewHeight) < 20 && !currentArticleIsRead) {
        setCurrentArticleIsRead(true);
        markArticleAsRead(currentArticle.id, currentArticle.tags, 0, true);
        triggerCelebration();
      }
    }, 100);
  }, [viewMode, currentArticleIsRead, currentArticle?.id, currentArticle?.tags, markArticleAsRead, triggerCelebration]);

  const handleReturnToToday = useCallback(() => {
    setViewingBacklogArticle(false);
  }, [setViewingBacklogArticle]);

  // Memoized WebView component
  const webViewComponent = useMemo(() => {
    if (!currentArticle) return null;

    return (
    <WebView
      ref={webViewRef}
      source={{ uri: currentArticle.url }}
      style={styles.webview}
      onLoadEnd={handleWebViewLoadEnd}
      startInLoadingState={true}
      scalesPageToFit={Platform.OS !== 'web'}
      allowsBackForwardNavigationGestures={false}
      userAgent={
        Platform.OS === 'ios'
          ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1'
          : 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36'
      }
      javaScriptEnabled={true}
      incognito={false}
      domStorageEnabled={false}
      cacheEnabled={true}
      cacheMode='LOAD_DEFAULT'
      pullToRefreshEnabled={false}
      thirdPartyCookiesEnabled={false}
      allowsLinkPreview={false}
      scrollEnabled={true}
      bounces={false}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={true}
      allowsInlineMediaPlayback={false}
      mediaPlaybackRequiresUserAction={true}
      allowsFullscreenVideo={false}
      androidLayerType="hardware"
      mixedContentMode="compatibility"

      onShouldStartLoadWithRequest={(_request) => {
        return true;
      }}
      onMessage={(event) => {
        try {
          // Extract data immediately to avoid synthetic event pooling issues
          const eventData = event?.nativeEvent?.data;
          if (!eventData) return;

          const data = JSON.parse(eventData);
          if (data.type === 'EXTERNAL_LINK_CLICK') {
            Linking.openURL(data.url);
          }
        } catch (error) {
          console.error('Error handling WebView message:', error);
        }
      }}
      onScroll={handleWebViewScroll}
      injectedJavaScript={getWebViewInjectionScript()}
    />
    );
  }, [currentArticle?.url, handleWebViewLoadEnd, handleWebViewScroll]);

  // Consolidate summary-related effects
  useEffect(() => {
    // Update summary size when translation settings change
    setSummaryState(prev => ({
      ...prev,
      summarySize: state.translationSettings.summaryFontSize
    }));

    // Auto-fetch summary when flag is set
    if (summaryState.autoFetchSummary && currentArticle && !summaryState.aiSummary && !summaryState.summaryLoading) {
      fetchAiSummary();
      setSummaryState(prev => ({ ...prev, autoFetchSummary: false }));
    }

    // Process existing summary if we have one but no processed HTML
    if (summaryState.aiSummary && !summaryState.processedSummaryHtml) {
      const processedHtml = processHtmlForWhitespace(summaryState.aiSummary.summary);
      setSummaryState(prev => ({ ...prev, processedSummaryHtml: processedHtml }));
    }
  }, [state.translationSettings.summaryFontSize, summaryState.autoFetchSummary, currentArticle, summaryState.aiSummary, summaryState.summaryLoading, summaryState.processedSummaryHtml]);

  // Cleanup animations and timeouts on unmount for memory management
  useEffect(() => {
    return () => {
      // Clear all timeouts
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }

      if (scrollTimeoutRef2.current) {
        clearTimeout(scrollTimeoutRef2.current);
        scrollTimeoutRef2.current = null;
      }

      if (celebrationTimeoutRef.current) {
        clearTimeout(celebrationTimeoutRef.current);
        celebrationTimeoutRef.current = null;
      }

      // Clear animation frames
      if (progressUpdateFrameRef.current) {
        cancelAnimationFrame(progressUpdateFrameRef.current);
        progressUpdateFrameRef.current = null;
      }

      // Stop all animations to prevent memory leaks
      try {
        celebrationOpacity.stopAnimation();
        celebrationScale.stopAnimation();
        modalTranslateY.stopAnimation();
        modalOpacity.stopAnimation();
        panY.stopAnimation();
        confettiAnimations.forEach(anim => {
          anim.translateY.stopAnimation();
          anim.translateX.stopAnimation();
          anim.rotate.stopAnimation();
          anim.opacity.stopAnimation();
        });
      } catch (error) {
        // Ignore animation cleanup errors
        console.warn('Animation cleanup error:', error);
      }
    };
  }, []);

  // Cleanup when view mode changes
  useEffect(() => {
    return () => {
      // Clean up scroll-related timeouts and animation frames when view mode changes
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }

      if (progressUpdateFrameRef.current) {
        cancelAnimationFrame(progressUpdateFrameRef.current);
        progressUpdateFrameRef.current = null;
      }

      // Reset scroll handling state
      isScrollHandlingRef.current = false;

      // Reset progress bar when changing view modes
      if (viewMode === 'article') {
        progressBarWidth.setValue(0);
      }
    };
  }, [viewMode]);

  // Cleanup on navigation (when component is about to unmount or navigate away)
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        // Cleanup when leaving the screen
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
          scrollTimeoutRef.current = null;
        }

        if (scrollTimeoutRef2.current) {
          clearTimeout(scrollTimeoutRef2.current);
          scrollTimeoutRef2.current = null;
        }

        if (progressUpdateFrameRef.current) {
          cancelAnimationFrame(progressUpdateFrameRef.current);
          progressUpdateFrameRef.current = null;
        }

        // Reset scroll handling state
        isScrollHandlingRef.current = false;
      };
    }, [])
  );

  // Handle route parameter to auto-trigger summary mode using focus effect
  useFocusEffect(
    React.useCallback(() => {
      // Force refresh subscription status and clear caches when screen is focused
      console.log('ArticleScreen focused - force refreshing subscription status and clearing caches');

      // Clear premium access caches immediately
      if (clearEntitlementCache) {
        clearEntitlementCache();
      }

      // Force refresh subscription status
      refreshSubscriptionStatus();

      if (routeViewMode === 'summary' && currentArticle && timestamp &&
          timestamp !== lastProcessedTimestamp.current) {
        setViewMode('summary');
        setSummaryState(prev => ({ ...prev, autoFetchSummary: true }));
        lastProcessedTimestamp.current = timestamp;
      } else if (!routeViewMode) {
        // Default back to article view when no route params
        setViewMode('article');
      }
    }, [routeViewMode, currentArticle, timestamp, refreshSubscriptionStatus, clearEntitlementCache])
  );

  // Memoize HTML processing for whitespace preservation
  const processHtmlForWhitespace = useCallback((htmlContent: string): string => {
    return htmlContent.replace(
      /<pre>([\s\S]*?)<\/pre>/g,
      (match, content) => {
        const preservedContent = content
          .split('\n')
          .map((line: string) => {
            const leadingSpaces = line.match(/^(\s*)/)?.[1] || '';
            const restOfLine = line.substring(leadingSpaces.length);
            const preservedIndent = leadingSpaces
              .replace(/ /g, '&nbsp;')
              .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
            return preservedIndent + restOfLine;
          })
          .join('<br/>');
        return `<pre>${preservedContent}</pre>`;
      }
    );
  }, []);

  // Generate AI Summary on-demand with caching
  const fetchAiSummary = async (_isRetry = false) => {
    if (!currentArticle) return;

    // Check premium access first
    const hasAccess = await checkPremiumAccess('AI Summary');
    if (!hasAccess) {
      return;
    }

    setSummaryState(prev => ({
      ...prev,
      summaryLoading: true,
      summaryError: null
    }));

    try {
      const result = await firebaseService.getAiSummary(currentArticle.id);

      if (result.success && result.summary) {

        const summaryData = {
          summary: result.summary,
          originalUrl: currentArticle.url,
          generatedAt: result.generatedAt || new Date().toISOString(),
          wordCount: result.wordCount || 0,
        };

        // Process HTML for whitespace preservation
        const processedHtml = processHtmlForWhitespace(result.summary);

        setSummaryState(prev => ({
          ...prev,
          aiSummary: summaryData,
          summaryError: null,
          processedSummaryHtml: processedHtml
        }));

        // Auto-switch to summary view
        setViewMode('summary');

        // Show success message for newly generated summaries
        if (!result.cached) {
          Alert.alert(
            'Summary Generated!',
            `AI summary created with ${result.wordCount} words. This summary has been saved for future use.`,
            [{ text: 'OK', style: 'default' }]
          );
        }
      } else {
        const errorMessage = result.error || 'Failed to generate AI summary';
        setSummaryState(prev => ({
          ...prev,
          summaryError: errorMessage
        }));

        // Log detailed error to Crashlytics
        const errorDetails = `AI Summary generation failed for article: ${currentArticle.title} (ID: ${currentArticle.id}). Error: ${errorMessage}. URL: ${currentArticle.url}`;
        firebaseApp.logError(errorDetails, new Error(errorMessage));

        // Also log as event with structured parameters
        firebaseApp.logEvent('ai_summary_generation_failed', {
          articleId: currentArticle.id,
          articleUrl: currentArticle.url,
          articleTitle: currentArticle.title,
          errorMessage: errorMessage,
          timestamp: new Date().toISOString(),
        });

        // Show user-friendly error modal
        setErrorModalData({
          title: 'AI Summary Unavailable',
          message: 'I\'m so sorry! Something is failing on the backend. The error has been logged and we\'ll be on it soon. Please try again in a few minutes or contact me directly for help.',
          details: errorMessage
        });
        setErrorModalVisible(true);
      }
    } catch (error) {
      const isTimeoutError = error instanceof Error && error.message.includes('timeout');
      const networkErrorMessage = isTimeoutError
        ? 'Network timeout during summary generation'
        : 'Network error during summary generation';

      setSummaryState(prev => ({
        ...prev,
        summaryError: networkErrorMessage
      }));

      // Log detailed error to Crashlytics
      const errorDetails = `AI Summary network error for article: ${currentArticle.title} (ID: ${currentArticle.id}). Type: ${isTimeoutError ? 'timeout' : 'network'}. Error: ${error instanceof Error ? error.message : String(error)}. URL: ${currentArticle.url}`;
      firebaseApp.logError(errorDetails, error instanceof Error ? error : new Error(String(error)));

      // Also log as event with structured parameters
      firebaseApp.logEvent('ai_summary_network_error', {
        articleId: currentArticle.id,
        articleUrl: currentArticle.url,
        articleTitle: currentArticle.title,
        errorType: isTimeoutError ? 'timeout' : 'network',
        errorMessage: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });

      // Show user-friendly error modal
      const userMessage = isTimeoutError
        ? 'The AI summary generation took longer than expected. We\'ve been alerted and are looking into it. Please try again in a few minutes.'
        : 'I\'m so sorry! Something is failing on the backend. The error has been logged and we\'ll be on it soon. Please try again in a few minutes or contact me directly for help.';

      setErrorModalData({
        title: isTimeoutError ? 'Generation Timeout' : 'AI Summary Unavailable',
        message: userMessage,
        details: error instanceof Error ? error.message : String(error)
      });
      setErrorModalVisible(true);
    } finally {
      setSummaryState(prev => ({ ...prev, summaryLoading: false }));
    }
  };



  // Handle like button press
  const handleLikePress = async () => {
    if (!currentArticle || votingState.isVoting) return;

    const newStatus = votingState.voteStatus === 'liked' ? null : 'liked';

    // Immediate optimistic update
    setVotingState(prev => ({
      ...prev,
      optimisticVoteStatus: newStatus,
      isVoting: true
    }));

    try {
      if (votingState.voteStatus === 'liked') {
        // Remove existing like
        await removeUpvoteFromArticle(currentArticle.id);
        setVotingState(prev => ({ ...prev, voteStatus: null }));
      } else {
        // Add like (and remove dislike if exists)
        if (votingState.voteStatus === 'disliked') {
          await removeDownvoteFromArticle(currentArticle.id);
        }
        await markArticleAsLiked(currentArticle.id);
        setVotingState(prev => ({ ...prev, voteStatus: 'liked' }));
      }
      // Sync optimistic state with actual state
      setVotingState(prev => ({
        ...prev,
        optimisticVoteStatus: votingState.voteStatus === 'liked' ? null : 'liked'
      }));
    } catch (error) {
      console.error('Error handling like:', error);
      // Revert optimistic update on error
      setVotingState(prev => ({
        ...prev,
        optimisticVoteStatus: votingState.voteStatus
      }));
    } finally {
      setVotingState(prev => ({ ...prev, isVoting: false }));
    }
  };

  // Handle dislike button press
  const handleDislikePress = async () => {
    if (!currentArticle || votingState.isVoting) return;

    const newStatus = votingState.voteStatus === 'disliked' ? null : 'disliked';

    // Immediate optimistic update
    setVotingState(prev => ({
      ...prev,
      optimisticVoteStatus: newStatus,
      isVoting: true
    }));

    try {
      if (votingState.voteStatus === 'disliked') {
        // Remove existing dislike
        await removeDownvoteFromArticle(currentArticle.id);
        setVotingState(prev => ({ ...prev, voteStatus: null }));
      } else {
        // Add dislike (and remove like if exists)
        if (votingState.voteStatus === 'liked') {
          await removeUpvoteFromArticle(currentArticle.id);
        }
        await markArticleAsDisliked(currentArticle.id);
        setVotingState(prev => ({ ...prev, voteStatus: 'disliked' }));
      }
      // Sync optimistic state with actual state
      setVotingState(prev => ({
        ...prev,
        optimisticVoteStatus: votingState.voteStatus === 'disliked' ? null : 'disliked'
      }));
    } catch (error) {
      console.error('Error handling dislike:', error);
      // Revert optimistic update on error
      setVotingState(prev => ({
        ...prev,
        optimisticVoteStatus: votingState.voteStatus
      }));
    } finally {
      setVotingState(prev => ({ ...prev, isVoting: false }));
    }
  };

  // Toggle between article and summary view
  const toggleViewMode = async () => {
    // Reset progress when switching to summary view
    progressBarWidth.setValue(0);

    if (viewMode === 'article') {
      // Check premium access before switching to summary view
      const hasAccess = await checkPremiumAccess('AI Summary');
      if (!hasAccess) {
        return;
      }

      // Switch to summary view immediately
      setViewMode('summary');

      // If we don't have a summary yet, generate it
      if (!summaryState.aiSummary && !summaryState.summaryLoading) {
        fetchAiSummary();
      } else if (summaryState.aiSummary && !summaryState.processedSummaryHtml) {
        // Process existing summary HTML if not already processed
        const processedHtml = processHtmlForWhitespace(summaryState.aiSummary.summary);
        setSummaryState(prev => ({ ...prev, processedSummaryHtml: processedHtml }));
      }
    } else {
      setViewMode('article');
    }
  };

  const generateTranslation = async (language: SupportedLanguage) => {
    if (!currentArticle) return;

    // Check premium access first
    const hasAccess = await checkPremiumAccess('AI Translation');
    if (!hasAccess) {
      return;
    }

    progressBarWidth.setValue(0);
    setViewMode('summary');

    try {
      setTranslationState(prev => ({
        ...prev,
        translationLoading: true,
        translationError: null,
        currentLanguage: language
      }));

      const result = await firebaseService.getTranslation(currentArticle.id, language);

      if (result.success && result.translation) {
        const translationResult: TranslationData = {
          translation: result.translation,
          generatedAt: result.generatedAt || new Date().toISOString(),
          language: result.language || language,
          cached: result.cached || false,
        };
        setTranslationState(prev => ({
          ...prev,
          translationData: translationResult,
          translationError: null
        }));
      } else {
        setTranslationState(prev => ({
          ...prev,
          translationError: result.error || 'Failed to generate translation'
        }));
        Alert.alert(
          'Translation Failed',
          result.error || 'Failed to generate translation. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      setTranslationState(prev => ({
        ...prev,
        translationError: error instanceof Error ? error.message : 'Unknown error'
      }));
      Alert.alert(
        'Translation Error',
        'An unexpected error occurred. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setTranslationState(prev => ({ ...prev, translationLoading: false }));
    }
  };

  const handleBackToOriginal = () => {
    setTranslationState({
      translationData: null,
      translationLoading: false,
      translationError: null,
      currentLanguage: null,
    });
  };

  // Optimized scroll handler for reading progress with higher frequency
  const lastProgressRef = useRef(0);
  const isScrollHandlingRef = useRef(false);
  const progressUpdateFrameRef = useRef<number | null>(null);

  const handleScroll = useCallback((event: any) => {
    if (viewMode !== 'summary' || summaryState.summaryLoading || translationState.translationLoading) return;

    // Extract event data immediately to avoid synthetic event pooling issues
    const nativeEvent = event?.nativeEvent;
    if (!nativeEvent?.contentOffset || !nativeEvent?.contentSize || !nativeEvent?.layoutMeasurement) {
      return;
    }

    const scrollY = nativeEvent.contentOffset.y || 0;
    const contentHeight = nativeEvent.contentSize.height || 0;
    const viewHeight = nativeEvent.layoutMeasurement.height || 0;

    // Cancel any pending frame
    if (progressUpdateFrameRef.current) {
      cancelAnimationFrame(progressUpdateFrameRef.current);
    }

    // Use requestAnimationFrame for smooth, frequent updates
    progressUpdateFrameRef.current = requestAnimationFrame(() => {
      try {
        // Calculate progress percentage
        const maxScroll = Math.max(contentHeight - viewHeight - 20, 0);
        const rawProgress = maxScroll > 0 ? (scrollY / maxScroll) * 100 : 0;
        const roundedProgress = Math.min(Math.round(rawProgress / 2) * 2, 100); // Update every 2%

        // Update more frequently for smoother progress bar
        if (Math.abs(roundedProgress - lastProgressRef.current) >= 2) {
          lastProgressRef.current = roundedProgress;

          // Animate progress bar width
          Animated.timing(progressBarWidth, {
            toValue: roundedProgress,
            duration: 150,
            useNativeDriver: false,
          }).start();
        }

        // Debounced completion check
        if (roundedProgress >= 100 && !currentArticleIsRead && currentArticle && !isScrollHandlingRef.current) {
          isScrollHandlingRef.current = true;

          // Clear any existing timeout for completion
          if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
          }

          scrollTimeoutRef.current = setTimeout(() => {
            setCurrentArticleIsRead(true);
            markArticleAsRead(currentArticle.id, currentArticle.tags, 0, true);
            triggerCelebration();
            isScrollHandlingRef.current = false;
          }, 300); // Debounce completion to avoid multiple triggers
        }

        progressUpdateFrameRef.current = null;
      } catch (error) {
        console.warn('Scroll handler error:', error);
        progressUpdateFrameRef.current = null;
      }
    });
  }, [viewMode, summaryState.summaryLoading, translationState.translationLoading, currentArticleIsRead, currentArticle?.id, currentArticle?.tags, markArticleAsRead, triggerCelebration]);

  const handleGenerateTranslatedSummary = useCallback(() => {
    closeModal();

    // If user has a preferred language and remember setting is on, use it directly
    if (state.translationSettings.rememberLanguage && state.translationSettings.preferredLanguage) {
      generateTranslation(state.translationSettings.preferredLanguage as SupportedLanguage);
    } else {
      // Show language selection modal
      setLanguageModalVisible(true);
    }
  }, [state.translationSettings.rememberLanguage, state.translationSettings.preferredLanguage, generateTranslation]);

  const handleLanguageSelection = useCallback((language: SupportedLanguage) => {
    setLanguageModalVisible(false);
    generateTranslation(language);
  }, [generateTranslation]);

  const closeLanguageModal = useCallback(() => {
    setLanguageModalVisible(false);
  }, []);

  const closeErrorModal = useCallback(() => {
    setErrorModalVisible(false);
    setErrorModalData(null);
  }, []);

  // Handle font size change with persistence
  const handleFontSizeChange = useCallback(async (size: 'small' | 'medium' | 'large') => {
    setSummaryState(prev => ({ ...prev, summarySize: size }));
    await updateTranslationSettings({ summaryFontSize: size });
  }, [updateTranslationSettings]);

  const handleShare = useCallback(async () => {
    if (!currentArticle) return;

    try {
      console.log('Sharing article...', currentArticle.url);
      await Share.share({
        message: currentArticle.url,
        url: currentArticle.url,
      });
    } catch (error) {
      console.error('Error sharing article:', error);
    }
  }, [currentArticle]);

  const handleToggleFavorite = useCallback(() => {
    if (!currentArticle) return;

    if (isFavorite(currentArticle.id)) {
      removeFavorite(currentArticle.id);
    } else {
      addFavorite(currentArticle);
    }
  }, [currentArticle, isFavorite, removeFavorite, addFavorite]);

  const handleOpenInBrowser = useCallback(async () => {
    if (!currentArticle) return;

    try {
      await Linking.openURL(currentArticle.url);
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  }, [currentArticle]);

  // Listen to podcast
  const handleListenToPodcast = async () => {
    if (!currentArticle ||
        !currentArticle.podcastUrl ||
        currentArticle.podcastStatus !== 'COMPLETED') return;

    closeModal();

    // Check premium access
    const hasAccess = await checkPremiumAccess('Podcast Listening');
    if (!hasAccess) {
      return;
    }

    // Show the player first, then load the podcast
    showPlayer();
    await loadPodcast(currentArticle.podcastUrl, currentArticle.id, currentArticle.title);
  };

  // Handle podcast toggle for header button
  const handleHeaderPodcastToggle = async () => {
    if (!currentArticle) return;

    const isPlayerActive = podcastState.isPlayerVisible &&
                          podcastState.currentArticleId === currentArticle.id;

    if (isPlayerActive) {
      // Stop current podcast completely
      await hidePlayer();
    } else {
      // Start podcast
      await handleListenToPodcast();
    }
  };

  // Memoized helper function to get podcast button state for header
  const getHeaderPodcastButtonState = useMemo(() => {
    if (!currentArticle) return null;

    const isPodcastAvailable = currentArticle.podcastStatus === 'COMPLETED';
    const isPlayerActive = podcastState.isPlayerVisible &&
                          podcastState.currentArticleId === currentArticle.id;
    const hasAccess = hasPremiumAccess();
    const isDisabled = !isPodcastAvailable;

    return {
      isPodcastAvailable,
      isPlayerActive,
      hasAccess,
      isDisabled,
      buttonStyle: [
        isDisabled
          ? styles.podcastButtonDisabled
          : hasAccess
            ? [styles.podcastButton, styles.activePodcastButton]
            : styles.disabledViewModeButton
      ],
      onPress: isDisabled
        ? undefined
        : hasAccess
          ? handleHeaderPodcastToggle
          : () => checkPremiumAccess('Podcast Listening'),
      icon: (isPlayerActive ? "stop-circle" : "headset") as keyof typeof Ionicons.glyphMap,
      iconColor: isDisabled
        ? theme.colors.background
        : hasAccess
          ? theme.colors.buttonTextActive
          : theme.colors.buttonTextInactive,
      label: SCREEN_WIDTH > RESPONSIVE_BREAKPOINT
        ? (isPlayerActive ? "Stop" : "Podcast")
        : "",
      textStyle: [
        styles.podcastButtonText,
        isDisabled
          ? styles.podcastButtonTextDisabled
          : hasAccess
            ? null
            : styles.podcastButtonTextInactive
      ],
    };
  }, [currentArticle?.podcastStatus, podcastState.isPlayerVisible, podcastState.currentArticleId, hasPremiumAccess, theme.colors]);

  // Memoized podcast button info
  const getPodcastButtonInfo = useMemo((): { label: string; disabled: boolean; icon: keyof typeof Ionicons.glyphMap } => {
    if (!currentArticle?.podcastStatus) {
      return { label: 'Podcast Not Available', disabled: true, icon: 'play-circle-outline' };
    }

    switch (currentArticle.podcastStatus) {
      case 'PENDING':
        return { label: 'Podcast Generation Pending...', disabled: true, icon: 'time-outline' };
      case 'PROCESSING':
        return { label: 'Generating Podcast...', disabled: true, icon: 'sync-outline' };
      case 'COMPLETED':
        return { label: 'Listen to the Podcast', disabled: false, icon: 'play-circle-outline' };
      case 'FAILED':
        return { label: 'Podcast Generation Failed', disabled: true, icon: 'alert-circle-outline' };
      default:
        return { label: 'Podcast Not Available', disabled: true, icon: 'play-circle-outline' };
    }
  }, [currentArticle?.podcastStatus]);

  // Pan gesture handlers for modal drag-to-close
  const panGesture = Gesture.Pan()
    .onChange((event) => {
      panY.setValue(Math.max(0, event.translationY));
    })
    .onEnd((event) => {
      const { translationY, velocityY } = event;

      if (translationY > 100 || velocityY > 500) {
        // Close modal if dragged down enough or with sufficient velocity
        if (!isAnimating.current) {
          closeModal();
        }
      } else {
        // Snap back to original position
        Animated.spring(panY, {
          toValue: 0,
          damping: 15,
          mass: 1,
          useNativeDriver: true,
        }).start();
      }
    });

  const openModal = useCallback(() => {
    if (isAnimating.current) return;

    setActionsModalVisible(true);
    modalTranslateY.setValue(MODAL_SETTING.HEIGHT);
    modalOpacity.setValue(0);
    panY.setValue(0);
    isAnimating.current = true;

    Animated.parallel([
      Animated.timing(modalOpacity, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(modalTranslateY, {
        toValue: 0,
        damping: 20,
        mass: 0.2,
        stiffness: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      isAnimating.current = false;
    });
  }, [modalTranslateY, modalOpacity, panY]);

  // Add unmount cleanup effect
  useEffect(() => {
    return () => {
      // Component unmount cleanup
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (scrollTimeoutRef2.current) {
        clearTimeout(scrollTimeoutRef2.current);
      }
      if (celebrationTimeoutRef.current) {
        clearTimeout(celebrationTimeoutRef.current);
      }
      if (progressUpdateFrameRef.current) {
        cancelAnimationFrame(progressUpdateFrameRef.current);
      }

      // Stop progress bar animation
      progressBarWidth.stopAnimation();

      // Reset refs
      isScrollHandlingRef.current = false;
      lastProgressRef.current = 0;
      isAnimating.current = false;
    };
  }, []);

  const closeModal = useCallback(() => {
    if (isAnimating.current) return;

    isAnimating.current = true;

    Animated.parallel([
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.spring(modalTranslateY, {
        toValue: MODAL_SETTING.HEIGHT,
        damping: 20,
        mass: 0.1,
        stiffness: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      isAnimating.current = false;
      setActionsModalVisible(false);
    });
  }, [modalOpacity, modalTranslateY]);

  const closeModalInstant = useCallback(() => {
    if (isAnimating.current) {
      // Stop any ongoing animations
      modalOpacity.stopAnimation();
      modalTranslateY.stopAnimation();
      panY.stopAnimation();
    }
    isAnimating.current = false;
    setActionsModalVisible(false);
  }, [modalOpacity, modalTranslateY, panY]);

  // Early return checks after all hooks are defined
  if (!currentArticle) {
    // Special case: if we're viewing backlog but no article, show completion message
    if (isViewingBacklogArticle) {
      const remainingBacklogArticles = getBacklogArticles();

      return (
        <View style={styles.loadingContainer}>
          <Ionicons
            name="checkmark-circle"
            size={64}
            color={theme.colors.primary}
            style={{marginBottom: 16}}
          />
          {remainingBacklogArticles.length > 0 ? (
            <Text style={[styles.loadingText, { fontSize: 20, marginBottom: 24 }]}>
              You're all caught up for now!
            </Text>
          ) : (
            <Text style={[styles.loadingText, { fontSize: 20, marginBottom: 24 }]}>
              You've read all your backlog articles!
            </Text>
          )}

          {remainingBacklogArticles.length > 0 ? (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.colors.primary, marginBottom: 12 }]}
              onPress={() => navigation.navigate('Backlog' as never)}
              activeOpacity={0.8}
            >
              <Ionicons name="library-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>
                Read Another ({remainingBacklogArticles.length} left)
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }]}
            onPress={handleReturnToToday}
            activeOpacity={0.8}
          >
            <Ionicons name="today-outline" size={20} color={theme.colors.text} style={{ marginRight: 8 }} />
            <Text style={[styles.actionButtonText, { color: theme.colors.text }]}>
              Return to Today's Article
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Default no article message
    return (
      <View style={[{ flex: 1, backgroundColor: theme.colors.background }, { justifyContent: 'center', alignItems: 'center', padding: 40 }]}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: theme.colors.text, marginBottom: 12, textAlign: 'center' }}>No Article Available</Text>
        <Text style={{ fontSize: 16, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 24 }}>
          Your daily coding routine isn't ready yet. Check back later!
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Backlog Banner - Show when viewing backlog article */}
      {isViewingBacklogArticle && (
        <View style={styles.backlogBanner}>
          <Ionicons name="time-outline" size={20} color={theme.colors.orange} />
          <Text style={styles.backlogBannerText}>
            Reading from backlog - This article is from a previous day
          </Text>
          <TouchableOpacity
            style={styles.returnButton}
            onPress={handleReturnToToday}
            activeOpacity={0.8}
          >
            <Text style={styles.returnButtonText}>Return to Today</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Header with View Mode Toggle */}
      <View style={{...styles.header, backgroundColor: theme.colors.card }}>
        <View style={styles.headerButtonsContainer}>
          <TouchableOpacity
            style={[
              styles.viewModeButton,
              viewMode === 'article' && styles.activeViewModeButton
            ]}
            onPress={() => {
              setViewMode('article');
            }}
          >
            <Ionicons
              name="globe-outline"
              size={16}
              color={viewMode === 'article' ? theme.colors.buttonTextActive : theme.colors.buttonTextInactive}
            />
            <Text style={[
              styles.viewModeText,
              viewMode === 'article' && styles.activeViewModeText
            ]}>
              Read
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.viewModeButton,
              viewMode === 'summary' && styles.activeViewModeButton,
              summaryState.summaryLoading && styles.loadingButton,
              !hasPremiumAccess() && viewMode !== 'summary' && styles.disabledViewModeButton
            ]}
            onPress={toggleViewMode}
            disabled={summaryState.summaryLoading}
          >
            {summaryState.summaryLoading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Ionicons
                name={hasPremiumAccess() ? "sparkles" : "lock-closed"}
                size={16}
                color={viewMode === 'summary' ? theme.colors.buttonTextActive : (hasPremiumAccess() ? theme.colors.buttonTextInactive : theme.colors.textSecondary)}
              />
            )}
            <Text style={[
              styles.viewModeText,
              viewMode === 'summary' && styles.activeViewModeText,
              !hasPremiumAccess() && viewMode !== 'summary' && { color: theme.colors.textSecondary }
            ]}>
              Summary
            </Text>
          </TouchableOpacity>

          {(() => {
            const podcastButtonState = getHeaderPodcastButtonState;
            if (!podcastButtonState) return null;

            return (
              <TouchableOpacity
                style={[styles.viewModeButton, podcastButtonState.buttonStyle]}
                onPress={podcastButtonState.onPress}
                disabled={podcastButtonState.isDisabled}
              >
                <Ionicons
                  name={podcastButtonState.icon}
                  size={16}
                  color={podcastButtonState.iconColor}
                />
                <Text style={podcastButtonState.textStyle}>
                  {podcastButtonState.label}
                </Text>
              </TouchableOpacity>
            );
          })()}
        </View>

        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={() => {
            if (isFavorite(currentArticle.id)) {
              removeFavorite(currentArticle.id);
            } else {
              addFavorite(currentArticle);
            }
          }}
        >
          <Ionicons
            name={currentArticle ? (isFavorite(currentArticle.id) ? "heart" : "heart-outline") : "heart-outline"}
            size={20}
            color={currentArticle && isFavorite(currentArticle.id) ? theme.colors.primary : theme.colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* Podcast Player - Only show when player is visible */}
      {podcastState.isPlayerVisible && (
        <PodcastPlayer />
      )}

      {/* Progress Bar - Only visible in summary view */}
      {viewMode === 'summary' && (
        <View style={[styles.progressBarContainer, { backgroundColor: theme.colors.background }]}>
          <View style={styles.progressBarTrack}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: progressBarWidth.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                    extrapolate: 'clamp',
                  })
                }
              ]}
            />
          </View>
        </View>
      )}

      {/* Floating Action Buttons */}
      <View style={styles.floatingActions}>
        {/* Like Button */}
        {!isViewingBacklogArticle && (
          <TouchableOpacity
            style={[
              styles.floatingActionButton,
              {
                backgroundColor: votingState.optimisticVoteStatus === 'liked'
                  ? theme.colors.success
                  : theme.colors.disabled,
                marginTop: 0,
              }
            ]}
            onPress={handleLikePress}
            disabled={votingState.isVoting}
          >
            <Ionicons
              name={votingState.optimisticVoteStatus === 'liked' ? "thumbs-up" : "thumbs-up-outline"}
              size={18}
              color={COLORS.WHITE}
            />
          </TouchableOpacity>
        )}

        {/* Dislike Button */}
        {!isViewingBacklogArticle && (
          <TouchableOpacity
            style={[
              styles.floatingActionButton,
              {
                backgroundColor: votingState.optimisticVoteStatus === 'disliked'
                  ? theme.colors.error
                  : theme.colors.disabled,
              }
            ]}
            onPress={handleDislikePress}
            disabled={votingState.isVoting}
          >
            <Ionicons
              name={votingState.optimisticVoteStatus === 'disliked' ? "thumbs-down" : "thumbs-down-outline"}
              size={18}
              color={COLORS.WHITE}
            />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.floatingActionButton,
            currentArticleIsRead && styles.floatingActionButtonComplete,
            {
              backgroundColor: currentArticleIsRead
                ? theme.colors.success
                : theme.colors.disabled,
            },
            __DEV__ && currentArticleIsRead && styles.devModeButton
          ]}
          onPress={() => {
            if (currentArticle) {
              if (!currentArticleIsRead) {
                setCurrentArticleIsRead(true);
                markArticleAsRead(currentArticle.id, currentArticle.tags, 0, true);
                triggerCelebration();
              } else if (__DEV__) {
                // In dev mode, allow toggling back to unread
                setCurrentArticleIsRead(false);
                markArticleAsUnread(currentArticle.id);
              }
            }
          }}
          disabled={!!currentArticleIsRead && !__DEV__}
        >
          <Ionicons
            name={currentArticleIsRead ? "checkmark-circle" : "checkmark-circle-outline"}
            size={18}
            color={COLORS.WHITE}
          />
          {__DEV__ && currentArticleIsRead && (
            <Text style={styles.devModeText}>UNREAD</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.floatingActionButton, { backgroundColor: theme.colors.primary}]}
          onPress={openModal}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={18}
            color={theme.colors.secondary}
          />
        </TouchableOpacity>
      </View>

      {/* Content Area */}
      <View style={styles.contentContainer}>
      {viewMode === 'article' ? (
        <>
          {webViewComponent}

          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Loading article...</Text>
              <Text style={styles.loadingSubtext}>{currentArticle.title}</Text>
            </View>
          )}
        </>
      ) : (
        <View style={[styles.summaryContainer, { backgroundColor: theme.colors.background }]}>
          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            removeClippedSubviews={true}
          >
          {summaryState.summaryError ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning-outline" size={48} color={theme.colors.error} />
              <Text style={styles.errorTitle}>Summary Not Available</Text>
              <Text style={styles.errorText}>{summaryState.summaryError}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => fetchAiSummary(false)}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : (translationState.translationData || summaryState.aiSummary) ? (
            <View style={[styles.summaryScreenContainer, { backgroundColor: theme.colors.background }]}>
              {/* Summary Card */}
              <View style={[styles.summaryCard, {
                backgroundColor: theme.colors.surface,
                borderWidth: isDarkMode ? 1 : 0,
                borderColor: isDarkMode ? theme.colors.border : 'transparent',
                shadowColor: isDarkMode ? '#000' : '#000',
                shadowOpacity: isDarkMode ? 0.3 : 0.1,
              }]}>
                {/* First Row */}
                <View style={styles.summaryCardFirstRow}>
                  <View style={styles.summaryBadge}>
                    <Ionicons
                      name={translationState.translationData ? "language" : "sparkles"}
                      size={16}
                      color={theme.colors.primary}
                    />
                    <Text style={styles.summaryBadgeText}>
                      {translationState.translationData && translationState.currentLanguage ? (() => {
                        const lang = LANGUAGE_OPTIONS.find(l => l.code === translationState.currentLanguage);
                        return `${lang?.flag} ${lang?.name}`;
                      })() : 'AI Summary'}
                    </Text>
                  </View>

                  <View style={styles.summaryCardFirstRowRight}>
                    {translationState.translationData && (
                      <TouchableOpacity
                        style={styles.backToOriginalButton}
                        onPress={handleBackToOriginal}
                      >
                        <Ionicons name="arrow-back" size={16} color={theme.colors.primary} />
                        <Text style={[styles.backToOriginalText, { color: theme.colors.primary }]}>
                          Back to English
                        </Text>
                      </TouchableOpacity>
                    )}
                    {!translationState.translationData && (
                      <TouchableOpacity
                        style={styles.translateButton}
                        onPress={handleGenerateTranslatedSummary}
                      >
                        <Ionicons
                          name={"language-outline"}
                          size={16}
                          color={COLORS.GRAY_LIGHT}
                        />
                        <Text style={styles.translateButtonText}>
                          Translate
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Second Row */}
                <View style={styles.summaryCardSecondRow}>
                  <Text style={styles.summaryMeta}>
                    {translationState.translationData ?
                      `${new Date(translationState.translationData.generatedAt).toLocaleDateString()} • ${translationState.translationData.cached ? 'Cached' : 'Generated'}` :
                      `${summaryState.aiSummary?.wordCount || ''} words • ${summaryState.aiSummary ? new Date(summaryState.aiSummary.generatedAt).toLocaleDateString() : ''}`
                    }
                  </Text>

                  <View style={styles.summaryControls}>
                    <TouchableOpacity
                      style={[styles.miniButton, summaryState.summarySize === 'small' && styles.miniButtonActive]}
                      onPress={() => handleFontSizeChange('small')}
                    >
                      <Text style={[styles.miniButtonText, summaryState.summarySize === 'small' && styles.miniButtonTextActive, { fontSize: 11 }]}>A</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.miniButton, summaryState.summarySize === 'medium' && styles.miniButtonActive]}
                      onPress={() => handleFontSizeChange('medium')}
                    >
                      <Text style={[styles.miniButtonText, summaryState.summarySize === 'medium' && styles.miniButtonTextActive, { fontSize: 13 }]}>A</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.miniButton, summaryState.summarySize === 'large' && styles.miniButtonActive]}
                      onPress={() => handleFontSizeChange('large')}
                    >
                      <Text style={[styles.miniButtonText, summaryState.summarySize === 'large' && styles.miniButtonTextActive, { fontSize: 15 }]}>A</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              {/* /Summary Card */}

              <Text style={{
                ...styles.summaryTitle,
                color: isDarkMode ? '#FFFFFF' : theme.colors.text
              }}>
                {currentArticle.title}
              </Text>

              <View style={styles.summaryAuthor}>
                <Text style={styles.summaryAuthorText}>
                  Original from {currentArticle.source || new URL(currentArticle.url).hostname.replace('www.', '')} • {currentArticle.estimatedReadTime} min read
                </Text>
              </View>

              {translationState.translationLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <Text style={styles.loadingText}>Generating Translation...</Text>
                  <Text style={styles.loadingSubtext}>
                    Translating to {translationState.currentLanguage ? LANGUAGE_OPTIONS.find(l => l.code === translationState.currentLanguage)?.name : 'selected language'}
                  </Text>
                </View>
              ) : translationState.translationError ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>Translation Error</Text>
                  <Text style={styles.errorMessage}>{translationState.translationError}</Text>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => translationState.currentLanguage && generateTranslation(translationState.currentLanguage)}
                  >
                    <Text style={styles.retryButtonText}>Try Again</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[styles.summaryContentContainer, { backgroundColor: theme.colors.background }]}>
                  <RenderHtml
                    source={{ html: translationState.translationData ? translationState.translationData.translation : summaryState.processedSummaryHtml }}
                    contentWidth={SCREEN_WIDTH - 32}
                    defaultTextProps={{
                      selectable: false,
                    }}
                    systemFonts={['Georgia', 'Times New Roman', 'serif', 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Source Code Pro', 'Menlo', 'Courier', 'Roboto', 'Roboto-Regular', 'sans-serif', 'monospace']}
                    renderersProps={{
                      ul: {
                        markerBoxStyle: {
                          paddingRight: 12,
                          alignItems: 'flex-start',
                          justifyContent: 'flex-start',
                        },
                        getFallbackListStyleTypeFromNestLevel: (nestLevel: number) => {
                          return nestLevel % 2 === 0 ? 'disc' : 'circle';
                        },
                      },
                      ol: {
                        markerBoxStyle: {
                          paddingRight: 12,
                          alignItems: 'flex-start',
                          justifyContent: 'flex-start',
                        },
                      },
                    }}

                    tagsStyles={{
                      body: {
                        color: theme.colors.text,
                        fontSize: summaryState.summarySize === 'small' ? 16 : summaryState.summarySize === 'large' ? 20 : 18,
                        lineHeight: summaryState.summarySize === 'small' ? 26 : summaryState.summarySize === 'large' ? 34 : 30,
                        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                        fontWeight: '400',
                        backgroundColor: theme.colors.background,
                      },
                      h1: {
                        color: theme.colors.text,
                        fontSize: summaryState.summarySize === 'small' ? 26 : summaryState.summarySize === 'large' ? 34 : 30,
                        fontWeight: '700',
                        marginTop: 32,
                        marginBottom: 16,
                        lineHeight: summaryState.summarySize === 'small' ? 34 : summaryState.summarySize === 'large' ? 42 : 38,
                        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                      },
                      h2: {
                        color: theme.colors.text,
                        fontSize: summaryState.summarySize === 'small' ? 22 : summaryState.summarySize === 'large' ? 30 : 26,
                        fontWeight: '600',
                        marginTop: 28,
                        marginBottom: 14,
                        lineHeight: summaryState.summarySize === 'small' ? 30 : summaryState.summarySize === 'large' ? 38 : 34,
                        borderBottomWidth: 1,
                        borderBottomColor: theme.colors.border || (isDarkMode ? '#404040' : '#E5E5E5'),
                        paddingBottom: 8,
                        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                      },
                      h3: {
                        color: theme.colors.text,
                        fontSize: summaryState.summarySize === 'small' ? 20 : summaryState.summarySize === 'large' ? 24 : 22,
                        fontWeight: '600',
                        marginTop: 24,
                        marginBottom: 12,
                        lineHeight: summaryState.summarySize === 'small' ? 28 : summaryState.summarySize === 'large' ? 32 : 30,
                        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                      },
                      h4: {
                        color: theme.colors.text,
                        fontSize: summaryState.summarySize === 'small' ? 18 : summaryState.summarySize === 'large' ? 22 : 20,
                        fontWeight: '600',
                        marginTop: 20,
                        marginBottom: 10,
                        lineHeight: summaryState.summarySize === 'small' ? 26 : summaryState.summarySize === 'large' ? 30 : 28,
                        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                      },
                      p: {
                        marginBottom: 20,
                        color: theme.colors.text,
                        lineHeight: summaryState.summarySize === 'small' ? 26 : summaryState.summarySize === 'large' ? 34 : 30,
                        fontSize: summaryState.summarySize === 'small' ? 16 : summaryState.summarySize === 'large' ? 20 : 18,
                        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                        textAlign: 'left',
                      },
                      pre: {
                        backgroundColor: theme.colors.surface,
                        color: theme.colors.text,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        padding: 18,
                        borderRadius: 12,
                        marginVertical: 16,
                        overflow: 'hidden',
                        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                        fontSize: summaryState.summarySize === 'small' ? 16 : summaryState.summarySize === 'large' ? 20 : 18,
                        lineHeight: summaryState.summarySize === 'small' ? 26 : summaryState.summarySize === 'large' ? 34 : 30,
                        fontVariant: ['tabular-nums'],
                      },
                      code: {
                        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                        fontSize: summaryState.summarySize === 'small' ? 16 : summaryState.summarySize === 'large' ? 20 : 18,
                        backgroundColor: theme.colors.surface,
                        color: theme.colors.text,
                      },
                      ul: {
                        marginBottom: 20,
                        paddingLeft: 0,
                        marginLeft: 8,
                      },
                      ol: {
                        marginBottom: 20,
                        paddingLeft: 0,
                        marginLeft: 8,
                      },
                      li: {
                        marginBottom: 12,
                        color: theme.colors.text,
                        lineHeight: summaryState.summarySize === 'small' ? 26 : summaryState.summarySize === 'large' ? 34 : 30,
                        paddingLeft: 0,
                        marginLeft: 0,
                        fontSize: summaryState.summarySize === 'small' ? 16 : summaryState.summarySize === 'large' ? 20 : 18,
                        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                        textAlign: 'left',
                      },
                      strong: {
                        fontWeight: '600',
                        color: theme.colors.text,
                        fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
                      },
                      em: {
                        fontStyle: 'italic',
                        color: theme.colors.text,
                        fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
                      },
                      blockquote: {
                        borderLeftWidth: 4,
                        borderLeftColor: theme.colors.primary,
                        paddingLeft: 16,
                        marginVertical: 16,
                        backgroundColor: theme.colors.surface || '#F8F9FA',
                        borderRadius: 8,
                        padding: 16,
                      },
                      a: {
                        color: theme.colors.primary,
                        textDecorationLine: 'underline',
                      },
                    }}
                  />
                </View>
              )}

              <TouchableOpacity
                style={[styles.originalLinkButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={() => setViewMode('article')}
              >
                <Ionicons name="open-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.originalLinkText}>View Full Article</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Generating AI Summary...</Text>
              <Text style={styles.loadingSubtext}>
                Using Google Gemini • This may take 30-90 seconds
              </Text>
            </View>
          )}
        </ScrollView>
        </View>
      )}
      </View>

      {/* Floating Action Buttons */}
      {/* Actions Sliding Panel */}
      {actionsModalVisible && (
        <View style={styles.slidingPanelOverlay}>
          <Animated.View style={[styles.slidingPanelBackdrop, { opacity: modalOpacity }]}>
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={closeModal}
            />
          </Animated.View>

          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[
                styles.slidingPanelContent,
                {
                  backgroundColor: theme.colors.surface,
                  transform: [
                    { translateY: Animated.add(modalTranslateY, panY) }
                  ]
                }
              ]}
            >
              {/* Drag Handle */}
              <View style={styles.dragHandle} />

              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Actions</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={closeModalInstant}
                >
                  <Ionicons name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.actionsList}>
                {/* Quick Actions Row */}
                <View style={styles.quickActionsRow}>
                  <TouchableOpacity
                    style={styles.quickActionItem}
                    onPress={() => {
                      closeModal();
                      handleShare();
                    }}
                  >
                    <View style={[styles.quickActionIcon, { backgroundColor: theme.colors.primary + '15' }]}>
                      <Ionicons name="share-outline" size={24} color={theme.colors.primary} />
                    </View>
                    <Text style={[styles.quickActionText, { color: theme.colors.text }]}>Share</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.quickActionItem}
                    onPress={() => {
                      closeModal();
                      handleToggleFavorite();
                    }}
                  >
                    <View style={[styles.quickActionIcon, { backgroundColor: theme.colors.primary + '15' }]}>
                      <Ionicons
                        name={currentArticle && isFavorite(currentArticle.id) ? "heart" : "heart-outline"}
                        size={24}
                        color={currentArticle && isFavorite(currentArticle.id) ? theme.colors.error : theme.colors.primary}
                      />
                    </View>
                    <Text style={[styles.quickActionText, { color: theme.colors.text }]}>
                      {currentArticle && isFavorite(currentArticle.id) ? 'Remove Favorite' : 'Add Favorite'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.quickActionItem}
                    onPress={() => {
                      closeModal();
                      handleOpenInBrowser();
                    }}
                  >
                    <View style={[styles.quickActionIcon, { backgroundColor: theme.colors.primary + '15' }]}>
                      <Ionicons name="open-outline" size={24} color={theme.colors.primary} />
                    </View>
                    <Text style={[styles.quickActionText, { color: theme.colors.text }]}>Open in Browser</Text>
                  </TouchableOpacity>
                </View>

                {!hasPremiumAccess() && (
                  <Text style={[styles.comingSoonText, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                    Premium Features
                  </Text>
                )}

                <TouchableOpacity
                  style={[
                    styles.actionItem,
                    { borderBottomColor: theme.colors.border },
                    !hasPremiumAccess() && { opacity: 0.6, backgroundColor: theme.colors.surface }
                  ]}
                  onPress={handleGenerateTranslatedSummary}
                >
                  <Ionicons
                    name={hasPremiumAccess() ? "language-outline" : "lock-closed"}
                    size={24}
                    color={hasPremiumAccess() ? theme.colors.primary : theme.colors.textSecondary}
                  />
                  <Text style={[
                    styles.actionText,
                    { color: hasPremiumAccess() ? theme.colors.text : theme.colors.textSecondary }
                  ]}>
                    Generate Translated Summary
                  </Text>
                </TouchableOpacity>

                {currentArticle?.podcastStatus && (() => {
                  const podcastInfo = getPodcastButtonInfo;
                  const isPodcastAvailable = currentArticle.podcastStatus === 'COMPLETED';
                  const isDisabled = podcastInfo.disabled;
                  const isClickable = isPodcastAvailable; // Allow clicks for completed podcasts regardless of subscription
                  const hasAccess = hasPremiumAccess();

                  return (
                    <TouchableOpacity
                      style={[
                        styles.actionItem,
                        { borderBottomColor: theme.colors.border },
                        (isDisabled || (!hasAccess && isPodcastAvailable)) && { opacity: 0.6, backgroundColor: theme.colors.surface }
                      ]}
                      onPress={isClickable && !podcastInfo.disabled ? handleListenToPodcast : undefined}
                      disabled={isDisabled}
                    >
                      <Ionicons
                        name={podcastInfo.icon}
                        size={24}
                        color={(isPodcastAvailable && hasAccess) ? theme.colors.primary : theme.colors.textSecondary}
                      />
                      <View>
                        <Text style={[
                          styles.actionText,
                          { color: (isPodcastAvailable && hasAccess) ? theme.colors.text : theme.colors.textSecondary }
                        ]}>
                          {podcastInfo.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })()}
              </View>
            </Animated.View>
          </GestureDetector>
        </View>
      )}

      {/* Language Selection Modal */}
      <Modal
        visible={languageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeLanguageModal}
      >
        <View style={styles.languageModalOverlay}>
          <View style={[styles.languageModalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.languageModalHeader}>
              <Text style={[styles.languageModalTitle, { color: theme.colors.text }]}>
                Choose Language
              </Text>
              <TouchableOpacity onPress={closeLanguageModal} style={styles.languageModalCloseButton}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.languageModalSubtitle, { color: theme.colors.textSecondary }]}>
              Which language would you like to translate to?
            </Text>
            <View style={styles.languageOptionsContainer}>
              {LANGUAGE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.code}
                  style={[styles.languageOption, { borderBottomColor: theme.colors.border }]}
                  onPress={() => handleLanguageSelection(option.code)}
                >
                  <Text style={styles.languageFlag}>{option.flag}</Text>
                  <Text style={[styles.languageName, { color: theme.colors.text }]}>
                    {option.name}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal
        visible={errorModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeErrorModal}
      >
        <View style={styles.errorModalOverlay}>
          <View style={[styles.errorModalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.errorModalHeader}>
              <View style={styles.errorIconContainer}>
                <Ionicons name="warning-outline" size={32} color={theme.colors.error} />
              </View>
              <TouchableOpacity onPress={closeErrorModal} style={styles.errorModalCloseButton}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.errorModalBody}>
              <Text style={[styles.errorModalTitle, { color: theme.colors.text }]}>
                {errorModalData?.title || 'Error'}
              </Text>
              <Text style={[styles.errorModalMessage, { color: theme.colors.textSecondary }]}>
                {errorModalData?.message || 'An unexpected error occurred.'}
              </Text>
            </View>

            <View style={styles.errorModalActions}>
              <TouchableOpacity
                style={[styles.errorModalButtonSecondary, { borderColor: theme.colors.border }]}
                onPress={() => {
                  closeErrorModal();
                  fetchAiSummary(false);
                }}
              >
                <Text style={[styles.errorModalButtonSecondaryText, { color: theme.colors.text }]}>
                  Try Again
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.errorModalButton, { backgroundColor: theme.colors.primary }]}
                onPress={closeErrorModal}
              >
                <Text style={[styles.errorModalButtonText, { color: COLORS.WHITE }]}>
                  Got it
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Celebration Overlay */}
      {showCelebration && (
        <View style={styles.celebrationOverlay} pointerEvents="none">
          {/* Main celebration icon */}
          <Animated.View
            style={[
              styles.celebrationMain,
              {
                transform: [{ scale: celebrationScale }],
              },
            ]}
          >
            <View style={styles.celebrationIconContainer}>
              <Ionicons name="trophy" size={60} color="#FFD700" />
              <Text style={styles.celebrationText}>Well Done! 🎉</Text>
              <Text style={styles.celebrationSubtext}>Article completed!</Text>
            </View>
          </Animated.View>

          {/* Confetti particles */}
          {confettiAnimations.map((anim, index) => (
            <Animated.View
              key={index}
              style={[
                styles.confettiParticle,
                {
                  opacity: anim.opacity,
                  transform: [
                    { translateY: anim.translateY },
                    { translateX: anim.translateX },
                    { rotate: anim.rotate.interpolate({
                        inputRange: [0, 360],
                        outputRange: ['0deg', '360deg'],
                      })
                    },
                  ],
                },
              ]}
            >
              <Ionicons
                name={index % 4 === 0 ? "star" : index % 4 === 1 ? "heart" : index % 4 === 2 ? "diamond" : "sparkles"}
                size={16 + (index % 3) * 4}
                color={index % 6 === 0 ? "#FFD700" : index % 6 === 1 ? "#FF6B6B" : index % 6 === 2 ? "#4ECDC4" : index % 6 === 3 ? "#45B7D1" : index % 6 === 4 ? "#96CEB4" : "#FFEAA7"}
              />
            </Animated.View>
          ))}
        </View>
      )}
    </View>
  );
});

ArticleScreen.displayName = 'ArticleScreen';

export default ArticleScreen;
