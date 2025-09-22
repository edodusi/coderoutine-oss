import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import RenderHtml from 'react-native-render-html';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { usePremiumAccess } from '../hooks/usePremiumAccess';
import { apiService } from '../services/apiService';

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

interface SummaryScreenParams {
  articleId: string;
  articleTitle: string;
  articleUrl: string;
}

type SummaryScreenRouteProp = RouteProp<{
  Summary: SummaryScreenParams;
}, 'Summary'>;

// Common colors used throughout the component (matching ArticleScreen)
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
};

// Common border radius values
const BORDER_RADIUS = {
  SMALL: 4,
  MEDIUM: 8,
  LARGE: 12,
  EXTRA_LARGE: 16,
  ROUND: 20,
};

const LANGUAGE_OPTIONS = [
  { code: 'it' as SupportedLanguage, name: 'Italian', flag: '🇮🇹' },
  { code: 'es' as SupportedLanguage, name: 'Spanish', flag: '🇪🇸' },
  { code: 'de' as SupportedLanguage, name: 'German', flag: '🇩🇪' },
  { code: 'fr' as SupportedLanguage, name: 'French', flag: '🇫🇷' },
];

const SummaryScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<SummaryScreenRouteProp>();
  const { articleId, articleTitle, articleUrl } = route.params;
  const { state, updateTranslationSettings } = useApp();
  const { checkPremiumAccess } = usePremiumAccess();
  const scrollViewRef = useRef<ScrollView>(null);

  // Summary state
  const [aiSummary, setAiSummary] = useState<AiSummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [processedSummaryHtml, setProcessedSummaryHtml] = useState<string>('');

  // Translation state
  const [translationData, setTranslationData] = useState<TranslationData | null>(null);
  const [translationLoading, setTranslationLoading] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage | null>(null);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  // Progress tracking state
  const [readingProgress, setReadingProgress] = useState(0); // 0-100

  // Font size state
  const [summarySize, setSummarySize] = useState<'small' | 'medium' | 'large'>(
    state.translationSettings.summaryFontSize
  );

  const isDarkMode = theme.mode === 'dark';

  // Handle scroll events to track reading progress
  const handleScroll = (event: any) => {
    if (summaryLoading || translationLoading) return;

    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollY = contentOffset.y;
    const totalContentHeight = contentSize.height;
    const visibleHeight = layoutMeasurement.height;

    if (totalContentHeight <= visibleHeight) {
      setReadingProgress(100);
      return;
    }

    const maxScrollDistance = totalContentHeight - visibleHeight;
    const rawProgress = (scrollY / maxScrollDistance) * 100;
    const roundedProgress = Math.min(Math.round(rawProgress / 2) * 2, 100);

    setReadingProgress(roundedProgress);
  };

  // Generate AI summary
  const generateSummary = async () => {
    if (!articleUrl) return;

    setSummaryLoading(true);
    setSummaryError(null);
    setReadingProgress(0);

    try {
      const result = await apiService.getAiSummary(articleId);

      if (result.success && result.summary) {
        const summaryData: AiSummaryData = {
          summary: result.summary,
          originalUrl: articleUrl,
          generatedAt: result.generatedAt || new Date().toISOString(),
          wordCount: result.wordCount || 0,
        };

        setAiSummary(summaryData);

        // Process HTML for whitespace preservation (same as ArticleScreen)
        const processedHtml = processHtmlForWhitespace(result.summary);
        setProcessedSummaryHtml(processedHtml);
        setSummaryError(null);
      } else {
        setSummaryError(result.error || 'Failed to generate summary');
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      setSummaryError('Network error occurred');
    } finally {
      setSummaryLoading(false);
    }
  };

  // Generate translation
  const generateTranslation = async (language: SupportedLanguage) => {
    if (!aiSummary) return;

    setTranslationLoading(true);
    setTranslationError(null);
    setCurrentLanguage(language);
    setReadingProgress(0);

    try {
      const result = await apiService.getTranslation(articleId, language);

      if (result.success && result.translation) {
        const translationResult: TranslationData = {
          translation: result.translation,
          generatedAt: result.generatedAt || new Date().toISOString(),
          language: result.language || language,
          cached: result.cached || false,
        };
        setTranslationData(translationResult);
        setTranslationError(null);
      } else {
        setTranslationError(result.error || 'Translation failed');
      }
    } catch (error) {
      console.error('Error translating summary:', error);
      setTranslationError('Translation network error');
    } finally {
      setTranslationLoading(false);
    }
  };

  // Handle font size change
  const handleFontSizeChange = async (size: 'small' | 'medium' | 'large') => {
    setSummarySize(size);
    await updateTranslationSettings({ summaryFontSize: size });
  };

  // Handle language selection
  const handleLanguageSelection = async (language: SupportedLanguage) => {
    const hasAccess = await checkPremiumAccess('Translation');
    if (!hasAccess) return;

    setLanguageModalVisible(false);
    await generateTranslation(language);
  };

  // Handle translation button press
  const handleGenerateTranslatedSummary = async () => {
    const hasAccess = await checkPremiumAccess('Translation');
    if (!hasAccess) {
      return;
    }

    if (translationData) {
      // If already translated, go back to original
      handleBackToOriginal();
    } else {
      // Show language selection modal
      setLanguageModalVisible(true);
    }
  };

  const closeLanguageModal = () => {
    setLanguageModalVisible(false);
  };

  // Handle back to original
  const handleBackToOriginal = () => {
    setTranslationData(null);
    setCurrentLanguage(null);
    setTranslationError(null);
    setReadingProgress(0);
  };

  // Process HTML for whitespace preservation (same as ArticleScreen)
  const processHtmlForWhitespace = (htmlContent: string): string => {
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
  };

  // Load summary on mount
  useEffect(() => {
    generateSummary();
  }, []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backButton: {
      padding: 8,
      marginRight: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      flex: 1,
    },
    progressBarContainer: {
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    progressBarTrack: {
      height: 4,
      backgroundColor: theme.colors.border,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: theme.colors.success,
      borderRadius: 2,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
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
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
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
    retryButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    retryButtonText: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '600',
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
      backgroundColor: theme.colors.primary + '20',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    summaryBadgeText: {
      color: COLORS.GRAY_LIGHT,
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
    summaryControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    miniButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
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
    summaryContentContainer: {
      paddingHorizontal: 16,
      marginTop: 6,
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
      marginHorizontal: 16,
      marginBottom: 16,
    },
    summaryAuthorText: {
      fontSize: 14,
      color: COLORS.GRAY_DARKER,
      fontWeight: '500',
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
  });

  if (summaryLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI Summary</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Generating AI Summary...</Text>
          <Text style={styles.loadingSubtext}>
            Using Google Gemini • This may take 30-90 seconds
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (summaryError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI Summary</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={theme.colors.textSecondary} />
          <Text style={styles.errorTitle}>Summary Error</Text>
          <Text style={styles.errorText}>{summaryError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={generateSummary}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {translationData ? 'Translated Summary' : 'AI Summary'}
        </Text>
      </View>

      {/* Progress Bar */}
      <View style={[styles.progressBarContainer, { backgroundColor: theme.colors.background }]}>
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${readingProgress}%`
              }
            ]}
          />
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.summaryScreenContainer}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
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
                  name={translationData ? "language" : "sparkles"}
                  size={16}
                  color={theme.colors.primary}
                />
                <Text style={styles.summaryBadgeText}>
                  {translationData && currentLanguage ? (() => {
                    const lang = LANGUAGE_OPTIONS.find(l => l.code === currentLanguage);
                    return `${lang?.flag} ${lang?.name}`;
                  })() : 'AI Summary'}
                </Text>
              </View>

              <View style={styles.summaryCardFirstRowRight}>
                {translationData && (
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
                {!translationData && (
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
                {translationData ?
                  `${new Date(translationData.generatedAt).toLocaleDateString()} • ${translationData.cached ? 'Cached' : 'Generated'}` :
                  `${aiSummary?.wordCount || ''} words • ${aiSummary ? new Date(aiSummary.generatedAt).toLocaleDateString() : ''}`
                }
              </Text>

              <View style={styles.summaryControls}>
                <TouchableOpacity
                  style={[styles.miniButton, summarySize === 'small' && styles.miniButtonActive]}
                  onPress={() => handleFontSizeChange('small')}
                >
                  <Text style={[styles.miniButtonText, summarySize === 'small' && styles.miniButtonTextActive, { fontSize: 11 }]}>A</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.miniButton, summarySize === 'medium' && styles.miniButtonActive]}
                  onPress={() => handleFontSizeChange('medium')}
                >
                  <Text style={[styles.miniButtonText, summarySize === 'medium' && styles.miniButtonTextActive, { fontSize: 13 }]}>A</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.miniButton, summarySize === 'large' && styles.miniButtonActive]}
                  onPress={() => handleFontSizeChange('large')}
                >
                  <Text style={[styles.miniButtonText, summarySize === 'large' && styles.miniButtonTextActive, { fontSize: 15 }]}>A</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          {/* /Summary Card */}

          <Text style={{
            ...styles.summaryTitle,
            color: isDarkMode ? '#FFFFFF' : theme.colors.text
          }}>
            {articleTitle}
          </Text>

          <View style={styles.summaryAuthor}>
            <Text style={styles.summaryAuthorText}>
              Original from {new URL(articleUrl).hostname.replace('www.', '')} • AI Summary
            </Text>
          </View>

          {translationLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Generating Translation...</Text>
              <Text style={styles.loadingSubtext}>
                Translating to {currentLanguage ? LANGUAGE_OPTIONS.find(l => l.code === currentLanguage)?.name : 'selected language'}
              </Text>
            </View>
          ) : translationError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorTitle}>Translation Error</Text>
              <Text style={styles.errorText}>{translationError}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => currentLanguage && generateTranslation(currentLanguage)}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <SummaryContent
              html={translationData ? translationData.translation : processedSummaryHtml}
              summarySize={summarySize}
              theme={theme}
              isDarkMode={isDarkMode}
            />
          )}
        </View>
      </ScrollView>

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
    </SafeAreaView>
  );
};

// Memoized component to prevent re-render issues
const SummaryContent = React.memo(({ html, summarySize, theme, isDarkMode }: {
  html: string;
  summarySize: 'small' | 'medium' | 'large';
  theme: any;
  isDarkMode: boolean;
}) => {
  const renderersProps = useMemo(() => ({
    ul: {
      markerBoxStyle: {
        paddingRight: 12,
        alignItems: 'flex-start' as const,
        justifyContent: 'flex-start' as const,
      },
      getFallbackListStyleTypeFromNestLevel: (nestLevel: number) => {
        return nestLevel % 2 === 0 ? 'disc' : 'circle';
      },
    },
    ol: {
      markerBoxStyle: {
        paddingRight: 12,
        alignItems: 'flex-start' as const,
        justifyContent: 'flex-start' as const,
      },
    },
  }), []);

  const tagsStyles = useMemo(() => ({
    body: {
      color: theme.colors.text,
      fontSize: summarySize === 'small' ? 16 : summarySize === 'large' ? 20 : 18,
      lineHeight: summarySize === 'small' ? 26 : summarySize === 'large' ? 34 : 30,
      fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
      fontWeight: '400' as any,
      backgroundColor: theme.colors.background,
    },
    h1: {
      color: theme.colors.text,
      fontSize: summarySize === 'small' ? 26 : summarySize === 'large' ? 34 : 30,
      fontWeight: '700' as any,
      marginTop: 32,
      marginBottom: 16,
      lineHeight: summarySize === 'small' ? 34 : summarySize === 'large' ? 42 : 38,
      fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    },
    h2: {
      color: theme.colors.text,
      fontSize: summarySize === 'small' ? 22 : summarySize === 'large' ? 30 : 26,
      fontWeight: '600' as any,
      marginTop: 28,
      marginBottom: 14,
      lineHeight: summarySize === 'small' ? 30 : summarySize === 'large' ? 38 : 34,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border || (isDarkMode ? '#404040' : '#E5E5E5'),
      paddingBottom: 8,
      fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    },
    h3: {
      color: theme.colors.text,
      fontSize: summarySize === 'small' ? 20 : summarySize === 'large' ? 24 : 22,
      fontWeight: '600' as any,
      marginTop: 24,
      marginBottom: 12,
      lineHeight: summarySize === 'small' ? 28 : summarySize === 'large' ? 32 : 30,
      fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    },
    h4: {
      color: theme.colors.text,
      fontSize: summarySize === 'small' ? 18 : summarySize === 'large' ? 22 : 20,
      fontWeight: '600' as any,
      marginTop: 20,
      marginBottom: 10,
      lineHeight: summarySize === 'small' ? 26 : summarySize === 'large' ? 30 : 28,
      fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    },
    p: {
      marginBottom: 20,
      color: theme.colors.text,
      lineHeight: summarySize === 'small' ? 26 : summarySize === 'large' ? 34 : 30,
      fontSize: summarySize === 'small' ? 16 : summarySize === 'large' ? 20 : 18,
      fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
      textAlign: 'left' as any,
    },
    pre: {
      backgroundColor: theme.colors.surface,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 18,
      borderRadius: 12,
      marginVertical: 16,
      overflow: 'hidden' as any,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: summarySize === 'small' ? 16 : summarySize === 'large' ? 20 : 18,
      lineHeight: summarySize === 'small' ? 26 : summarySize === 'large' ? 34 : 30,
      fontVariant: ['tabular-nums'] as any,
    },
    code: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: summarySize === 'small' ? 16 : summarySize === 'large' ? 20 : 18,
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
      lineHeight: summarySize === 'small' ? 26 : summarySize === 'large' ? 34 : 30,
      paddingLeft: 0,
      marginLeft: 0,
      fontSize: summarySize === 'small' ? 16 : summarySize === 'large' ? 20 : 18,
      fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
      textAlign: 'left' as any,
    },
    strong: {
      fontWeight: '600' as any,
      color: theme.colors.text,
      fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
    },
    em: {
      fontStyle: 'italic' as any,
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
      textDecorationLine: 'underline' as any,
    },
  }), [theme.colors, summarySize, isDarkMode]);

  return (
    <View style={{
      paddingHorizontal: 16,
      marginTop: 6,
    }}>
      <RenderHtml
        source={{ html }}
        systemFonts={['Georgia', 'Times New Roman', 'serif', 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Source Code Pro', 'Menlo', 'Courier', 'Roboto', 'Roboto-Regular', 'sans-serif', 'monospace']}
        renderersProps={renderersProps}
        tagsStyles={tagsStyles}
      />
    </View>
  );
});

export default SummaryScreen;
