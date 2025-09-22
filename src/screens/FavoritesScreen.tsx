import React, { useState, useEffect, useMemo } from 'react';
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
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { useFavoritesFilter } from '../hooks/useFavoritesFilter';
import { usePremiumAccess } from '../hooks/usePremiumAccess';
import { FavoriteArticle } from '../types';
import TagSelector from '../components/TagSelector';

const { width } = Dimensions.get('window');

const FavoritesScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const { checkPremiumAccess, hasPremiumAccess } = usePremiumAccess();
  const { removeFavorite } = useApp();
  const {
    filteredFavorites,
    selectedTags,
    availableTags,
    toggleTag,
    clearTags,
    favoriteCount,
    filteredCount,
    isFiltered,
  } = useFavoritesFilter();

  const ITEMS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [modalVisible, setModalVisible] = useState<{ articleTitle: string, articleUrl: string | null, articleId: string } | null>(null);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTags]);

  // Calculate paginated items
  const paginatedFavorites = useMemo(() => {
    return filteredFavorites.slice(0, currentPage * ITEMS_PER_PAGE);
  }, [filteredFavorites, currentPage]);

  const hasMoreItems = filteredFavorites.length > paginatedFavorites.length;

  const handleFavoriteItemPress = (article: FavoriteArticle) => {
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

  const handleRemoveFavorite = (articleId: string, title: string) => {
    Alert.alert(
      'Remove Favorite',
      `Remove "${title}" from favorites?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeFavorite(articleId),
        },
      ]
    );
  };

  const handleLoadMore = () => {
    if (hasMoreItems && !isLoadingMore) {
      setIsLoadingMore(true);
      // Simulate loading delay for better UX
      setTimeout(() => {
        setCurrentPage(prev => prev + 1);
        setIsLoadingMore(false);
      }, 300);
    }
  };

  const renderFavoriteItem = ({ item }: { item: FavoriteArticle }) => (
    <View style={[styles.favoriteItem, { backgroundColor: theme.colors.card }]}>
      <TouchableOpacity
        style={styles.favoriteContent}
        onPress={() => handleFavoriteItemPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.favoriteHeader}>
          <Text style={[styles.favoriteTitle, { color: theme.colors.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          <TouchableOpacity
            onPress={() => handleRemoveFavorite(item.id, item.title)}
            style={styles.removeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="heart"
              size={20}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
        </View>

        {item.description && (
          <Text style={[styles.description, { color: theme.colors.textSecondary }]} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        {item.tags && item.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {item.tags.map((tag, index) => (
              <View key={index} style={[
                styles.tag,
                {
                  backgroundColor: selectedTags.includes(tag)
                    ? theme.colors.primary + '30'
                    : theme.colors.primary + '20',
                  borderColor: selectedTags.includes(tag)
                    ? theme.colors.primary
                    : 'transparent',
                  borderWidth: selectedTags.includes(tag) ? 1 : 0,
                }
              ]}>
                <Text style={[
                  styles.tagText,
                  {
                    color: selectedTags.includes(tag)
                      ? theme.colors.primary
                      : theme.colors.primary,
                    fontWeight: selectedTags.includes(tag) ? '600' : '500'
                  }
                ]}>
                  {tag}
                </Text>
                {selectedTags.includes(tag) && (
                  <Ionicons
                    name="checkmark"
                    size={12}
                    color={theme.colors.primary}
                    style={styles.tagIcon}
                  />
                )}
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => {
    if (favoriteCount === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons
            name="heart-outline"
            size={64}
            color={theme.colors.textSecondary}
          />
          <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>
            No Favorites Yet
          </Text>
          <Text style={[styles.emptyStateDescription, { color: theme.colors.textSecondary }]}>
            Tap the heart icon on articles to add them to your favorites
          </Text>
        </View>
      );
    }

    // Filtered empty state
    return (
      <View style={styles.emptyState}>
        <Ionicons
          name="filter-outline"
          size={64}
          color={theme.colors.textSecondary}
        />
        <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>
          No Favorites Found
        </Text>
        <Text style={[styles.emptyStateDescription, { color: theme.colors.textSecondary }]}>
          No favorites match the selected topics. Try selecting different tags or clear your filters.
        </Text>
        <TouchableOpacity
          style={[styles.clearFiltersButton, { backgroundColor: theme.colors.primary }]}
          onPress={clearTags}
          activeOpacity={0.8}
        >
          <Text style={[styles.clearFiltersText, { color: '#FFFFFF' }]}>
            Clear Filters
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderLoadMoreButton = () => {
    if (!hasMoreItems) return null;

    return (
      <View style={styles.loadMoreContainer}>
        <TouchableOpacity
          style={[styles.loadMoreButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleLoadMore}
          disabled={isLoadingMore}
          activeOpacity={0.8}
        >
          {isLoadingMore ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Text style={[styles.loadMoreText, { color: '#FFFFFF' }]}>
                Load More ({filteredFavorites.length - paginatedFavorites.length} remaining)
              </Text>
              <Ionicons
                name="chevron-down"
                size={16}
                color="#FFFFFF"
                style={styles.loadMoreIcon}
              />
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingTop: 0,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 0,
      paddingBottom: 12,
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    loadMoreContainer: {
      paddingTop: 16,
      paddingBottom: 16,
      paddingHorizontal: 20,
      alignItems: 'center',
    },
    loadMoreButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 25,
      minWidth: 200,
    },
    loadMoreText: {
      fontSize: 16,
      fontWeight: '600',
    },
    loadMoreIcon: {
      marginLeft: 8,
    },
    tagSelectorContainer: {
      paddingHorizontal: 20,
    },
    list: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    listContent: {
      paddingHorizontal: 20,
      paddingTop: 0,
      paddingBottom: 0,
      flexGrow: 1,
    },
    emptyList: {
      flex: 1,
      paddingHorizontal: 20,
      paddingBottom: 0,
    },
    favoriteItem: {
      marginBottom: 16,
      borderRadius: 12,
      elevation: 2,
      shadowOpacity: 0.1,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
    favoriteContent: {
      padding: 16,
    },
    favoriteHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    favoriteTitle: {
      fontSize: 18,
      fontWeight: '600',
      flex: 1,
      marginRight: 12,
      lineHeight: 24,
    },
    removeButton: {
      padding: 4,
    },
    favoriteDetails: {
      marginBottom: 12,
    },
    favoriteDate: {
      fontSize: 14,
      marginBottom: 4,
    },
    routineDay: {
      fontSize: 14,
    },
    description: {
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 12,
    },
    tagsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      marginBottom: 12,
    },
    tag: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      marginRight: 8,
      marginBottom: 4,
      flexDirection: 'row',
      alignItems: 'center',
    },
    tagText: {
      fontSize: 12,
      fontWeight: '500',
    },
    tagIcon: {
      marginLeft: 2,
    },
    externalLinkIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    externalLinkText: {
      fontSize: 12,
      marginLeft: 4,
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
      marginBottom: 24,
    },
    clearFiltersButton: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    clearFiltersText: {
      fontSize: 16,
      fontWeight: '600',
    },
    devButtonContainer: {
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    devButton: {
      backgroundColor: '#FFD700',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: '#FFA500',
      borderStyle: 'dashed',
    },
    devButtonText: {
      color: '#8B4513',
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
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
    <SafeAreaView style={styles.container} edges={['top'] as Edge[]}>
      {/*{isDevMode() && (
        <View style={styles.devButtonContainer}>
          <TouchableOpacity
            style={styles.devButton}
            onPress={handleGenerateTestData}
            activeOpacity={0.8}
          >
            <Text style={styles.devButtonText}>
              DEV: Generate 20 Random Favorites
            </Text>
          </TouchableOpacity>
        </View>
      )}*/}

      <View style={styles.header}>
        {favoriteCount > 0 && (
          <Text style={styles.subtitle}>
            {isFiltered
              ? `${filteredCount} of ${favoriteCount} article${favoriteCount !== 1 ? 's' : ''}`
              : `${favoriteCount} article${favoriteCount !== 1 ? 's' : ''}`
            }
          </Text>
        )}
      </View>

      {favoriteCount > 0 && (
        <View style={styles.tagSelectorContainer}>
          <TagSelector
            availableTags={availableTags}
            selectedTags={selectedTags}
            onToggleTag={toggleTag}
            onClearTags={clearTags}
            loading={false}
            maxVisibleTags={12}
            collapsibleRows={1}
          />
        </View>
      )}

      <FlatList
        data={paginatedFavorites}
        renderItem={renderFavoriteItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={paginatedFavorites.length === 0 ? styles.emptyList : styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderLoadMoreButton}
        removeClippedSubviews={true}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
      />

      {/* Favorite Item Modal */}
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

export default FavoritesScreen;
