// Updated to use react-native-track-player
import React, { createContext, useContext, useReducer, useCallback, ReactNode, useRef, useEffect, useMemo } from 'react';
import TrackPlayer, { 
  Event, 
  State, 
  usePlaybackState, 
  useProgress, 
  useTrackPlayerEvents,
  Track,
  Capability,
  AppKilledPlaybackBehavior,
  IOSCategory,
  IOSCategoryMode,
} from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AppState, AppStateStatus } from 'react-native';
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
  const isSetupRef = useRef<boolean>(false);
  const progressSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // TrackPlayer hooks
  const playbackState = usePlaybackState();
  const progress = useProgress(1000); // Update every 1 second

  // Initialize TrackPlayer and notifications
  useEffect(() => {
    const initializePlayer = async () => {
      try {
        // Setup TrackPlayer only once
        if (!isSetupRef.current) {
          await TrackPlayer.setupPlayer({
            autoHandleInterruptions: true,
          });
          isSetupRef.current = true;

          // Configure player options with iOS-specific settings
          await TrackPlayer.updateOptions({
            // Media controls capabilities
            capabilities: [
              Capability.Play,
              Capability.Pause,
              Capability.Stop,
              Capability.SeekTo,
            ],

            // Compact view capabilities (shows in notification)
            compactCapabilities: [
              Capability.Play,
              Capability.Pause,
              Capability.Stop,
            ],

            // Android specific options
            android: {
              appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
              alwaysPauseOnInterruption: true,
            },
            
            // Notification color (Android)
            color: 0xC29AE3, // Purple color from app theme

            // iOS specific options for background playback
            ...(Platform.OS === 'ios' && {
              ios: {
                category: IOSCategory.Playback,
                mode: IOSCategoryMode.SpokenAudio,
              },
            }),
          });
        }

        // TrackPlayer handles notifications natively, no need for expo-notifications setup

      } catch (error) {
        console.error('Error initializing TrackPlayer and notifications:', error);
        dispatch({
          type: 'SET_ERROR',
          payload: error instanceof Error ? error.message : 'Failed to initialize player'
        });
      }
    };

    initializePlayer();

    // Cleanup on unmount
    return () => {
      TrackPlayer.reset().catch(err => console.error('Error resetting TrackPlayer on unmount:', err));
    };
  }, []);

  // Update state based on TrackPlayer status
  useEffect(() => {
    if (playbackState.state !== undefined) {
      const isLoaded = playbackState.state !== State.None && playbackState.state !== State.Error;
      const isPlaying = playbackState.state === State.Playing;
      const isBuffering = playbackState.state === State.Buffering || playbackState.state === State.Loading;
      
      const wasLoaded = state.isLoaded;

      dispatch({ type: 'SET_LOADED', payload: isLoaded });
      dispatch({ type: 'SET_PLAYING', payload: isPlaying });
      dispatch({ type: 'SET_BUFFERING', payload: isBuffering });

      // Auto-play logic is now handled directly in loadPodcast
      // This section is kept for compatibility with restored state
    }
  }, [playbackState.state, state.isLoaded, state.isUserInitiated, state.currentPodcastUrl, state.isPlayerVisible, state.isPlayerReleased]);

  // Update progress from TrackPlayer (debounced for performance)
  useEffect(() => {
    if (progress.duration > 0) {
      dispatch({ type: 'SET_DURATION', payload: progress.duration * 1000 }); // Convert to milliseconds
      dispatch({ type: 'SET_POSITION', payload: progress.position * 1000 }); // Convert to milliseconds
    }
  }, [progress.duration, progress.position]);

  // Handle app state changes for proper background behavior
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      appStateRef.current = nextAppState;
      
      if (nextAppState === 'active') {
        // App came to foreground - sync state
        TrackPlayer.getPlaybackState().then(playbackState => {
          if (playbackState.state === State.Playing) {
            dispatch({ type: 'SET_PLAYING', payload: true });
          }
        }).catch(err => console.error('Error syncing playback state:', err));
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Auto-save state to AsyncStorage (debounced to avoid excessive writes)
  useEffect(() => {
    if (state.currentPodcastUrl) {
      // Clear previous timeout
      if (progressSaveTimeoutRef.current) {
        clearTimeout(progressSaveTimeoutRef.current);
      }

      // Debounce save by 2 seconds
      progressSaveTimeoutRef.current = setTimeout(async () => {
        try {
          const stateToSave = {
            currentPodcastUrl: state.currentPodcastUrl,
            currentArticleId: state.currentArticleId,
            currentArticleTitle: state.currentArticleTitle,
            position: state.position,
            playbackRate: state.playbackRate,
            isPlayerVisible: state.isPlayerVisible,
          };
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
        } catch (error) {
          console.error('Error saving podcast state:', error);
        }
      }, 2000);
    }

    return () => {
      if (progressSaveTimeoutRef.current) {
        clearTimeout(progressSaveTimeoutRef.current);
      }
    };
  }, [state.currentPodcastUrl, state.currentArticleId, state.position, state.playbackRate, state.isPlayerVisible]);

  // Load saved state on mount
  useEffect(() => {
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
            // Restore playback rate if saved
            if (parsed.playbackRate) {
              dispatch({ type: 'SET_PLAYBACK_RATE', payload: parsed.playbackRate });
            }
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

  // Cleanup auto-play timeout on unmount
  useEffect(() => {
    return () => {
      if (autoPlayTimeoutRef.current) {
        clearTimeout(autoPlayTimeoutRef.current);
        autoPlayTimeoutRef.current = null;
        autoPlayCancelRef.current = true;
      }
    };
  }, []);

  const loadPodcast = useCallback(async (url: string, articleId: string, title: string) => {
    try {
      dispatch({ type: 'SET_ERROR', payload: null });
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_LOADED', payload: false });

      // Set the current podcast
      dispatch({
        type: 'SET_CURRENT_PODCAST',
        payload: { url, articleId, title, isUserInitiated: true },
      });

      // Show player (will auto-play when loaded)
      dispatch({ type: 'SET_PLAYER_VISIBLE', payload: true });

      // Clear the queue and add the new track
      await TrackPlayer.reset();
      
      const track: Track = {
        id: articleId,
        url: url,
        title: title,
        artist: 'CodeRoutine',
        album: 'CodeRoutine Podcast',
        genre: 'Technology',
        duration: 0, // Will be updated when loaded
        artwork: require('../../assets/icon.png'), // App icon for notification background
      };

      await TrackPlayer.add(track);
      
      // Restore playback rate if it was set
      if (state.playbackRate !== 1.0) {
        await TrackPlayer.setRate(state.playbackRate);
      }

      // Explicitly update now playing metadata to ensure notification appears
      await TrackPlayer.updateNowPlayingMetadata({
        title: title,
        artist: 'CodeRoutine',
        album: 'CodeRoutine Podcast',
        artwork: require('../../assets/icon.png'),
      });

      // Start playing immediately
      await TrackPlayer.play();

    } catch (error) {
      console.error('Error loading podcast:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to load podcast'
      });
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.playbackRate]);

  const play = useCallback(async () => {
    try {
      await TrackPlayer.play();
    } catch (error) {
      console.error('Error playing podcast:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to play podcast'
      });
    }
  }, []);

  const pause = useCallback(async () => {
    try {
      await TrackPlayer.pause();
    } catch (error) {
      console.error('Error pausing podcast:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to pause podcast'
      });
    }
  }, []);

  const seekTo = useCallback(async (positionMs: number) => {
    if (!state.duration) return;

    try {
      const clampedPosition = Math.max(0, Math.min(positionMs, state.duration));
      await TrackPlayer.seekTo(clampedPosition / 1000); // Convert to seconds for TrackPlayer
    } catch (error) {
      console.error('Error seeking podcast:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to seek'
      });
    }
  }, [state.duration]);

  const stop = useCallback(async () => {
    try {
      await TrackPlayer.pause();
      await TrackPlayer.seekTo(0);
    } catch (error) {
      console.error('Error stopping podcast:', error);
    }
  }, []);

  const setPlaybackRate = useCallback(async (rate: number) => {
    try {
      await TrackPlayer.setRate(rate);
      dispatch({ type: 'SET_PLAYBACK_RATE', payload: rate });
    } catch (error) {
      console.error('Error setting playback rate:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to set playback rate'
      });
    }
  }, []);

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

    // Clear any pending progress save timeout
    if (progressSaveTimeoutRef.current) {
      clearTimeout(progressSaveTimeoutRef.current);
      progressSaveTimeoutRef.current = null;
    }

    // Mark player as released before cleanup
    dispatch({ type: 'SET_PLAYER_RELEASED', payload: true });

    // Always stop playback completely and cleanup
    try {
      await TrackPlayer.stop();
      await TrackPlayer.reset(); // Clear the queue (also dismisses notification)
    } catch (error) {
      // Ignore errors if player is already stopped/reset
      console.log('Player already stopped or reset');
    }

    // Clear saved state
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing saved state:', error);
    }

    dispatch({ type: 'RESET_PLAYER' });
    dispatch({ type: 'SET_PLAYER_VISIBLE', payload: false });
    dispatch({ type: 'SET_PLAYER_RELEASED', payload: false });
  }, []);

  const togglePlayerExpansion = useCallback(() => {
    dispatch({ type: 'SET_PLAYER_EXPANDED', payload: !state.isPlayerExpanded });
  }, [state.isPlayerExpanded]);

  // Handle TrackPlayer events
  useTrackPlayerEvents([Event.PlaybackQueueEnded, Event.PlaybackError], async (event) => {
    if (event.type === Event.PlaybackQueueEnded) {
      // Mark the article as read when podcast finishes
      if (state.currentArticleId && state.currentArticleId === currentArticle?.id) {
        markArticleAsRead(state.currentArticleId, currentArticle.tags);
      }

      // Auto-hide player on finish
      hidePlayer();
    } else if (event.type === Event.PlaybackError) {
      console.error('TrackPlayer playback error:', event);
      dispatch({
        type: 'SET_ERROR',
        payload: 'Playback error occurred'
      });
    }
  });

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

  // Memoize context value to prevent unnecessary re-renders
  const contextValue: PodcastContextType = useMemo(() => ({
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
  }), [
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
  ]);

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

// Export for TypeScript module resolution
export default PodcastProvider;