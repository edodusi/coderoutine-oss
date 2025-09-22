/**
 * Hooks index file
 * 
 * This file exports all custom hooks for easier importing throughout the app.
 */

export { useSubscription } from './useSubscription';
export { useArticles, useHomeArticles } from './useArticles';
export { useTaggedArticles } from './useTaggedArticles';
export { useFavoritesFilter } from './useFavoritesFilter';
export { usePremiumAccess } from './usePremiumAccess';

// Type exports
export type { UseSubscriptionReturn } from './useSubscription';
export type { UseArticlesResult } from './useArticles';
export type { UseTaggedArticlesResult } from './useTaggedArticles';
export type { UseFavoritesFilterResult } from './useFavoritesFilter';