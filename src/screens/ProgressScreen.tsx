import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';

const ProgressScreen: React.FC = () => {
  const { state } = useApp();
  const { theme } = useTheme();
  const { getTotalReadArticles, getFavorites } = useApp();
  const { tagStats } = state;

  const totalRead = getTotalReadArticles();
  const favorites = getFavorites();

  // Sort tags by count (most explored first)
  const sortedTags = Object.entries(tagStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10); // Show top 10 tags

  const maxTagCount = sortedTags.length > 0 ? sortedTags[0][1] : 1;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 10,
    },
    backButton: {
      marginRight: 15,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
      flex: 1,
    },
    scrollContent: {
      padding: 20,
    },
    overviewSection: {
      marginBottom: 30,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 20,
      textAlign: 'center',
    },
    overviewGrid: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    overviewItem: {
      alignItems: 'center',
      flex: 1,
    },
    overviewIcon: {
      width: 50,
      height: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    overviewNumber: {
      fontSize: 32,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 5,
    },
    overviewLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 16,
    },
    tagsSection: {
      marginBottom: 30,
    },
    tagItem: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    tagHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    tagName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      flex: 1,
    },
    tagCount: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.primary,
      marginLeft: 10,
    },
    progressBarContainer: {
      height: 6,
      backgroundColor: theme.colors.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: theme.colors.success,
      borderRadius: 3,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      marginTop: 20,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptyDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
  });

  return (
    <SafeAreaView style={styles.container}>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Overview Section */}
        <View style={styles.overviewSection}>
          <Text style={styles.sectionTitle}>📊 Overview</Text>
          <View style={styles.overviewGrid}>
            <View style={styles.overviewItem}>
              <View style={[styles.overviewIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                <Ionicons name="book" size={24} color={theme.colors.primary} />
              </View>
              <Text style={styles.overviewNumber}>{totalRead}</Text>
              <Text style={styles.overviewLabel}>Articles{'\n'}Read</Text>
            </View>

            <View style={styles.overviewItem}>
              <View style={[styles.overviewIcon, { backgroundColor: '#F59E0B20' }]}>
                <Ionicons name="heart" size={24} color={theme.colors.error} />
              </View>
              <Text style={styles.overviewNumber}>{favorites.length}</Text>
              <Text style={styles.overviewLabel}>Favorites</Text>
            </View>

            <View style={styles.overviewItem}>
              <View style={[styles.overviewIcon, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="library" size={24} color="#10B981" />
              </View>
              <Text style={styles.overviewNumber}>{Object.keys(tagStats).length}</Text>
              <Text style={styles.overviewLabel}>Topics{'\n'}Explored</Text>
            </View>
          </View>
        </View>

        {/* Tags Section */}
        <View style={styles.tagsSection}>
          <Text style={styles.sectionTitle}>🏷️ Topics Mastery</Text>

          {sortedTags.length > 0 ? (
            sortedTags.map(([tagName, count], index) => {
              const progressPercentage = (count / maxTagCount) * 100;

              return (
                <View key={tagName} style={styles.tagItem}>
                  <View style={styles.tagHeader}>
                    <Text style={styles.tagName}>
                      {index === 0 && '🥇 '}
                      {index === 1 && '🥈 '}
                      {index === 2 && '🥉 '}
                      {tagName}
                    </Text>
                    <Text style={styles.tagCount}>{count}</Text>
                  </View>

                  <View style={styles.progressBarContainer}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${progressPercentage}%`,
                          backgroundColor: index === 0 ? '#FFD700' :
                                         index === 1 ? '#C0C0C0' :
                                         index === 2 ? '#CD7F32' :
                                         theme.colors.success,
                        }
                      ]}
                    />
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="library-outline" size={48} color={theme.colors.textSecondary} />
              </View>
              <Text style={styles.emptyTitle}>No Topics Yet</Text>
              <Text style={styles.emptyDescription}>
                Start reading articles to track your progress across different topics!
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProgressScreen;
