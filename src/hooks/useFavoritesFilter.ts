import { useState, useEffect, useCallback, useMemo } from 'react';
import { FavoriteArticle } from '../types';
import { useApp } from '../context/AppContext';

export interface UseFavoritesFilterResult {
  filteredFavorites: FavoriteArticle[];
  allFavorites: FavoriteArticle[];
  selectedTags: string[];
  availableTags: string[];
  setSelectedTags: (tags: string[]) => void;
  toggleTag: (tag: string) => void;
  clearTags: () => void;
  favoriteCount: number;
  filteredCount: number;
  isFiltered: boolean;
}

export const useFavoritesFilter = (): UseFavoritesFilterResult => {
  const { getFavorites } = useApp();
  const [selectedTags, setSelectedTagsState] = useState<string[]>([]);

  // Get all favorites from the app context
  const allFavorites = getFavorites();

  // Extract all unique tags from favorites
  const availableTags = useMemo(() => {
    const tagsSet = new Set<string>();
    
    allFavorites.forEach(favorite => {
      if (favorite.tags && Array.isArray(favorite.tags)) {
        favorite.tags.forEach(tag => {
          if (tag && tag.trim()) {
            tagsSet.add(tag.trim());
          }
        });
      }
    });

    return Array.from(tagsSet).sort();
  }, [allFavorites]);

  // Filter favorites based on selected tags
  const filteredFavorites = useMemo(() => {
    if (selectedTags.length === 0) {
      return allFavorites;
    }

    return allFavorites.filter(favorite => {
      if (!favorite.tags || !Array.isArray(favorite.tags)) {
        return false;
      }

      // Check if favorite has all of the selected tags (AND operation)
      return selectedTags.every(selectedTag =>
        favorite.tags!.includes(selectedTag)
      );
    });
  }, [allFavorites, selectedTags]);

  const setSelectedTags = useCallback((tags: string[]) => {
    console.log(`🏷️ useFavoritesFilter: Setting selected tags to: [${tags.join(', ')}]`);
    setSelectedTagsState(tags);
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTagsState(prev => {
      const isSelected = prev.includes(tag);
      const newTags = isSelected 
        ? prev.filter(t => t !== tag)
        : [...prev, tag];
      
      console.log(`🏷️ useFavoritesFilter: ${isSelected ? 'Removing' : 'Adding'} tag: ${tag}`);
      return newTags;
    });
  }, []);

  const clearTags = useCallback(() => {
    console.log('🏷️ useFavoritesFilter: Clearing all selected tags');
    setSelectedTagsState([]);
  }, []);

  const favoriteCount = allFavorites.length;
  const filteredCount = filteredFavorites.length;
  const isFiltered = selectedTags.length > 0;

  return {
    filteredFavorites,
    allFavorites,
    selectedTags,
    availableTags,
    setSelectedTags,
    toggleTag,
    clearTags,
    favoriteCount,
    filteredCount,
    isFiltered,
  };
};