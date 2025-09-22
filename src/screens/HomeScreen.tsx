import React, { useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  Dimensions,
  Modal,
  Linking,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { ArticleWithProgress } from '../types';
import { useHomeArticles } from '../hooks';
import { usePremiumAccess } from '../hooks/usePremiumAccess';
import { usePodcast } from '../context/PodcastContext';
import PodcastPlayer from '../components/PodcastPlayer';
import { useToast } from '../components/Toast';

const { width } = Dimensions.get('window');
const RESPONSIVE_BREAKPOINT = 350;

const HomeScreen: React.FC = () => {
  const { theme } = useTheme();
  const { checkPremiumAccess, hasPremiumAccess, clearEntitlementCache } = usePremiumAccess();
  const { state: podcastState, loadPodcast, showPlayer, hidePlayer } = usePodcast();
  const { showSuccessToast, showErrorToast, showInfoToast } = useToast();
  const {
    state,
    fetchTodaysArticle,
    refreshTodaysArticle,
    getArticleWithProgress,
    getTotalReadArticles,
    getFavorites,
    refreshData,
    clearError,
    refreshSubscriptionStatus,
    addToBacklog,
    getBacklogArticles,
    isArticleInBacklog,
    cleanExpiredBacklogArticles,
  } = useApp();

  const navigation = useNavigation();
  const { articles: allHomeArticles, loading: articlesLoading, refresh: refreshArticles } = useHomeArticles();

  const [refreshing, setRefreshing] = useState(false);
  const [currentArticleWithProgress, setCurrentArticleWithProgress] = useState<ArticleWithProgress | null>(null);
  const [modalVisible, setModalVisible] = useState<{ articleTitle: string, articleUrl: string | null, articleId: string } | null>(null);
  const [delayModalVisible, setDelayModalVisible] = useState(false);
  const [streakUpdateTrigger, setStreakUpdateTrigger] = useState(0);

  // Memoize currentProgress calculation to prevent infinite re-renders
  const currentProgress = React.useMemo(() => {
    return state.currentArticle
      ? state.articleHistory.find(p => p.articleId === state.currentArticle?.id)
      : null;
  }, [state.currentArticle?.id, state.articleHistory]);

  // Initialize currentArticleWithProgress on component mount and when read status changes
  useEffect(() => {
    if (state.currentArticle) {
      const initialArticle = getArticleWithProgress(state.currentArticle);
      setCurrentArticleWithProgress(initialArticle);
    }
  }, [state.currentArticle?.id, currentProgress?.isRead, getArticleWithProgress]);

  // Clear error when component mounts
  useEffect(() => {
    if (state.error) {
      clearError();
    }
  }, [state.error, clearError]);

  // Get backlog articles early so we can use it in dependencies
  const backlogArticles = getBacklogArticles();

  const handleRefresh = React.useCallback(async () => {
    if (refreshing) return; // Prevent multiple simultaneous refreshes

    setRefreshing(true);
    try {
      const [articleChanged] = await Promise.allSettled([
        refreshTodaysArticle(),
        refreshArticles()
      ]);

      // Update current article if needed
      if (state.currentArticle) {
        const updatedArticle = getArticleWithProgress(state.currentArticle);
        setCurrentArticleWithProgress(updatedArticle);
      }

      // If article didn't change, refresh general data
      if (articleChanged.status === 'fulfilled' && !articleChanged.value) {
        await refreshData();
      }

      // Force streak recalculation after refresh
      setStreakUpdateTrigger(prev => prev + 1);
    } catch (error) {
      console.error('HomeScreen - Error refreshing:', error);
      showErrorToast('Failed to refresh content. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, refreshTodaysArticle, refreshArticles, state.currentArticle, getArticleWithProgress, refreshData, showErrorToast]);

  const handlePodcastToggle = async () => {
    if (!state.currentArticle || !state.currentArticle.podcastUrl) {
      console.log('🏠 HomeScreen: No podcast available for current article');
      return;
    }

    const isPlayerActive = podcastState.isPlayerVisible &&
                          podcastState.currentArticleId === state.currentArticle.id;

    console.log('🏠 HomeScreen: Podcast toggle - player active:', isPlayerActive);

    try {
      if (isPlayerActive) {
        // Stop current podcast - no verification needed for stopping
        await hidePlayer();
      } else {
        // Perform real-time verification before starting podcast
        const hasAccess = await checkPremiumAccess('Podcast Listening');

        if (!hasAccess) {
          return;
        }

        // Start new podcast (this will automatically stop any currently playing podcast)
        showPlayer();
        await loadPodcast(
          state.currentArticle.podcastUrl,
          state.currentArticle.id,
          state.currentArticle.title
        );
        // Podcast will start playing automatically due to shouldPlay: true
      }
    } catch (error) {
      Alert.alert(
        'Podcast Error',
        'Unable to play podcast. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleFetchArticle = async () => {
    try {
      await fetchTodaysArticle();
    } catch {
      Alert.alert('Error', 'Failed to fetch today\'s article');
    }
  };

  const handleNavigateToArticle = () => {
    navigation.navigate('Article' as never);
  };

  const handleNonSubscriberTap = async () => {
    console.log('🏠 HomeScreen: Non-subscriber tapped AI Summary - showing modal only');
    await checkPremiumAccess('AI Summary');
    console.log('🏠 HomeScreen: Modal shown, no navigation should occur');
  };

  const handleNonSubscriberPodcastTap = async () => {
    console.log('🏠 HomeScreen: Non-subscriber tapped Podcast - showing modal only');
    await checkPremiumAccess('Podcast Listening');
    console.log('🏠 HomeScreen: Podcast modal shown, no playback should occur');
  };

  const handleDelayArticle = async () => {
    if (!state.currentArticle) return;

    // Check if article is already in backlog
    if (isArticleInBacklog(state.currentArticle.id)) {
      showInfoToast('This article is already in your backlog.');
      return;
    }

    // Check if backlog is full (max 2 articles)
    const currentBacklog = getBacklogArticles();
    if (currentBacklog.length >= 2) {
      showErrorToast('X Your backlog is full (maximum 2 articles). Please read or remove an article from your backlog first.');

      return;
    }

    setDelayModalVisible(true);
  };

  const handleConfirmDelay = async () => {
    if (!state.currentArticle) return;

    try {
      await addToBacklog(state.currentArticle);
      setDelayModalVisible(false);
      showSuccessToast('📚 Article delayed! Check your backlog below.');

      // Small delay then force streak recalculation after delaying article
      setTimeout(() => {
        setStreakUpdateTrigger(prev => prev + 1);
      }, 200);
    } catch {
      setDelayModalVisible(false);
      showErrorToast('❌ Failed to delay article. Please try again.');
    }
  };

  const handleCancelDelay = () => {
    setDelayModalVisible(false);
  };

  const handleViewBacklog = () => {
    navigation.navigate('Backlog' as never);
  };



  // Helper function to get podcast button state - memoized for performance
  const getPodcastButtonState = React.useCallback((article: ArticleWithProgress) => {
    const isPodcastAvailable = article.podcastStatus === 'COMPLETED';
    const isPlayerActive = podcastState.isPlayerVisible &&
                          podcastState.currentArticleId === article.id;
    const hasAccess = hasPremiumAccess();
    const isDisabled = !isPodcastAvailable;

    // Create a wrapper function that always performs real-time verification for subscribers
    const handlePodcastWithVerification = async () => {
      if (hasAccess) {
        // For subscribers, always perform real-time verification before accessing feature
        console.log('🏠 HomeScreen: Podcast button tapped - performing real-time verification');
        const verifiedAccess = await checkPremiumAccess('Podcast Listening');

        if (verifiedAccess) {
          console.log('🏠 HomeScreen: Podcast access verified - proceeding with toggle');
          await handlePodcastToggle();
        } else {
          console.log('🏠 HomeScreen: Podcast access denied - subscription may have expired');
        }
      } else {
        // For non-subscribers, show subscription modal
        await handleNonSubscriberPodcastTap();
      }
    };

    return {
      isPodcastAvailable,
      isPlayerActive,
      hasAccess,
      isDisabled,
      buttonStyle: [
        styles.baseButton,
        isDisabled ? styles.podcastButtonDisabled : hasAccess ? [styles.podcastButton, styles.activePodcastButton] : styles.summaryButtonDisabled
      ],
      onPress: isDisabled
        ? undefined
        : handlePodcastWithVerification,
      activeOpacity: (isDisabled || !hasAccess) ? 0.6 : 0.8,
      iconColor: isDisabled ? theme.colors.background : hasAccess ? theme.colors.buttonTextActive : theme.colors.buttonTextInactive,
      textStyle: [
        styles.buttonText,
        isDisabled ? styles.buttonTextDisabled : hasAccess ? styles.buttonTextEnabled : styles.buttonTextInactive
      ]
    };
  }, [podcastState.isPlayerVisible, podcastState.currentArticleId, hasPremiumAccess, theme.colors, handlePodcastToggle, checkPremiumAccess, handleNonSubscriberPodcastTap]);

  const handleAISummary = async () => {
    console.log('🏠 HomeScreen: AI Summary button tapped - performing real-time verification');

    // Always perform real-time verification before accessing premium feature
    const hasAccess = await checkPremiumAccess('AI Summary');
    console.log('🏠 HomeScreen: Real-time verification result:', hasAccess);

    if (hasAccess) {
      console.log('🏠 HomeScreen: Access verified - navigating to Article screen');
      (navigation as unknown as { navigate: (screen: string, params?: object) => void }).navigate('Article', {
        routeViewMode: 'summary',
        timestamp: Date.now()
      });
    } else {
      console.log('🏠 HomeScreen: Access denied - subscription may have expired or been cancelled');
    }
  };

  const handleHistoryItemPress = (article: ArticleWithProgress) => {
    if (!article.title && !article.url) {
      Alert.alert('Error', 'An error occurred while fetching the article');
      return;
    }

    setModalVisible({
      articleTitle: article.title,
      articleUrl: article.url,
      articleId: article.id,
    });
  };

  const handleOpenHistoryArticle = async () => {
    if (!modalVisible?.articleUrl) {
      Alert.alert('Error', 'No URL available for this article');
      return;
    }

    try {
      const supported = await Linking.canOpenURL(modalVisible.articleUrl);
      if (supported) {
        await Linking.openURL(modalVisible.articleUrl);
        setModalVisible(null);
      } else {
        Alert.alert('Error', 'Cannot open this URL');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open article');
      console.error('Error opening URL:', error);
    }
  };

  const handleOpenAISummary = async () => {
    if (!modalVisible?.articleId) {
      Alert.alert('Error', 'Article information not available');
      return;
    }

    console.log('🏠 HomeScreen: Opening AI Summary for history article - performing real-time verification');
    const hasAccess = await checkPremiumAccess('AI Summary');
    if (!hasAccess) {
      console.log('🏠 HomeScreen: AI Summary access denied for history article - subscription may have expired');
      return;
    }

    console.log('🏠 HomeScreen: Access verified - navigating to Summary screen');
    setModalVisible(null);
    (navigation as unknown as { navigate: (screen: string, params?: object) => void }).navigate('Summary', {
      articleId: modalVisible.articleId,
      articleTitle: modalVisible.articleTitle,
      articleUrl: modalVisible.articleUrl,
    });
  };

  const handleViewFullHistory = () => {
    navigation.navigate('FullHistory' as never);
  };

  const handleViewProgress = () => {
    navigation.navigate('Progress' as never);
  };

  // Update progress and refresh subscription status when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('🏠 HomeScreen: Screen focused - refreshing data');

      const focusOperations = async () => {
        try {
          // Refresh data from storage first
          await refreshData();
          await cleanExpiredBacklogArticles();

          // Small delay to ensure data is fully updated in state
          await new Promise(resolve => setTimeout(resolve, 100));

          clearEntitlementCache();
          await refreshSubscriptionStatus();

          // Update current article progress after data refresh
          if (state.currentArticle) {
            const updatedArticle = getArticleWithProgress(state.currentArticle);
            setCurrentArticleWithProgress(updatedArticle);
          }

          // Force streak recalculation after data is refreshed
          setStreakUpdateTrigger(prev => prev + 1);
        } catch (error) {
          console.error('Focus operations error:', error);
        }
      };

      focusOperations();
    }, [])
  );



  const currentArticle = currentArticleWithProgress || (state.currentArticle
    ? getArticleWithProgress(state.currentArticle)
    : null);

  // Filter out today's article from routine history
  const homeArticles = React.useMemo(() => {
    if (!currentArticle) return allHomeArticles;
    return allHomeArticles.filter(article => article.id !== currentArticle.id);
  }, [allHomeArticles, currentArticle?.id]);



  const totalRead = getTotalReadArticles();

  // Get current week's reading status for each day (Sunday to Saturday)
  const weeklyProgress = React.useMemo(() => {
    const today = new Date();
    // Use local timezone to avoid UTC conversion issues
    const year = today.getFullYear();
    const month = today.getMonth();
    const date = today.getDate();
    const todayString = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;

    // Find the Sunday of the current week
    const currentWeekStart = new Date(year, month, date);
    const dayOfWeek = currentWeekStart.getDay(); // 0 = Sunday, 1 = Monday, etc.
    currentWeekStart.setDate(date - dayOfWeek); // Go back to Sunday

    const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const weekProgress = weekDays.map((dayLetter, index) => {
      const dayDate = new Date(currentWeekStart);
      dayDate.setDate(currentWeekStart.getDate() + index);
      const dayYear = dayDate.getFullYear();
      const dayMonth = dayDate.getMonth();
      const dayDateNum = dayDate.getDate();
      const dayString = `${dayYear}-${String(dayMonth + 1).padStart(2, '0')}-${String(dayDateNum).padStart(2, '0')}`;

      const isToday = dayString === todayString;

      // Simplified logic: check articles from storage + today's article
      let status: 'inactive' | 'active' | 'delayed' = 'inactive';

      // Check for read articles in history for this day (including read backlog articles)
      const hasReadArticle = state.articleHistory.find(p =>
        p.isRead && p.routineDay === dayString
      );

      // For today, also check current article if it exists and is read
      const isTodayRead = isToday &&
        state.currentArticle &&
        state.currentArticle.routineDay === dayString &&
        currentProgress?.isRead;

      // Check if there's a delayed article for this day that hasn't been read
      const unreadDelayedArticle = backlogArticles.find(delayed =>
        delayed.originalRoutineDay === dayString
      );



      if (hasReadArticle || isTodayRead) {
        // Article for this day has been read (either normal or from backlog)
        status = 'active';
      } else if (unreadDelayedArticle) {
        // Article is delayed but not yet read
        status = 'delayed';
      }

      return {
        dayLetter,
        dayString,
        status,
        isToday
      };
    });



    return weekProgress;
  }, [state.articleHistory, state.currentArticle?.id, state.currentArticle?.routineDay, currentProgress?.isRead, backlogArticles, streakUpdateTrigger]);

  // Check if we have a complete 7-day streak (all days are active or delayed)
  const hasCompleteStreak = React.useMemo(() =>
    weeklyProgress.every(day => day.status !== 'inactive'),
    [weeklyProgress]
  );

  const styles = React.useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    podcastPlayerContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
    },
    scrollContainer: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 40,
    },
    header: {
      marginBottom: 32,
    },
    welcomeText: {
      fontSize: 32,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
      letterSpacing: -0.8,
    },
    subtitleText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      lineHeight: 24,
    },
    errorContainer: {
      backgroundColor: theme.colors.error,
      padding: 16,
      marginBottom: 24,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
    },
    errorText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '500',
      marginLeft: 12,
      flex: 1,
    },
    // Weekly Progress Card
    weeklyCard: {
      backgroundColor: theme.colors.backgroundHighlighted,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 12,
      marginBottom: 24,
      elevation: 2,
    },
    weeklyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
      paddingHorizontal: 8,
    },
    weeklyTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
      letterSpacing: -0.2,
      paddingLeft: 8,
    },
    weeklyIcon: {
      paddingVertical: 8,
    },
    weeklyDotsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    weeklyDotsLine: {
      position: 'absolute',
      height: 4,
      backgroundColor: '#374151',
      top: 6,
      left: 24,
      right: 24,
      zIndex: 0,
    },
    dayContainer: {
      alignItems: 'center',
      flex: 1,
    },
    dotContainer: {
      position: 'relative',
      alignItems: 'center',
      zIndex: 1,
    },
    dot: {
      width: 16,
      height: 16,
      borderRadius: 8,
      marginBottom: 8,
    },
    dotInactive: {
      backgroundColor: '#374151',
    },
    dotActive: {
      backgroundColor: theme.colors.success,
    },
    dotDelayed: {
      backgroundColor: theme.colors.orange,
    },
    dotToday: {
      borderWidth: 3,
      borderColor: '#F59E0B',
      shadowColor: '#F59E0B',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.5,
      shadowRadius: 4,
      elevation: 8,
    },

    dayLabel: {
      fontSize: 12,
      color: '#9CA3AF',
      fontWeight: '500',
    },
    todaySection: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 16,
      letterSpacing: -0.5,
    },
    articleCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 0,
      elevation: 2,
      borderWidth: 0,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    articleHeader: {
      padding: 24,
      paddingBottom: 0,
    },
    articleMeta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 0,
    },
    articleSourceMeta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-start',
      alignItems: 'center',
      marginBottom: 8,
    },
    sourceText: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      fontWeight: '400',
      letterSpacing: -0.3,
      marginRight: 12,
    },
    articleTimeLeft: {
      fontSize: 11,
      color: theme.colors.disabled,
      fontWeight: '400',
    },
    timeLeftBadge: {
      backgroundColor: theme.colors.orange + '20',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    timeLeftText: {
      fontSize: 11,
      color: theme.colors.orange,
      fontWeight: '600',
    },
    countContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
      marginTop: 0,
      marginHorizontal: 28,
    },
    countContainerItem: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 4,
    },
    countText: {
      fontSize: 9,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    articleTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      lineHeight: 26,
      marginBottom: 12,
      letterSpacing: -0.3,
    },
    articleDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 18,
      marginBottom: 16,
    },
    tagsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 0,
    },
    tag: {
      borderColor: theme.colors.primary + '30',
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    tagText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },
    articleActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 10,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    primaryActions: {
      flexDirection: 'row',
      gap: width > RESPONSIVE_BREAKPOINT ? 8 : 4,
    },
    baseButton: {
      paddingHorizontal: width > RESPONSIVE_BREAKPOINT ? 12 : 8,
      paddingVertical: 10,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      flex: 1,
    },
    readButton: {
      backgroundColor: theme.colors.primary,
    },
    buttonText: {
      fontWeight: '600',
      fontSize: 12,
      display: width > RESPONSIVE_BREAKPOINT ? 'flex' : 'none',
    },
    buttonTextEnabled: {
      color: theme.colors.buttonTextActive,
    },
    buttonTextDisabled: {
      color: theme.colors.background,
    },
    buttonTextInactive: {
      color: theme.colors.buttonTextInactive,
    },
    podcastButton: {
      backgroundColor: theme.colors.podcastButton,
    },
    activePodcastButton: {
      backgroundColor: theme.colors.podcastButtonActive,
    },
    podcastButtonDisabled: {
      backgroundColor: theme.colors.disabled,
      opacity: 0.6,
    },
    summaryButton: {
      backgroundColor: theme.colors.backgroundHighlighted,
    },
    summaryButtonDisabled: {
      backgroundColor: theme.colors.surface,
      opacity: 0.6,
    },
    delayButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.orange + '15',
      borderColor: theme.colors.orange + '40',
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      gap: 4,
      marginRight: -12,
    },
    delayButtonText: {
      fontSize: 12,
      color: theme.colors.orange,
      fontWeight: '600',
    },

    // Your Progress Card
    progressCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 24,
      marginBottom: 32,
      elevation: 2,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    readTimeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    loadingContainerStyles: {
      paddingVertical: 12,
      alignItems: 'center',
    },
    loadingTextStyles: {
      fontSize: 14,
      fontStyle: 'italic',
    },
    progressTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      letterSpacing: -0.3,
    },
    progressGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    progressItem: {
      alignItems: 'center',
      flex: 1,
    },
    progressNumber: {
      fontSize: 24,
      fontWeight: '800',
      color: theme.colors.textSecondary,
      marginBottom: 4,
    },
    progressLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontWeight: '500',
      textAlign: 'center',
    },
    progressIndicator: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    // Recent History Section
    historySection: {
      marginBottom: 32,
    },
    historyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      marginBottom: 16,
    },
    viewAllButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    viewAllText: {
      fontSize: 14,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    historyItem: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      elevation: 1,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    historyIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    historyContent: {
      flex: 1,
    },
    historyTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
      letterSpacing: -0.1,
    },
    historyDate: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    emptyState: {
      backgroundColor: theme.colors.card,
      borderRadius: 24,
      padding: 40,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    emptyIcon: {
      marginBottom: 24,
      opacity: 0.6,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    emptyDescription: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 24,
    },
    refreshButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 32,
      paddingVertical: 16,
      borderRadius: 16,
    },
    refreshButtonText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 16,
    },
    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: theme.colors.card,
      borderRadius: 24,
      padding: 32,
      width: width * 0.9,
      maxWidth: 400,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.25,
      shadowRadius: 25,
      elevation: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    modalArticleTitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginBottom: 24,
      textAlign: 'center',
      lineHeight: 22,
    },
    modalButtons: {
      flexDirection: 'column',
      marginTop: 24,
      gap: 12,
    },
    modalButton: {
      padding: 16,
      borderRadius: 16,
      alignItems: 'center',
    },
    primaryButton: {
      backgroundColor: theme.colors.primary,
    },
    secondaryButton: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    aiSummaryButton: {
      backgroundColor: theme.colors.success || '#10B981',
    },
    disabledButton: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    buttonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    lockIcon: {
      marginRight: 4,
    },
    modalButtonText: {
      fontWeight: '600',
      fontSize: 16,
    },
    primaryButtonText: {
      color: '#FFFFFF',
    },
    secondaryButtonText: {
      color: theme.colors.text,
    },
    aiSummaryButtonText: {
      color: '#FFFFFF',
    },
    disabledButtonText: {
      color: theme.colors.textSecondary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    loadingText: {
      color: theme.colors.text,
      marginTop: 20,
      fontSize: 16,
      fontWeight: '500',
    },
    // Backlog Widget Styles
    backlogWidget: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      elevation: 2,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    backlogHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    backlogTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      letterSpacing: -0.3,
    },
    backlogBadge: {
      backgroundColor: theme.colors.orange,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    backlogBadgeText: {
      fontSize: 12,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    backlogActionButton: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginTop: 8,
    },
    backlogActionContent: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
    },
    backlogActionIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.orange + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    backlogActionTextContainer: {
      flex: 1,
    },
    backlogActionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    backlogActionSubtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    // Delay Modal Styles
    delayModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    delayModalContent: {
      backgroundColor: theme.colors.card,
      borderRadius: 20,
      padding: 24,
      width: '100%',
      maxWidth: 400,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 20,
      elevation: 20,
    },
    delayModalIcon: {
      alignItems: 'center',
      marginBottom: 16,
    },
    delayModalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    delayModalMessage: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 24,
    },
    delayModalActions: {
      flexDirection: 'row',
      gap: 12,
    },
    delayModalButton: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 12,
      alignItems: 'center',
    },
    delayModalCancelButton: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    delayModalConfirmButton: {
      backgroundColor: theme.colors.orange,
    },
    delayModalButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    delayModalCancelText: {
      color: theme.colors.text,
    },
    delayModalConfirmText: {
      color: '#FFFFFF',
    },

  }), [theme, width]);

  if (state.isLoading && !currentArticle) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="refresh" size={40} color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading your routine...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
      {state.error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={20} color="#FFFFFF" />
          <Text style={styles.errorText}>{state.error}</Text>
        </View>
      )}



      {/* Weekly Progress Card */}
      <View style={styles.weeklyCard}>
        <View style={styles.weeklyHeader}>
          <Text style={styles.weeklyTitle}>7 Days Streak</Text>
          <View style={styles.weeklyIcon}>
            <Ionicons name="flame" size={20} color="#F59E0B" />
          </View>
        </View>
        <View style={styles.weeklyDotsContainer}>
          {/* Continuous line behind all dots */}
          <View style={styles.weeklyDotsLine} />
          {weeklyProgress.map((day, index) => (
            <View key={index} style={styles.dayContainer}>
              <View
                style={styles.dotContainer}
                accessibilityRole="button"
                accessibilityLabel={`${day.dayLetter}, ${day.status === 'active' ? 'completed' : day.status === 'delayed' ? 'delayed' : 'not completed'}${day.isToday ? ', today' : ''}`}
              >
                {hasCompleteStreak ? (
                  <Ionicons
                    name="flame"
                    size={16}
                    color="#F59E0B"
                    style={{ marginBottom: 8 }}
                  />
                ) : (
                  <View style={[
                    styles.dot,
                    day.status === 'active' && styles.dotActive,
                    day.status === 'delayed' && styles.dotDelayed,
                    day.status === 'inactive' && styles.dotInactive,
                    day.isToday && day.status === 'inactive' && styles.dotToday,
                  ]} />
                )}
              </View>
              <Text style={styles.dayLabel}>{day.dayLetter}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Today's Article */}
      <View style={styles.todaySection}>

        {currentArticle ? (
          <View style={styles.articleCard}>
            <View
              style={styles.todaySection}
            >
              <View style={styles.articleHeader}>
                <View style={styles.articleMeta}>
                  <Text style={styles.sectionTitle}>Today's Routine</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {(__DEV__ || (currentArticle.canMarkAsRead && !currentProgress?.isRead && !isArticleInBacklog(currentArticle.id))) && (
                      <TouchableOpacity
                        style={styles.delayButton}
                        onPress={handleDelayArticle}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="time-outline" size={14} color={theme.colors.orange} />
                        <Text style={styles.delayButtonText}>Delay</Text>
                      </TouchableOpacity>
                    )}
                    {currentProgress?.isRead && (
                      <View>
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={theme.colors.success}
                        />
                      </View>
                    )}
                  </View>
                </View>

                <Pressable onPress={handleNavigateToArticle}>
                  <Text style={styles.articleTitle}>{currentArticle.title}</Text>

                  {currentArticle.description && (
                    <Text style={styles.articleDescription} numberOfLines={3}>
                      {currentArticle.description}
                    </Text>
                  )}
                </Pressable>

                <View style={styles.articleSourceMeta}>
                  <Text style={styles.sourceText} numberOfLines={3}>
                    {currentArticle.source}
                  </Text>
                  <Text style={styles.articleTimeLeft} numberOfLines={3}>
                    {currentArticle.estimatedReadTime} min read
                  </Text>
                </View>

                <View style={styles.tagsContainer}>
                  {currentArticle.tags.slice(0, 3).map((tag, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                  {currentArticle.tags.length > 3 && (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>+{currentArticle.tags.length - 3}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/**
              Here we display the readCount, likeCount and dislikeCount
            */}
            <View style={styles.countContainer}>
              <View style={styles.countContainerItem}>
                <Ionicons
                  name="eye"
                  size={12}
                  color={theme.colors.textSecondary}
                />
                <Text style={styles.countText}>{currentArticle.readCount}</Text>
              </View>
              <View style={styles.countContainerItem}>
                <Ionicons
                  name="thumbs-up"
                  size={12}
                  color={theme.colors.textSecondary}
                />
                <Text style={styles.countText}>{currentArticle.likeCount}</Text>
              </View>
              <View style={styles.countContainerItem}>
                <Ionicons
                  name="thumbs-down"
                  size={12}
                  color={theme.colors.textSecondary}
                />
                <Text style={styles.countText}>{currentArticle.dislikeCount}</Text>
              </View>
            </View>

            <View style={styles.articleActions}>
              <View style={styles.primaryActions}>
                <TouchableOpacity
                  style={[styles.baseButton, styles.readButton]}
                  onPress={handleNavigateToArticle}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Read today's article"
                >
                  <Ionicons name="globe-outline" size={16} color={theme.colors.buttonTextActive} />
                  <Text style={[styles.buttonText, styles.buttonTextEnabled]}>Read</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.baseButton,
                    styles.summaryButton,
                    !hasPremiumAccess() && styles.summaryButtonDisabled
                  ]}
                  onPress={async () => {
                    if (hasPremiumAccess()) {
                      // For subscribers, always perform real-time verification
                      await handleAISummary();
                    } else {
                      // For non-subscribers, show subscription modal
                      await handleNonSubscriberTap();
                    }
                  }}
                  activeOpacity={hasPremiumAccess() ? 0.8 : 0.6}
                  accessibilityRole="button"
                  accessibilityLabel={hasPremiumAccess() ? "Get AI summary" : "Get AI summary (requires premium)"}
                >
                  <Ionicons
                    name="sparkles"
                    size={16}
                    color={hasPremiumAccess() ? theme.colors.buttonTextActive : theme.colors.textSecondary}
                  />
                  <Text style={[
                    styles.buttonText,
                    hasPremiumAccess() ? styles.buttonTextEnabled : { color: theme.colors.textSecondary }
                  ]}>
                    Summary
                  </Text>
                </TouchableOpacity>

                {currentArticle && (() => {
                  const buttonState = getPodcastButtonState(currentArticle);

                  return (
                    <TouchableOpacity
                      style={buttonState.buttonStyle}
                      onPress={buttonState.onPress}
                      activeOpacity={buttonState.activeOpacity}
                      disabled={buttonState.isDisabled}
                      accessibilityRole="button"
                      accessibilityLabel={buttonState.isDisabled ? "Podcast not available" : buttonState.isPlayerActive ? "Stop podcast" : "Play podcast"}
                    >
                      <Ionicons
                        name={buttonState.isPlayerActive ? "stop-circle" : "headset"}
                        size={16}
                        color={buttonState.iconColor}
                      />
                      <Text style={buttonState.textStyle}>
                        {buttonState.isPlayerActive ? "Stop" : "Podcast"}
                      </Text>
                    </TouchableOpacity>
                  );
                })()}
              </View>
            </View>


          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons
              name="book-outline"
              size={80}
              color={theme.colors.disabled}
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyTitle}>No Routine Available</Text>
            <Text style={styles.emptyDescription}>
              Your daily coding routine isn't ready yet. Try refreshing or check back later.
            </Text>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleFetchArticle}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Fetch today's article"
            >
              <Text style={styles.refreshButtonText}>Start Routine</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Backlog Widget - Only show if there are articles */}
      {backlogArticles.length > 0 && (
        <View style={styles.backlogWidget}>
          <View style={styles.backlogHeader}>
            <Text style={styles.backlogTitle}>Your Backlog</Text>
            <View style={styles.backlogBadge}>
              <Text style={styles.backlogBadgeText}>{backlogArticles.length}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.backlogActionButton}
            onPress={handleViewBacklog}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`View backlog with ${backlogArticles.length} delayed article${backlogArticles.length > 1 ? 's' : ''}`}
          >
            <View style={styles.backlogActionContent}>
              <View style={styles.backlogActionIcon}>
                <Ionicons name="library-outline" size={20} color={theme.colors.orange} />
              </View>
              <View style={styles.backlogActionTextContainer}>
                <Text style={styles.backlogActionTitle} numberOfLines={1}>
                  {backlogArticles[0].article.title}
                </Text>
                <Text style={styles.backlogActionSubtitle}>
                  {backlogArticles.length} delayed article{backlogArticles.length > 1 ? 's' : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </View>
          </TouchableOpacity>


        </View>
      )}

      {/* Delay Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={delayModalVisible}
        onRequestClose={handleCancelDelay}
      >
        <View style={styles.delayModalOverlay}>
          <View style={styles.delayModalContent}>
            <View style={styles.delayModalIcon}>
              <Ionicons name="time-outline" size={48} color={theme.colors.orange} />
            </View>

            <Text style={styles.delayModalTitle}>
              Delay Article?
            </Text>

            <Text style={styles.delayModalMessage}>
              This article will be moved to your backlog and you can read it later (up to 2 days). Delaying preserves your reading streak, so you won't lose momentum!
            </Text>

            <View style={styles.delayModalActions}>
              <TouchableOpacity
                style={[styles.delayModalButton, styles.delayModalCancelButton]}
                onPress={handleCancelDelay}
                activeOpacity={0.8}
              >
                <Text style={[styles.delayModalButtonText, styles.delayModalCancelText]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.delayModalButton, styles.delayModalConfirmButton]}
                onPress={handleConfirmDelay}
                activeOpacity={0.8}
              >
                <Text style={[styles.delayModalButtonText, styles.delayModalConfirmText]}>
                  Delay
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Your Progress Card */}
      <Pressable
        style={styles.progressCard}
        onPress={handleViewProgress}
        accessibilityRole="button"
        accessibilityLabel={`View progress. ${totalRead} articles read, ${getFavorites().length} favorites, ${Object.keys(state.tagStats).length} topics explored`}
      >
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Your Progress</Text>
          <Ionicons name="trending-up" size={24} color={theme.colors.primary} />
        </View>

        <View style={styles.progressGrid}>
          <View style={styles.progressItem}>
            <View style={styles.progressIndicator}>
              <Ionicons name="book" size={20} color={theme.colors.primary} />
            </View>
            <Text style={styles.progressNumber}>{totalRead}</Text>
            <Text style={styles.progressLabel}>Articles{'\n'}Read</Text>
          </View>

          <View style={styles.progressItem}>
            <View style={styles.progressIndicator}>
              <Ionicons name="heart" size={20} color={theme.colors.error} />
            </View>
            <Text style={styles.progressNumber}>{getFavorites().length}</Text>
            <Text style={styles.progressLabel}>Favorites</Text>
          </View>

          <View style={styles.progressItem}>
            <View style={styles.progressIndicator}>
              <Ionicons name="library" size={20} color="#10B981" />
            </View>
            <Text style={styles.progressNumber}>{Object.keys(state.tagStats).length}</Text>
            <Text style={styles.progressLabel}>Topics{'\n'}Explored</Text>
          </View>
        </View>
      </Pressable>

      {/* Routine History */}
      {homeArticles.length > 0 && (
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>Routine History</Text>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={handleViewFullHistory}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="View all reading history"
            >
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {homeArticles.map((article) => {
            const isRead = article.progress?.isRead || false;

            return (
              <TouchableOpacity
                key={article.id}
                style={styles.historyItem}
                onPress={() => handleHistoryItemPress(article)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${article.title}, ${isRead ? 'read' : 'not read'}, ${new Date(article.routineDay).toLocaleDateString()}`}
              >
                <View style={styles.historyIcon}>
                  <Ionicons
                    name={isRead ? 'checkmark-circle' : 'close-circle'}
                    size={20}
                    color={isRead ? theme.colors.success : theme.colors.error}
                  />
                </View>

                <View style={styles.historyContent}>
                  <Text style={styles.historyTitle} numberOfLines={1}>
                    {article.title}
                  </Text>
                  <Text style={styles.historyDate}>
                    {new Date(article.routineDay).toLocaleDateString()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {articlesLoading && (
            <View style={styles.loadingContainerStyles}>
              <Text style={[styles.loadingTextStyles, { color: theme.colors.textSecondary }]}>
                Loading articles...
              </Text>
            </View>
          )}
        </View>
      )}

      {/* History Item Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={!!modalVisible}
        onRequestClose={() => setModalVisible(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(null)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
          >
            <Text style={styles.modalTitle}>Article Options</Text>
            <Text style={styles.modalArticleTitle} numberOfLines={3}>
              {modalVisible?.articleTitle || 'Article'}
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.secondaryButton]}
                onPress={() => setModalVisible(null)}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, styles.secondaryButtonText]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.aiSummaryButton, !hasPremiumAccess() && styles.disabledButton]}
                onPress={handleOpenAISummary}
                disabled={!hasPremiumAccess()}
                activeOpacity={0.8}
              >
                <View style={styles.buttonContent}>
                  {!hasPremiumAccess() && (
                    <Ionicons name="lock-closed" size={16} color={theme.colors.textSecondary} style={styles.lockIcon} />
                  )}
                  <Ionicons name="sparkles" size={16} color={hasPremiumAccess() ? '#FFFFFF' : theme.colors.textSecondary} />
                  <Text style={[styles.modalButtonText, styles.aiSummaryButtonText, !hasPremiumAccess() && styles.disabledButtonText]}>
                    AI Summary
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.primaryButton]}
                onPress={handleOpenHistoryArticle}
                disabled={!modalVisible?.articleUrl}
                activeOpacity={0.8}
              >
                <View style={styles.buttonContent}>
                  <Ionicons name="open-outline" size={16} color="#FFFFFF" />
                  <Text style={[styles.modalButtonText, styles.primaryButtonText]}>
                    Open in Browser
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      </ScrollView>

      {/* Mini Podcast Player - Fixed at bottom when visible */}
      {podcastState.isPlayerVisible && (
        <View style={styles.podcastPlayerContainer}>
          <PodcastPlayer />
        </View>
      )}
    </View>
  );
};

export default HomeScreen;
