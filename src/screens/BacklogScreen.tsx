/**
 * BacklogScreen - Article Delay & Backlog Management
 *
 * This screen manages delayed articles in the user's backlog. Key features:
 *
 * BACKLOG FUNCTIONALITY:
 * - Users can delay today's routine article for up to 2 days
 * - Maximum 2 articles can be in backlog at any time
 * - Articles automatically expire and are removed after 2 days
 * - Backlog articles can be read as "today's routine" with clear indication
 *
 * USER EXPERIENCE:
 * - Clear expiry warnings when articles are close to expiration
 * - Easy access to read backlog articles as current routine
 * - One-tap removal from backlog
 * - Visual indicators for article age and original routine day
 *
 * STREAK PRESERVATION:
 * - Allows users to maintain reading streaks when they can't read on schedule
 * - Delayed articles can be read later while keeping streak active
 * - Seamless transition between current and backlog articles
 *
 * INTEGRATION:
 * - Accessed via backlog widget on HomeScreen (only visible when articles exist)
 * - Articles read from backlog are automatically removed from backlog
 * - Clean integration with existing article reading flow
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { DelayedArticle } from '../types';
import { RootStackParamList } from '../components/Navigation';

type BacklogScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Backlog'>;

const BacklogScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<BacklogScreenNavigationProp>();
  const {
    getBacklogArticles,
    removeFromBacklog,
    setViewingBacklogArticle,
    cleanExpiredBacklogArticles,
  } = useApp();

  const [refreshing, setRefreshing] = useState(false);
  const [removeModalVisible, setRemoveModalVisible] = useState(false);
  const [articleToRemove, setArticleToRemove] = useState<string | null>(null);

  const backlogArticles = getBacklogArticles();

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await cleanExpiredBacklogArticles();
    } catch (error) {
      console.error('Error refreshing backlog:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleReadBacklogArticle = (delayedArticle: DelayedArticle) => {
    // Set the app to view this backlog article
    setViewingBacklogArticle(true, delayedArticle.article.id);

    // Navigate to the Article tab in MainTabs
    navigation.navigate('MainTabs', { screen: 'Article' });
  };

  const handleRemoveFromBacklog = (articleId: string) => {
    setArticleToRemove(articleId);
    setRemoveModalVisible(true);
  };

  const handleConfirmRemove = () => {
    if (articleToRemove) {
      removeFromBacklog(articleToRemove);
      setRemoveModalVisible(false);
      setArticleToRemove(null);
    }
  };

  const handleCancelRemove = () => {
    setRemoveModalVisible(false);
    setArticleToRemove(null);
  };

  const getExpiryWarning = (delayedAt: string): string | null => {
    const now = new Date();
    const delayedDate = new Date(delayedAt);
    const hoursLeft = 48 - Math.floor((now.getTime() - delayedDate.getTime()) / (1000 * 60 * 60));

    if (hoursLeft <= 24) {
      return `Expires in ${hoursLeft}h`;
    }
    return null;
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContainer: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 40,
    },
    header: {
      marginBottom: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
      letterSpacing: -0.6,
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      lineHeight: 22,
    },
    infoCard: {
      backgroundColor: theme.colors.orange + '20',
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.orange,
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.orange,
      marginBottom: 8,
    },
    infoText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    backlogItem: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      elevation: 2,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    backlogHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    backlogMeta: {
      flex: 1,
      marginRight: 12,
    },
    backlogTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
      lineHeight: 24,
      letterSpacing: -0.3,
    },
    backlogDate: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 4,
    },
    originalDate: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
    },
    expiryWarning: {
      fontSize: 12,
      color: theme.colors.error,
      fontWeight: '600',
      marginTop: 4,
    },
    removeButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
    },
    backlogDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
      marginBottom: 16,
    },
    tagsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    tag: {
      backgroundColor: theme.colors.orange + '20',
      borderColor: theme.colors.orange + '30',
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    tagText: {
      fontSize: 12,
      color: theme.colors.orange,
      fontWeight: '600',
    },
    backlogActions: {
      flexDirection: 'row',
      gap: 12,
    },
    readButton: {
      flex: 1,
      backgroundColor: theme.colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    readButtonText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 16,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyIcon: {
      marginBottom: 24,
      opacity: 0.6,
    },
    emptyTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    emptyDescription: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      paddingHorizontal: 40,
    },
    // Remove Modal Styles
    removeModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    removeModalContent: {
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
    removeModalIcon: {
      alignItems: 'center',
      marginBottom: 16,
    },
    removeModalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    removeModalMessage: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 24,
    },
    removeModalActions: {
      flexDirection: 'row',
      gap: 12,
    },
    removeModalButton: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 12,
      alignItems: 'center',
    },
    removeModalCancelButton: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    removeModalConfirmButton: {
      backgroundColor: theme.colors.error,
    },
    removeModalButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    removeModalCancelText: {
      color: theme.colors.text,
    },
    removeModalConfirmText: {
      color: '#FFFFFF',
    },
  });

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
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How Backlog Works</Text>
          <Text style={styles.infoText}>
            • Articles expire after 2 days{'\n'}
            • Maximum 2 articles in backlog{'\n'}
            • Tap to read as today's routine{'\n'}
            • Delaying preserves your reading streak{'\n'}
            • Keep your streak active while managing time
          </Text>
        </View>

        {backlogArticles.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="library-outline"
              size={80}
              color={theme.colors.disabled}
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyTitle}>No Delayed Articles</Text>
            <Text style={styles.emptyDescription}>
              When you delay an article from today's routine, it will appear here for up to 2 days.
            </Text>
          </View>
        ) : (
          backlogArticles.map((delayedArticle) => {
            const expiryWarning = getExpiryWarning(delayedArticle.delayedAt);

            return (
              <View key={delayedArticle.article.id} style={styles.backlogItem}>
                <View style={styles.backlogHeader}>
                  <View style={styles.backlogMeta}>
                    <Text style={styles.backlogTitle} numberOfLines={2}>
                      {delayedArticle.article.title}
                    </Text>
                    <Text style={styles.originalDate}>
                      Originally from {new Date(delayedArticle.originalRoutineDay).toLocaleDateString()}
                    </Text>
                    {expiryWarning && (
                      <Text style={styles.expiryWarning}>
                        ⚠️ {expiryWarning}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveFromBacklog(delayedArticle.article.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color={theme.colors.error}
                    />
                  </TouchableOpacity>
                </View>

                {delayedArticle.article.description && (
                  <Text style={styles.backlogDescription} numberOfLines={3}>
                    {delayedArticle.article.description}
                  </Text>
                )}

                <View style={styles.tagsContainer}>
                  {delayedArticle.article.tags.slice(0, 3).map((tag, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                  {delayedArticle.article.tags.length > 3 && (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>
                        +{delayedArticle.article.tags.length - 3}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.backlogActions}>
                  <TouchableOpacity
                    style={styles.readButton}
                    onPress={() => handleReadBacklogArticle(delayedArticle)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="book-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.readButtonText}>Read Now</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Remove Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={removeModalVisible}
        onRequestClose={handleCancelRemove}
      >
        <View style={styles.removeModalOverlay}>
          <View style={styles.removeModalContent}>
            <View style={styles.removeModalIcon}>
              <Ionicons name="trash-outline" size={48} color={theme.colors.error} />
            </View>

            <Text style={styles.removeModalTitle}>
              Remove from Backlog?
            </Text>

            <Text style={styles.removeModalMessage}>
              Are you sure you want to remove this article from your backlog? You won't be able to read it anymore.
            </Text>

            <View style={styles.removeModalActions}>
              <TouchableOpacity
                style={[styles.removeModalButton, styles.removeModalCancelButton]}
                onPress={handleCancelRemove}
                activeOpacity={0.8}
              >
                <Text style={[styles.removeModalButtonText, styles.removeModalCancelText]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.removeModalButton, styles.removeModalConfirmButton]}
                onPress={handleConfirmRemove}
                activeOpacity={0.8}
              >
                <Text style={[styles.removeModalButtonText, styles.removeModalConfirmText]}>
                  Remove
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default BacklogScreen;
