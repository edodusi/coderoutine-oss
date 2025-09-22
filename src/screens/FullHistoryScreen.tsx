import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { ArticleWithProgress } from '../types';
import { useArticles } from '../hooks';
import { usePremiumAccess } from '../hooks/usePremiumAccess';

const { width } = Dimensions.get('window');

const FullHistoryScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const { checkPremiumAccess, hasPremiumAccess } = usePremiumAccess();
  const { articles, loading, hasMore, loadMore, refresh } = useArticles(20);
  const [modalVisible, setModalVisible] = useState<{ articleTitle: string, articleUrl: string | null, articleId: string } | null>(null);

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

    const hasAccess = await checkPremiumAccess('AI Summary');
    if (!hasAccess) {
      return;
    }

    setModalVisible(null);
    (navigation as any).navigate('Summary', {
      articleId: modalVisible.articleId,
      articleTitle: modalVisible.articleTitle,
      articleUrl: modalVisible.articleUrl,
    });
  };

  const formatDate = (dateString?: string, fallbackDate?: string) => {
    const targetDate = dateString || fallbackDate;
    if (!targetDate) return 'Unknown date';

    const date = new Date(targetDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays <= 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  };

  const renderHistoryItem = ({ item }: { item: ArticleWithProgress }) => {
    const isRead = item.progress?.isRead || false;
    const readDate = item.progress?.readAt;

    return (
      <View style={[styles.historyItem, { backgroundColor: theme.colors.card }]}>
        <TouchableOpacity
          style={styles.historyContent}
          onPress={() => handleHistoryItemPress(item)}
          activeOpacity={0.7}
        >
          <View style={styles.historyHeader}>
            <View style={styles.titleContainer}>
              <Text style={[styles.historyTitle, { color: theme.colors.text }]} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={styles.statusContainer}>
                <View style={[
                  styles.statusIndicator,
                  { backgroundColor: isRead ? theme.colors.success : theme.colors.error }
                ]} />
                <Text style={[styles.statusText, { color: theme.colors.textSecondary }]}>
                  {isRead ? 'Read' : 'Unread'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.historyDetails}>
            <View style={styles.detailRow}>
              <Ionicons
                name="time-outline"
                size={16}
                color={theme.colors.textSecondary}
              />
              <Text style={[styles.detailText, { color: theme.colors.textSecondary }]}>
                {isRead && readDate
                  ? `Read ${formatDate(readDate)}`
                  : `Published ${formatDate(undefined, item.routineDay)}`
                }
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyStateDescription, { color: theme.colors.textSecondary, marginTop: 16 }]}>
            Loading articles...
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Ionicons
          name="library-outline"
          size={64}
          color={theme.colors.textSecondary}
        />
        <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>
          No Articles Available
        </Text>
        <Text style={[styles.emptyStateDescription, { color: theme.colors.textSecondary }]}>
          Check back later for new articles in the CodeRoutine
        </Text>
      </View>
    );
  }

  const renderFooter = () => {
    if (loading && articles.length > 0) {
      return (
        <View style={styles.loadingFooter}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading more articles...
          </Text>
        </View>
      );
    }

    if (!hasMore && articles.length > 0) {
      return (
        <View style={styles.endMessage}>
          <Ionicons
            name="checkmark-circle"
            size={24}
            color={theme.colors.success}
          />
          <Text style={[styles.endMessageText, { color: theme.colors.textSecondary }]}>
            You have reached the end of the CodeRoutine history!
          </Text>
        </View>
      );
    }

    if (hasMore && articles.length > 0 && !loading) {
      return (
        <TouchableOpacity
          style={[styles.loadMoreButton, { backgroundColor: theme.colors.primary }]}
          onPress={loadMore}
          activeOpacity={0.8}
        >
          <Text style={[styles.loadMoreText, { color: theme.colors.surface }]}>
            Load More Articles
          </Text>
        </TouchableOpacity>
      );
    }

    return null;
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 0,
      paddingBottom: 12,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 16,
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    emptyList: {
      flex: 1,
      paddingHorizontal: 20,
    },
    historyItem: {
      marginBottom: 16,
      borderRadius: 12,
      elevation: 2,
      shadowOpacity: 0.1,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
    historyContent: {
      padding: 16,
    },
    historyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    titleContainer: {
      flex: 1,
      marginRight: 12,
    },
    historyTitle: {
      fontSize: 18,
      fontWeight: '600',
      lineHeight: 24,
      marginBottom: 8,
    },
    statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statusIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 6,
    },
    statusText: {
      fontSize: 14,
      fontWeight: '500',
    },
    historyDetails: {
      marginBottom: 0,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 0,
    },
    detailText: {
      fontSize: 14,
      marginLeft: 8,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyStateTitle: {
      fontSize: 24,
      fontWeight: '600',
      marginTop: 16,
      marginBottom: 8,
    },
    emptyStateDescription: {
      fontSize: 16,
      textAlign: 'center',
      paddingHorizontal: 40,
      lineHeight: 22,
    },
    loadingFooter: {
      paddingVertical: 20,
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 8,
      fontSize: 14,
    },
    loadMoreButton: {
      marginHorizontal: 20,
      marginVertical: 16,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    loadMoreText: {
      fontSize: 16,
      fontWeight: '600',
    },
    endMessage: {
      paddingVertical: 24,
      paddingHorizontal: 20,
      alignItems: 'center',
    },
    endMessageText: {
      fontSize: 14,
      textAlign: 'center',
      marginTop: 8,
      fontStyle: 'italic',
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
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Routine History
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          This is the full CodeRoutine article history! Check how are you doing so far.
        </Text>
      </View>

      <FlatList
        data={articles}
        renderItem={renderHistoryItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={articles.length === 0 ? styles.emptyList : styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        onRefresh={refresh}
        refreshing={loading && articles.length === 0}
      />

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
    </SafeAreaView>
  );
};

export default FullHistoryScreen;
