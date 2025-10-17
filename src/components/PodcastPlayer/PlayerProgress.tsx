import React, { useCallback, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
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
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const [dragProgress, setDragProgress] = useState<number | null>(null);
  
  // Use drag progress while dragging, otherwise use actual progress
  const displayProgress = dragProgress !== null ? dragProgress : progress;

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

  // Handle layout to get actual container width
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setContainerWidth(width);
  }, []);

  // Gesture handler for dragging and tapping
  const panGesture = Gesture.Pan()
    .onStart((event) => {
      if (!state.duration || !containerWidth) return;
      isDraggingRef.current = true;
      
      // Calculate progress based on touch position
      const newProgress = Math.max(0, Math.min(100, (event.x / containerWidth) * 100));
      setDragProgress(newProgress);
    })
    .onUpdate((event) => {
      if (!state.duration || !containerWidth) return;
      
      // Update progress while dragging
      const newProgress = Math.max(0, Math.min(100, (event.x / containerWidth) * 100));
      setDragProgress(newProgress);
    })
    .onEnd(() => {
      if (!state.duration || !containerWidth || dragProgress === null) return;
      
      // Seek to the new position
      const newPosition = (dragProgress / 100) * state.duration;
      seekTo(newPosition);
      
      // Reset drag state
      isDraggingRef.current = false;
      setDragProgress(null);
    })
    .onFinalize(() => {
      // Cleanup if gesture is cancelled
      isDraggingRef.current = false;
      setDragProgress(null);
    });

  const tapGesture = Gesture.Tap()
    .onEnd((event) => {
      if (!state.duration || !containerWidth) return;
      
      // Calculate progress based on tap position
      const newProgress = Math.max(0, Math.min(100, (event.x / containerWidth) * 100));
      const newPosition = (newProgress / 100) * state.duration;
      seekTo(newPosition);
    });

  const composed = Gesture.Race(panGesture, tapGesture);

  return (
    <GestureDetector gesture={composed}>
      <View 
        style={styles.container}
        onLayout={handleLayout}
      >
      {/* Progress Background */}
      <View style={styles.progressBackground}>
        {/* Progress Fill */}
        <View
          style={[
            styles.progressFill,
            {
              width: `${displayProgress}%`,
            },
          ]}
        />
      </View>

      {/* Thumb */}
      {displayProgress > 0 && (
        <View
          style={[
            styles.thumbContainer,
            {
              left: `${Math.max(0, Math.min(100, displayProgress))}%`,
            },
          ]}
        >
          <View style={styles.thumb} />
        </View>
      )}
      </View>
    </GestureDetector>
  );
};

export default PlayerProgress;