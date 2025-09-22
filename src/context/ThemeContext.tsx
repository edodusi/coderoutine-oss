import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import { storageService } from '../services/storageService';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  backgroundHighlighted: string;
  surface: string;
  card: string;
  todayCard: string;
  text: string;
  textSecondary: string;
  border: string;
  notification: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  accent: string;
  disabled: string;
  placeholder: string;
  // Button-specific colors
  buttonInactive: string;
  buttonTextInactive: string;
  buttonTextActive: string;
  podcastButton: string;
  podcastButtonActive: string;
  grayLight: string;
  grayDark: string;
  white: string;
  orange: string;
}

export interface Theme {
  colors: ThemeColors;
  mode: 'light' | 'dark';
}

const lightColors: ThemeColors = {
  primary: '#118ab2',
  secondary: '#cae9ff',
  background: '#FFFFFF',
  backgroundHighlighted: '#073b4c',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  todayCard: '#FFFFFF',
  text: '#000000',
  textSecondary: '#073b4c',
  border: '#edf2fb',
  notification: '#FF5722',
  success: '#06d6a0',
  error: '#ef476f',
  warning: '#ffd166',
  info: '#2196F3',
  accent: '#FF4081',
  disabled: '#BDBDBD',
  placeholder: '#9E9E9E',
  // Button-specific colors
  buttonInactive: '#F5F5F7',
  buttonTextInactive: '#3A3A3C',
  buttonTextActive: '#FFFFFF',
  podcastButton: '#E8F5E8',
  podcastButtonActive: '#ba93de',
  grayLight: '#F5F5F7',
  grayDark: '#3A3A3C',
  white: '#FFFFFF',
  orange: '#F59E0B',
};

const darkColors: ThemeColors = {
  primary: '#118ab2',
  secondary: '#03DAC6',
  background: '#121212',
  backgroundHighlighted: '#073b4c',
  surface: '#1E1E1E',
  card: '#2C2C2C',
  todayCard: '#2C2C2C',
  text: '#FFFFFF',
  textSecondary: '#CCCCCC',
  border: '#333333',
  notification: '#FF5722',
  success: '#06d6a0',
  error: '#ef476f',
  warning: '#ffd166',
  info: '#2196F3',
  accent: '#FF4081',
  disabled: '#555555',
  placeholder: '#777777',
  // Button-specific colors
  buttonInactive: '#404040',
  buttonTextInactive: '#CCCCCC',
  buttonTextActive: '#FFFFFF',
  podcastButton: '#1a3d35',
  podcastButtonActive: '#ba93de',
  grayLight: '#2C2C2C',
  grayDark: '#CCCCCC',
  white: '#FFFFFF',
  orange: '#F59E0B',
};

const lightTheme: Theme = {
  colors: lightColors,
  mode: 'light',
};

const darkTheme: Theme = {
  colors: darkColors,
  mode: 'dark',
};

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  isDarkMode: boolean;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  // Check if running in Expo Go (development)
  const isExpoGo = __DEV__ && typeof window !== 'undefined' &&
    (window.location?.hostname === 'localhost' ||
     window.location?.hostname?.includes('expo.dev') ||
     navigator.userAgent?.includes('Expo'));

  // Helper function to get system color scheme with fallbacks
  const getSystemColorScheme = (): ColorSchemeName => {
    const scheme = Appearance.getColorScheme();

    // In Expo Go, system theme detection often doesn't work properly
    if (isExpoGo && (scheme === null || scheme === 'light')) {
      // For development in Expo Go, try CSS media query as primary method
      if (typeof window !== 'undefined') {
        try {
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
          return mediaQuery.matches ? 'dark' : 'light';
        } catch (error) {
          // If media query fails, default to dark for better development experience
          // since most developers use dark mode
          return 'dark';
        }
      }
    }

    // For production builds or when scheme is detected properly
    return scheme;
  };

  const [systemColorScheme, setSystemColorScheme] = useState<ColorSchemeName>(
    getSystemColorScheme()
  );

  // Load saved theme preference on mount
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedTheme = await storageService.getThemePreference();
        // For backwards compatibility, convert boolean to ThemeMode
        if (typeof savedTheme === 'boolean') {
          setThemeModeState(savedTheme ? 'dark' : 'light');
        } else if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
          setThemeModeState(savedTheme);
        } else {
          setThemeModeState('system'); // Default to system if no preference
        }
      } catch (error) {
        console.error('Error loading theme preference:', error);
        setThemeModeState('system');
      }
    };

    loadThemePreference();
  }, []);

  // Listen to system color scheme changes
  useEffect(() => {
    // Set up React Native appearance listener
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemColorScheme(colorScheme || getSystemColorScheme());
    });

    // For Expo Go or web, prioritize CSS media query changes
    let mediaQueryListener: MediaQueryList | null = null;
    if (typeof window !== 'undefined') {
      try {
        mediaQueryListener = window.matchMedia('(prefers-color-scheme: dark)');
        const handleMediaChange = (e: MediaQueryListEvent) => {
          // In Expo Go, always use media query. In production, use as fallback
          if (isExpoGo || Appearance.getColorScheme() === null) {
            setSystemColorScheme(e.matches ? 'dark' : 'light');
          }
        };
        mediaQueryListener.addEventListener('change', handleMediaChange);
      } catch (error) {
        // Media query not supported, ignore
      }
    }

    return () => {
      subscription?.remove();
      if (mediaQueryListener) {
        try {
          mediaQueryListener.removeEventListener('change', () => {});
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    };
  }, [isExpoGo]);

  // Determine the actual theme based on mode and system preference
  const isDarkMode = React.useMemo(() => {
    switch (themeMode) {
      case 'light':
        return false;
      case 'dark':
        return true;
      case 'system':
        // Handle null case: if system color scheme is unknown, use fallbacks
        let result: boolean;
        if (systemColorScheme === null) {
          const fallbackScheme = getSystemColorScheme();
          result = fallbackScheme === 'dark';
        } else {
          result = systemColorScheme === 'dark';
        }

        // Development info
        if (__DEV__) {
          console.log('🎨 Theme Detection:', {
            themeMode,
            systemColorScheme,
            isExpoGo,
            isDarkMode: result,
            fallbackUsed: systemColorScheme === null
          });
        }

        return result;
      default:
        return false;
    }
  }, [themeMode, systemColorScheme, isExpoGo]);

  const theme = isDarkMode ? darkTheme : lightTheme;

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      // Save the theme mode directly to storage
      await storageService.saveThemePreference(mode);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const toggleTheme = () => {
    const newMode = isDarkMode ? 'light' : 'dark';
    setThemeMode(newMode);
  };

  const contextValue: ThemeContextType = {
    theme,
    themeMode,
    isDarkMode,
    toggleTheme,
    setThemeMode,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Custom hook for accessing theme colors directly
export const useThemeColors = (): ThemeColors => {
  const { theme } = useTheme();
  return theme.colors;
};

// Utility function to get theme-aware styles
export const createThemedStyles = <T extends Record<string, any>>(
  styleFactory: (colors: ThemeColors, isDark: boolean) => T
) => {
  return (colors: ThemeColors, isDark: boolean): T => {
    return styleFactory(colors, isDark);
  };
};

export { lightTheme, darkTheme };
