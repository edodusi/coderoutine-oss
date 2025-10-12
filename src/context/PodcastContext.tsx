import React, { createContext, useContext, useReducer, useCallback, ReactNode, useRef } from 'react';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useApp } from '../context/AppContext';

export interface PodcastState {
  // Audio state
  isLoaded: boolean;
  isPlaying: boolean;
  isBuffering: boolean;
  duration: number | null;
  position: number;
  playbackRate: number;

  // UI state
  isPlayerVisible: boolean;
  isPlayerExpanded: boolean;

  // Current podcast info
  currentPodcastUrl: string | null;
  currentArticleId: string | null;
  currentArticleTitle: string | null;

  // Control flags
  isUserInitiated: boolean;
  isPlayerReleased: boolean;

  // Error state
  error: string | null;
}

export type PodcastAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_LOADED'; payload: boolean }
  | { type: 'SET_PLAYING'; payload: boolean }
  | { type: 'SET_BUFFERING'; payload: boolean }
  | { type: 'SET_DURATION'; payload: number | null }
  | { type: 'SET_POSITION'; payload: number }
  | { type: 'SET_PLAYBACK_RATE'; payload: number }
  | { type: 'SET_PLAYER_VISIBLE'; payload: boolean }
  | { type: 'SET_PLAYER_EXPANDED'; payload: boolean }
  | { type: 'SET_CURRENT_PODCAST'; payload: { url: string; articleId: string; title: string; isUserInitiated?: boolean } }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_PLAYER_RELEASED'; payload: boolean }
  | { type: 'RESET_PLAYER' };

const initialState: PodcastState = {
  isLoaded: false,
  isPlaying: false,
  isBuffering: false,
  duration: null,
  position: 0,
  playbackRate: 1.0,
  isPlayerVisible: false,
  isPlayerExpanded: false,
  currentPodcastUrl: null,
  currentArticleId: null,
  currentArticleTitle: null,
  isUserInitiated: false,
  isPlayerReleased: false,
  error: null,
};

const podcastReducer = (state: PodcastState, action: PodcastAction): PodcastState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isBuffering: action.payload };
    case 'SET_LOADED':
      return { ...state, isLoaded: action.payload };
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.payload };
    case 'SET_BUFFERING':
      return { ...state, isBuffering: action.payload };
    case 'SET_DURATION':
      return { ...state, duration: action.payload };
    case 'SET_POSITION':
      return { ...state, position: action.payload };
    case 'SET_PLAYBACK_RATE':
      return { ...state, playbackRate: action.payload };
    case 'SET_PLAYER_VISIBLE':
      return { ...state, isPlayerVisible: action.payload };
    case 'SET_PLAYER_EXPANDED':
      return { ...state, isPlayerExpanded: action.payload };
    case 'SET_CURRENT_PODCAST':
      return {
        ...state,
        currentPodcastUrl: action.payload.url,
        currentArticleId: action.payload.articleId,
        currentArticleTitle: action.payload.title,
        isUserInitiated: action.payload.isUserInitiated || false,
        error: null,
      };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isBuffering: false };
    case 'SET_PLAYER_RELEASED':
      return { ...state, isPlayerReleased: action.payload };
    case 'RESET_PLAYER':
      return {
        ...initialState,
        // Always hide player when resetting
        isPlayerVisible: false,
      };
    default:
      return state;
  }
};

interface PodcastContextType {
  state: PodcastState;

  // Core playback functions
  loadPodcast: (url: string, articleId: string, title: string) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seekTo: (positionMs: number) => Promise<void>;
  stop: () => Promise<void>;
  setPlaybackRate: (rate: number) => Promise<void>;

  // UI functions
  showPlayer: () => void;
  hidePlayer: () => void;
  togglePlayerExpansion: () => void;

  // Utility functions
  formatTime: (milliseconds: number) => string;
  getRemainingTime: () => number;
  getPlaybackProgress: () => number;
  getAvailablePlaybackRates: () => number[];
}

