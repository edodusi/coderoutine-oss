import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePodcast } from '../../context/PodcastContext';
import { useTheme } from '../../context/ThemeContext';
import PlayerProgress from './PlayerProgress';

const { width: screenWidth } = Dimensions.get('window');

const COLORS = {
  WHITE: '#FFFFFF',
  BLACK: '#000000',
  GRAY_LIGHT: '#F5F5F7',
  GRAY: '#8E8E93',
  GRAY_DARK: '#3A3A3C',
  GRAY_DARKER: '#1C1C1E',
  PRIMARY: '#007AFF',
  BACKGROUND_LIGHT: '#F2F2F7',
  BACKGROUND_DARK: '#000000',
  SURFACE_LIGHT: '#FFFFFF',
  SURFACE_DARK: '#1C1C1E',
  TEXT_PRIMARY_LIGHT: '#000000',
  TEXT_PRIMARY_DARK: '#FFFFFF',
  TEXT_SECONDARY_LIGHT: '#3C3C43',
  TEXT_SECONDARY_DARK: '#98989D',
  BORDER_LIGHT: '#C6C6C8',
  BORDER_DARK: '#38383A',
  ERROR: '#FF3B30',
  SUCCESS: '#34C759',
};



const PodcastPlayer: React.FC = () => {
  const { theme, isDarkMode } = useTheme();
  const {
    state,
    play,
    pause,
    hidePlayer,
    formatTime,
    getRemainingTime,
    setPlaybackRate,
    getAvailablePlaybackRates,
  } = usePodcast();

  // Don't render if no podcast or player is hidden
  if (!state.isPlayerVisible || !state.currentPodcastUrl) {
    return null;
  }

  const handlePlayPause = async () => {
    if (state.isPlaying) {
      await pause();
    } else {
      await play();
    }
  };

  const handleClose = async () => {
    await hidePlayer();
  };

  const handlePlaybackRateChange = async (rate: number) => {
    await setPlaybackRate(rate);
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: isDarkMode ? COLORS.SURFACE_DARK : COLORS.SURFACE_LIGHT,
      paddingHorizontal: 16,
      paddingVertical: 12,
      shadowColor: COLORS.BLACK,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
      borderBottomWidth: 1,
      borderBottomColor: isDarkMode ? COLORS.BORDER_DARK : COLORS.BORDER_LIGHT,
      width: screenWidth,
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    leftSection: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    playPauseButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    playPauseButtonDisabled: {
      opacity: 0.6,
    },
    progressContainer: {
      flex: 1,
      marginRight: 12,
    },
    rightSection: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    playbackRateButton: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      backgroundColor: isDarkMode ? COLORS.GRAY_DARK : COLORS.GRAY_LIGHT,
      marginRight: 8,
    },
    playbackRateText: {
      fontSize: 11,
      color: isDarkMode ? COLORS.TEXT_PRIMARY_DARK : COLORS.TEXT_PRIMARY_LIGHT,
      fontWeight: '600',
    },
    durationText: {
      fontSize: 12,
      color: isDarkMode ? COLORS.TEXT_SECONDARY_DARK : COLORS.TEXT_SECONDARY_LIGHT,
      marginRight: 8,
      fontWeight: '500',
    },
    closeButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDarkMode ? COLORS.GRAY_DARK : COLORS.GRAY_LIGHT,
      marginLeft: 8,
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
    },
  });

  // Show loading state
  if (state.isBuffering && !state.isLoaded) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <View style={styles.leftSection}>
          {/* Play/Pause Button */}
          <TouchableOpacity
            style={[
              styles.playPauseButton,
              (!state.isLoaded || state.isBuffering) && styles.playPauseButtonDisabled,
            ]}
            onPress={handlePlayPause}
            disabled={!state.isLoaded || state.isBuffering}
          >
            {state.isBuffering ? (
              <ActivityIndicator size="small" color={COLORS.WHITE} />
            ) : (
              <Ionicons
                name={state.isPlaying ? 'pause' : 'play'}
                size={18}
                color={COLORS.WHITE}
                style={!state.isPlaying ? { marginLeft: 1 } : undefined}
              />
            )}
          </TouchableOpacity>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <PlayerProgress />
          </View>
        </View>

        <View style={styles.rightSection}>
          {/* Playback Rate Selector */}
          <TouchableOpacity 
            style={styles.playbackRateButton} 
            onPress={() => {
              const rates = getAvailablePlaybackRates();
              const currentIndex = rates.indexOf(state.playbackRate);
              const nextIndex = (currentIndex + 1) % rates.length;
              handlePlaybackRateChange(rates[nextIndex]);
            }}
          >
            <Text style={styles.playbackRateText}>
              {state.playbackRate}x
            </Text>
          </TouchableOpacity>

          {/* Remaining Time Display */}
          {state.duration && (
            <Text style={styles.durationText}>
              {formatTime(getRemainingTime())}
            </Text>
          )}

          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons
              name="close"
              size={14}
              color={isDarkMode ? COLORS.TEXT_SECONDARY_DARK : COLORS.TEXT_SECONDARY_LIGHT}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default PodcastPlayer;
