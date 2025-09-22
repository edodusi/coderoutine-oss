import React, { useState, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { usePodcast } from '../../context/PodcastContext';
import { useTheme } from '../../context/ThemeContext';

const COLORS = {
  WHITE: '#FFFFFF',
  GRAY_LIGHT: '#E5E5EA',
  GRAY: '#8E8E93',
  GRAY_DARK: '#3A3A3C',
  GRAY_DARKER: '#1C1C1E',
  PRIMARY: '#007AFF',
  BORDER_LIGHT: '#C6C6C8',
  BORDER_DARK: '#38383A',
};

const PROGRESS_HEIGHT = 3;
const THUMB_SIZE = 12;
const TOUCH_AREA_HEIGHT = 24;

const PlayerProgress: React.FC = () => {
  const { theme, isDarkMode } = useTheme();
  const { state, seekTo, getPlaybackProgress } = usePodcast();

  const progress = getPlaybackProgress();

  const styles = StyleSheet.create({
    container: {
      height: TOUCH_AREA_HEIGHT,
      justifyContent: 'center',
      width: '100%',
    },
    progressBackground: {
      height: PROGRESS_HEIGHT,
      backgroundColor: isDarkMode ? COLORS.GRAY_DARK : COLORS.GRAY_LIGHT,
      borderRadius: PROGRESS_HEIGHT / 2,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.colors.primary,
      borderRadius: PROGRESS_HEIGHT / 2,
    },
    thumbContainer: {
      position: 'absolute',
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: THUMB_SIZE / 2,
      backgroundColor: theme.colors.primary,
      top: (TOUCH_AREA_HEIGHT - THUMB_SIZE) / 2,
      marginLeft: -THUMB_SIZE / 2,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    thumb: {
      width: '100%',
      height: '100%',
      borderRadius: THUMB_SIZE / 2,
      backgroundColor: theme.colors.primary,
    },
  });

  // Simple tap-to-seek implementation
  const handleProgressTap = useCallback((event: any) => {
    if (!state.duration) return;

    const { nativeEvent } = event;
    const { locationX, target } = nativeEvent;
    
    // Get the width of the progress container (simplified approach)
    const progressWidth = 250; // This should be calculated from actual component width
    const newProgress = Math.max(0, Math.min(1, locationX / progressWidth));
    const newPosition = newProgress * state.duration;
    
    seekTo(newPosition);
  }, [state.duration, seekTo]);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handleProgressTap}
      activeOpacity={0.8}
    >
      {/* Progress Background */}
      <View style={styles.progressBackground}>
        {/* Progress Fill */}
        <View
          style={[
            styles.progressFill,
            {
              width: `${progress}%`,
            },
          ]}
        />
      </View>

      {/* Thumb */}
      {progress > 0 && (
        <View
          style={[
            styles.thumbContainer,
            {
              left: `${Math.max(0, Math.min(100, progress))}%`,
            },
          ]}
        >
          <View style={styles.thumb} />
        </View>
      )}
    </TouchableOpacity>
  );
};

export default PlayerProgress;