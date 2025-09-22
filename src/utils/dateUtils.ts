/**
 * Date utility functions for article filtering and debugging
 */

/**
 * Get today's date in YYYY-MM-DD format (same format used in routineDay)
 */
export const getTodayString = (): string => {
  return new Date().toISOString().split('T')[0];
};

/**
 * Check if an article's routine day is today or in the past
 */
export const isArticleAvailable = (routineDay: string): boolean => {
  const today = getTodayString();
  return routineDay <= today;
};

/**
 * Get a date string for testing (useful for debugging)
 */
export const getDateString = (daysFromToday: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().split('T')[0];
};

/**
 * Format date for display in the UI
 */
export const formatDisplayDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
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

/**
 * Debug function to test date filtering logic
 */
export const testDateFiltering = () => {
  const today = getTodayString();
  const yesterday = getDateString(-1);
  const tomorrow = getDateString(1);

  console.log('🗓️ Date Filtering Test:');
  console.log(`Today: ${today} -> Available: ${isArticleAvailable(today)}`);
  console.log(`Yesterday: ${yesterday} -> Available: ${isArticleAvailable(yesterday)}`);
  console.log(`Tomorrow: ${tomorrow} -> Available: ${isArticleAvailable(tomorrow)}`);
};