const PodcastContext = createContext<PodcastContextType | undefined>(undefined);

const STORAGE_KEY = '@coderoutine/podcast_state';

interface PodcastProviderProps {
  children: ReactNode;
}

export const PodcastProvider: React.FC<PodcastProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(podcastReducer, initialState);
  const app = useApp();
  const { markArticleAsRead } = app;
  const currentArticle = app.state.currentArticle;
  const autoPlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoPlayCancelRef = useRef<boolean>(false);
  const notificationUpdateRef = useRef<((isPlaying: boolean, title: string, position?: number, duration?: number) => Promise<void>) | null>(null);

  // Create audio player with dynamic source
  const audioSource = state.currentPodcastUrl ? { uri: state.currentPodcastUrl } : null;
  const player = useAudioPlayer(audioSource, {
    updateInterval: 1000,
  });

  // Get player status
  const playerStatus = useAudioPlayerStatus(player);

  // Initialize audio mode and notifications
  React.useEffect(() => {
    const initAudioAndNotifications = async () => {
      try {
        // Set up audio mode for podcast playback
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
        });

        // Configure notifications for media controls
        if (Platform.OS === 'android') {
          // Delete old 'podcast' channel if it exists (cleanup from previous version)
          try {
            await Notifications.deleteNotificationChannelAsync('podcast');
          } catch (_error) {
            // Channel might not exist, ignore error
          }

          // Delete and recreate the podcast-player channel to update importance
          // (Android doesn't allow changing importance after channel is created)
          try {
            await Notifications.deleteNotificationChannelAsync('podcast-player');
          } catch (_error) {
            // Channel might not exist, ignore error
          }

          await Notifications.setNotificationChannelAsync('podcast-player', {
            name: 'Podcast Media Player',
            importance: Notifications.AndroidImportance.HIGH,
            sound: null,
            vibrationPattern: [],
            enableLights: false,
            enableVibrate: false,
            showBadge: false,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          });
        }

        // Set notification handler to show notifications even when app is open
        Notifications.setNotificationHandler({
          handleNotification: async (notification) => {
            // Always show media control notifications
            if (notification.request.content.data?.type === 'media_control') {
              return {
                shouldPlaySound: false,
                shouldSetBadge: false,
                shouldShowBanner: true,
                shouldShowList: true,
              };
            }
            return {
              shouldPlaySound: false,
              shouldSetBadge: false,
              shouldShowBanner: false,
              shouldShowList: false,
            };
          },
        });

        // Notification response handler will be set up separately after functions are defined

      } catch (error) {
        console.error('Error initializing audio and notifications:', error);
      }
    };

    initAudioAndNotifications();
  }, []);

  // Update state based on player status
  React.useEffect(() => {
    if (playerStatus && state.currentPodcastUrl) {
      const isLoaded = playerStatus.isLoaded && playerStatus.duration > 0;
      const wasLoaded = state.isLoaded;
      const wasPlaying = state.isPlaying;
      const isNowPlaying = playerStatus.playing;

      dispatch({ type: 'SET_LOADED', payload: isLoaded });
      dispatch({ type: 'SET_PLAYING', payload: playerStatus.playing });
      dispatch({ type: 'SET_BUFFERING', payload: playerStatus.isBuffering });
      dispatch({ type: 'SET_DURATION', payload: playerStatus.duration ? playerStatus.duration * 1000 : null });
      dispatch({ type: 'SET_POSITION', payload: playerStatus.currentTime * 1000 });

      // Update notification only when playback state changes (not continuously)
      // Don't update if player is being released (user pressed stop)
      if (isLoaded && wasPlaying !== isNowPlaying && !state.isPlayerReleased) {
        // Call notification update via ref to avoid circular dependency
        if (notificationUpdateRef.current) {
          notificationUpdateRef.current(
            isNowPlaying,
            state.currentArticleTitle || 'Podcast'
          );
        }
      }

      // Auto-play when audio becomes loaded for the first time (only if user-initiated)
      if (isLoaded && !wasLoaded && !playerStatus.playing && state.isUserInitiated) {


        // Clear any existing timeout and reset cancellation flag
        if (autoPlayTimeoutRef.current) {
          clearTimeout(autoPlayTimeoutRef.current);
        }
        autoPlayCancelRef.current = false;

        autoPlayTimeoutRef.current = setTimeout(() => {
          try {
            // Check cancellation flag first
            if (autoPlayCancelRef.current) {
              return;
            }

            // Check if player is still valid and state allows playback
            if (player && state.currentPodcastUrl && state.isPlayerVisible && !state.isPlayerReleased) {
              player.play();
            }
          } catch (error) {
            console.error("Auto-play failed:", error);
          } finally {
            autoPlayTimeoutRef.current = null;
          }
        }, 100);
      }

      // Check if podcast finished
      if (playerStatus.didJustFinish) {
        // Mark the article as read when podcast finishes
        if (state.currentArticleId && state.currentArticleId === currentArticle?.id) {
          markArticleAsRead(state.currentArticleId, currentArticle.tags);
        }

        // Auto-hide player on finish
        hidePlayer();
      }
    }
  }, [playerStatus, state.currentArticleId, state.currentPodcastUrl, currentArticle, markArticleAsRead, state.isLoaded, player, state.currentArticleTitle]);

  // Cleanup auto-play timeout on unmount
  React.useEffect(() => {
    return () => {
      if (autoPlayTimeoutRef.current) {
        clearTimeout(autoPlayTimeoutRef.current);
        autoPlayTimeoutRef.current = null;
        autoPlayCancelRef.current = true;
      }
    };
  }, []);

  // Effect to handle URL changes and replace audio source
  React.useEffect(() => {
    if (state.currentPodcastUrl && player) {


      // Replace audio source
      player.replace({ uri: state.currentPodcastUrl });

      // Enable pitch correction for speed changes
      player.shouldCorrectPitch = true;
    }
  }, [state.currentPodcastUrl, player]);

  // Auto-save state to AsyncStorage
  React.useEffect(() => {
    const saveState = async () => {
      try {
        const stateToSave = {
          currentPodcastUrl: state.currentPodcastUrl,
          currentArticleId: state.currentArticleId,
          currentArticleTitle: state.currentArticleTitle,
          position: state.position,
          isPlayerVisible: state.isPlayerVisible,
        };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      } catch (error) {
        console.error('Error saving podcast state:', error);
      }
    };

    if (state.currentPodcastUrl) {
      saveState();
    }
  }, [state.currentPodcastUrl, state.currentArticleId, state.position, state.isPlayerVisible]);

  // Load saved state on mount
  React.useEffect(() => {
    const loadSavedState = async () => {
      try {
        const savedState = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedState) {
          const parsed = JSON.parse(savedState);
          if (parsed.currentPodcastUrl && parsed.currentArticleId) {
            dispatch({
              type: 'SET_CURRENT_PODCAST',
              payload: {
                url: parsed.currentPodcastUrl,
                articleId: parsed.currentArticleId,
                title: parsed.currentArticleTitle || 'Untitled Podcast',
                isUserInitiated: false, // This is a restored state, not user-initiated
              },
            });
            // Always start with player hidden, regardless of saved state
            dispatch({ type: 'SET_PLAYER_VISIBLE', payload: false });
          }
        }
      } catch (error) {
        console.error('Error loading saved podcast state:', error);
      }
    };

    loadSavedState();
  }, []);

  const loadPodcast = useCallback(async (url: string, articleId: string, title: string) => {
    try {
      // Request notification permissions when user starts a podcast
      const { status: existingStatus } = await Notifications.getPermissionsAsync();

      if (existingStatus !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }

      dispatch({ type: 'SET_ERROR', payload: null });
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_LOADED', payload: false });

      // Set the current podcast (this will trigger audio source update)
      dispatch({
        type: 'SET_CURRENT_PODCAST',
        payload: { url, articleId, title, isUserInitiated: true },
      });

      // Show player (will auto-play when loaded)
      dispatch({ type: 'SET_PLAYER_VISIBLE', payload: true });


    } catch (error) {
      console.error('Error loading podcast:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to load podcast'
      });
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  // Define notification update function
  const showMediaNotification = useCallback(async (isPlaying: boolean, title: string) => {
    try {
      if (Platform.OS !== 'android') {
        return;
      }

      // Static subtitle
      const subtitle = 'Now playing on CodeRoutine';

      // Action buttons with minimal icons
      const playPauseButton = {
        identifier: 'play-pause',
        buttonTitle: isPlaying ? '⏸️ Pause' : '▶️ Play',
        options: {
          opensAppToForeground: false,
        },
      };

      const closeButton = {
        identifier: 'close',
        buttonTitle: '⏹️ Stop',
        options: {
          opensAppToForeground: false,
        },
      };

      // Schedule notification (Android will update existing one with same identifier)
      await Notifications.scheduleNotificationAsync({
        content: {
          title: title || 'CodeRoutine Podcast',
          body: subtitle,
          sound: false,
          priority: Notifications.AndroidNotificationPriority.DEFAULT,
          sticky: false, // Allow user to dismiss
          autoDismiss: !isPlaying, // Auto-dismiss when paused
          data: {
            type: 'media_control',
            isPlaying,
          },
          categoryIdentifier: 'podcast-player',
          ...(Platform.OS === 'android' && {
            android: {
              channelId: 'podcast-player',
              ongoing: true,
              autoCancel: !isPlaying, // Auto-cancel when paused
              color: '#007AFF',
              smallIcon: 'ic_launcher',
            },
          }),
        },
        trigger: null,
        identifier: 'podcast-notification',
      });

      // Set notification category with actions
      await Notifications.setNotificationCategoryAsync('podcast-player', [
        playPauseButton,
        closeButton,
      ]);

    } catch (error) {
      console.error('Error showing media notification:', error);
    }
  }, []);

  // Store notification function in ref for use in effects
  React.useEffect(() => {
    notificationUpdateRef.current = showMediaNotification;
  }, [showMediaNotification]);

  // Set up notification response listener after functions are defined
  const pauseRef = useRef<(() => Promise<void>) | null>(null);
  const playRef = useRef<(() => Promise<void>) | null>(null);
  const hidePlayerRef = useRef<(() => Promise<void>) | null>(null);

  React.useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const action = response.actionIdentifier;

      if (action === 'play-pause') {
        if (state.isPlaying) {
          pauseRef.current?.();
        } else {
          playRef.current?.();
        }
      } else if (action === 'close') {
        hidePlayerRef.current?.();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [state.isPlaying]);

  const dismissMediaNotification = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        await Notifications.dismissNotificationAsync('podcast-notification');
      }
    } catch (error) {
      console.error('Error dismissing media notification:', error);
    }
  }, []);

  const play = useCallback(async () => {
    if (!player) {
      return;
    }

    try {
      player.play();

      // Show notification immediately when play is called
      await showMediaNotification(
        true,
        state.currentArticleTitle || 'Podcast'
      );
    } catch (error) {
      console.error('Error playing podcast:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to play podcast'
      });
    }
  }, [player, state.currentArticleTitle, showMediaNotification]);

  // Store play function in ref for notification listener
  React.useEffect(() => {
    playRef.current = play;
  }, [play]);

  const pause = useCallback(async () => {
    if (!player) return;

    try {
      player.pause();

      // Update notification when paused
      await showMediaNotification(
        false,
        state.currentArticleTitle || 'Podcast'
      );
    } catch (error) {
      console.error('Error pausing podcast:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to pause podcast'
      });
    }
  }, [player, state.currentArticleTitle, showMediaNotification]);

  // Store pause function in ref for notification listener
  React.useEffect(() => {
    pauseRef.current = pause;
  }, [pause]);

  const seekTo = useCallback(async (positionMs: number) => {
    if (!player || !state.duration) return;

    try {
      const clampedPosition = Math.max(0, Math.min(positionMs, state.duration));
      player.seekTo(clampedPosition / 1000); // Convert to seconds for expo-audio
    } catch (error) {
      console.error('Error seeking podcast:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to seek'
      });
    }
  }, [player, state.duration]);

  const stop = useCallback(async () => {
    if (!player) return;

    try {
      player.pause();
      player.seekTo(0);

    } catch (error) {
      console.error('Error stopping podcast:', error);
    }
  }, [player]);

  const setPlaybackRate = useCallback(async (rate: number) => {
    if (!player) return;

    try {
      // Enable pitch correction to maintain original pitch at different speeds
      player.shouldCorrectPitch = true;
      player.setPlaybackRate(rate, 'high');
      dispatch({ type: 'SET_PLAYBACK_RATE', payload: rate });
    } catch (error) {
      console.error('Error setting playback rate:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to set playback rate'
      });
    }
  }, [player]);

  const showPlayer = useCallback(() => {
    dispatch({ type: 'SET_PLAYER_VISIBLE', payload: true });
  }, []);

  const hidePlayer = useCallback(async () => {
    // Clear any pending auto-play timeout and cancel it
    if (autoPlayTimeoutRef.current) {
      clearTimeout(autoPlayTimeoutRef.current);
      autoPlayTimeoutRef.current = null;
      autoPlayCancelRef.current = true;
    }

    // Mark player as released before cleanup
    dispatch({ type: 'SET_PLAYER_RELEASED', payload: true });

    // Always stop playback completely and cleanup
    if (player) {
      player.pause();
      player.seekTo(0); // Reset to beginning

    }

    // Dismiss media notification
    await dismissMediaNotification();

    // Clear saved state
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing saved state:', error);
    }

    // Audio source will be reset when currentPodcastUrl is cleared

    dispatch({ type: 'RESET_PLAYER' });
    dispatch({ type: 'SET_PLAYER_VISIBLE', payload: false });
    dispatch({ type: 'SET_PLAYER_RELEASED', payload: false });
  }, [player, dismissMediaNotification]);

  // Store hidePlayer function in ref for notification listener
  React.useEffect(() => {
    hidePlayerRef.current = hidePlayer;
  }, [hidePlayer]);

  const togglePlayerExpansion = useCallback(() => {
    dispatch({ type: 'SET_PLAYER_EXPANDED', payload: !state.isPlayerExpanded });
  }, [state.isPlayerExpanded]);

  const formatTime = useCallback((milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const getRemainingTime = useCallback((): number => {
    if (!state.duration) return 0;
    return Math.max(0, state.duration - state.position);
  }, [state.duration, state.position]);

  const getPlaybackProgress = useCallback((): number => {
    if (!state.duration || state.duration === 0) return 0;
    return (state.position / state.duration) * 100;
  }, [state.position, state.duration]);

  const getAvailablePlaybackRates = useCallback((): number[] => {
    return [0.8, 1.0, 1.2];
  }, []);

  const contextValue: PodcastContextType = {
    state,
    loadPodcast,
    play,
    pause,
    seekTo,
    stop,
    setPlaybackRate,
    showPlayer,
    hidePlayer,
    togglePlayerExpansion,
    formatTime,
    getRemainingTime,
    getPlaybackProgress,
    getAvailablePlaybackRates,
  };

  // Cleanup notification on unmount
  React.useEffect(() => {
    return () => {
      // Dismiss notification when component unmounts (app closes)
      dismissMediaNotification();
    };
  }, [dismissMediaNotification]);

  return (
    <PodcastContext.Provider value={contextValue}>
      {children}
    </PodcastContext.Provider>
  );
};

export const usePodcast = (): PodcastContextType => {
  const context = useContext(PodcastContext);
  if (context === undefined) {
    throw new Error('usePodcast must be used within a PodcastProvider');
  }
  return context;
};
