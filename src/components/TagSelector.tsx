import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface TagSelectorProps {
  availableTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onClearTags: () => void;
  loading?: boolean;
  maxVisibleTags?: number;
  collapsibleRows?: number;
}

const TagSelector: React.FC<TagSelectorProps> = ({
  availableTags,
  selectedTags,
  onToggleTag,
  onClearTags,
  loading = false,
  maxVisibleTags = 8,
  collapsibleRows = 2,
}) => {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  // Reset expansion when tags change
  React.useEffect(() => {
    setIsExpanded(false);
  }, [availableTags.length]);

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      elevation: 2,
      shadowOpacity: 0.1,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      flex: 1,
    },
    clearButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    clearButtonDisabled: {
      opacity: 0.5,
    },
    clearButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.primary,
      marginLeft: 4,
    },
    selectedInfo: {
      marginBottom: 12,
    },
    selectedText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    selectedCount: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    tagsContainer: {
      // Dynamic height based on expanded state
    },
    tagsScrollView: {
      flexGrow: 0,
    },
    tagsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
    },
    tag: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 28,
    },
    tagSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    tagText: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.colors.text,
      marginRight: 2,
    },
    tagTextSelected: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
    tagIcon: {
      marginLeft: 1,
    },
    expandButton: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 28,
    },
    expandButtonText: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.colors.primary,
      marginRight: 2,
    },
    loadingContainer: {
      paddingVertical: 20,
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 8,
      fontStyle: 'italic',
    },
    emptyContainer: {
      paddingVertical: 20,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });

  // Calculate how many tags to show based on collapsed/expanded state
  const calculateTagsPerRow = () => {
    // Estimate based on average tag width and screen width
    // This is a rough estimate - in a real app you might measure actual widths
    return 5; // Average tags per row with smaller tags
  };

  const tagsPerRow = calculateTagsPerRow();
  const maxCollapsedTags = collapsibleRows * tagsPerRow;

  const displayTags = isExpanded
    ? availableTags
    : availableTags.slice(0, maxCollapsedTags);

  const hasMoreTags = availableTags.length > maxCollapsedTags;

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Filter by Topics</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading topics...</Text>
        </View>
      </View>
    );
  }

  if (availableTags.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Filter by Topics</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No topics available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Filter by Topics</Text>

        <TouchableOpacity
          style={[
            styles.clearButton,
            selectedTags.length === 0 && styles.clearButtonDisabled
          ]}
          onPress={onClearTags}
          disabled={selectedTags.length === 0}
          activeOpacity={0.7}
        >
          <Ionicons
            name="refresh-outline"
            size={16}
            color={selectedTags.length > 0 ? theme.colors.primary : theme.colors.textSecondary}
          />
          <Text style={styles.clearButtonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {selectedTags.length > 0 && (
        <View style={styles.selectedInfo}>
          <Text style={styles.selectedText}>
            <Text style={styles.selectedCount}>{selectedTags.length}</Text> topic{selectedTags.length !== 1 ? 's' : ''} selected
            {selectedTags.length > 1 && (
              <Text style={[styles.selectedText, { fontStyle: 'italic' }]}> (showing articles with all topics)</Text>
            )}
          </Text>
        </View>
      )}

      <View style={styles.tagsContainer}>
        <View style={styles.tagsGrid}>
          {displayTags.map((tag) => {
            const isSelected = selectedTags.includes(tag);

            return (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.tag,
                  isSelected && styles.tagSelected
                ]}
                onPress={() => onToggleTag(tag)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.tagText,
                  isSelected && styles.tagTextSelected
                ]}>
                  {tag}
                </Text>
                {isSelected && (
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color="#FFFFFF"
                    style={styles.tagIcon}
                  />
                )}
              </TouchableOpacity>
            );
          })}

          {hasMoreTags && !isExpanded && (
            <TouchableOpacity
              style={styles.expandButton}
              onPress={() => setIsExpanded(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.expandButtonText}>
                +{availableTags.length - maxCollapsedTags} more
              </Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
          )}

          {isExpanded && hasMoreTags && (
            <TouchableOpacity
              style={styles.expandButton}
              onPress={() => setIsExpanded(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.expandButtonText}>
                Show less
              </Text>
              <Ionicons
                name="chevron-up"
                size={14}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

export default TagSelector;
