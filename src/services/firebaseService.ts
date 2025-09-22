import firestore from '@react-native-firebase/firestore';
import { Article, FirebaseArticleData } from '../types';
import { firebaseApp } from './firebaseApp';
import { Platform } from 'react-native';
import { apiService } from './apiService';
import { getTodayString } from '../utils/dateUtils';
import { getUniqueDeviceId } from '../utils/deviceId';
import { storageService } from './storageService';

export interface BetaUserData {
  appId: string;
  firstStartupTimestamp: number;
  subscriptionStatus: 'free' | 'premium' | 'beta';
  subscriptionStart?: number;
  subscriptionEnd?: number;
  userName?: string;
  betaStatus: number; // 0 = not beta, 1 = beta active
}

class FirebaseService {
  private static instance: FirebaseService;

  private constructor() {}

  static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }

  /**
   * Get the unique device ID for this installation
   */
  private async getDeviceId(): Promise<string> {
    return await getUniqueDeviceId();
  }

  /**
   * Initialize Firebase service
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('Initializing Firebase service with React Native Firebase SDK...');
      console.log('✅ Firebase service initialized successfully (React Native Firebase)');
      return true;
    } catch (error) {
      console.error('Error initializing Firebase service:', error);
      firebaseApp.logError('FirebaseService initialization failed', error);
      return false;
    }
  }

  /**
   * Helper function to convert Firestore document to Article
   */
  private documentToArticle(doc: any): Article {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title,
      url: data.url,
      description: data.description,
      routineDay: data.routineDay,
      estimatedReadTime: data.estimatedReadTime,
      source: data.source,
      tags: data.tags || [],
      author: data.content.author || data.author,
      needsJavascript: data.needsJavascript,
      readCount: data.readCount || 0,
      likeCount: data.likeCount || 0,
      dislikeCount: data.dislikeCount || 0,
      podcastUrl: data.podcastUrl,
      podcastStatus: data.podcastStatus,
    };
  }

  /**
   * Fetches today's article using React Native Firebase operations
   *
   * Migrated from Cloud Function endpoint: /api/articles/today
   *
   * ARCHITECTURE NOTE: All date logic is handled by the app now.
   * The app determines today's date in UTC (YYYY-MM-DD format) and:
   * 1. Queries Firestore for articles with routineDay === today
   * 2. Returns the matching article or falls back to most recent
   */
  async getTodaysArticle(): Promise<FirebaseArticleData | null> {
    try {
      console.log('🔍 Fetching today\'s article via React Native Firebase...');

      // Get today's date in YYYY-MM-DD format (UTC) with dev offset if in dev mode
      let targetDate = new Date();
      
      if (__DEV__) {
        const devDayOffset = await storageService.getDevDayOffset();
        if (devDayOffset !== 0) {
          targetDate.setDate(targetDate.getDate() + devDayOffset);
          console.log(`🔧 DEV MODE: Using day offset ${devDayOffset}`);
        }
      }
      
      const today = targetDate.toISOString().split('T')[0];
      console.log('Looking for article with routineDay:', today);

      const articlesRef = firestore().collection('articles');

      // Try routineDay first
      const todayQuery = articlesRef
        .where('isActive', '==', true)
        .where('routineDay', '==', today)
        .limit(1);

      const todaySnapshot = await todayQuery.get();

      if (!todaySnapshot.empty) {
        const doc = todaySnapshot.docs[0];
        const article = this.documentToArticle(doc);

        console.log('📖 Retrieved today\'s article:', article.title, 'for date:', today);

        return {
          article,
          routineDay: article.routineDay
        };
      }

      // Fallback to most recent article
      console.log(`No article found with routineDay=${today}, falling back to most recent`);

      const fallbackQuery = articlesRef
        .where('isActive', '==', true)
        .orderBy('routineDay', 'desc')
        .limit(1);

      const fallbackSnapshot = await fallbackQuery.get();

      if (fallbackSnapshot.empty) {
        console.log('No active articles found');
        return null;
      }

      const doc = fallbackSnapshot.docs[0];
      const article = this.documentToArticle(doc);

      console.log('📖 Retrieved fallback article:', article.title, 'published on:', article.routineDay);

      return {
        article,
        routineDay: article.routineDay
      };

    } catch (error) {
      console.error('Error fetching today\'s article via React Native Firebase:', error);
      firebaseApp.logError('Failed to fetch today\'s article', error);
      return null;
    }
  }

  /**
   * Checks if a new article is available
   */
  async checkForNewArticle(): Promise<boolean> {
    try {
      const article = await this.getTodaysArticle();
      return article !== null;
    } catch (error) {
      console.error('Error checking for new article:', error);
      firebaseApp.logError('Failed to check for new article', error);
      return false;
    }
  }

  /**
   * Gets all available articles using React Native Firebase operations
   *
   * Migrated from Cloud Function endpoint: /api/articles
   */
  async getAllArticles(limitCount: number = 20, lastDocId: string | null = null): Promise<{
    articles: Article[];
    hasNextPage: boolean;
    nextCursor: string | null;
  }> {
    try {
      console.log(`🔍 Fetching all articles via Firebase (limit: ${limitCount}, lastDocId: ${lastDocId || 'null'})...`);

      const articlesRef = firestore().collection('articles');
      const today = getTodayString();

      let articlesQuery = articlesRef
        .where('isActive', '==', true)
        .where('routineDay', '<=', today)
        .orderBy('routineDay', 'desc');

      // If we have a cursor (lastDocId), start after that document
      if (lastDocId) {
        const lastDocRef = await articlesRef.doc(lastDocId).get();
        if (lastDocRef.exists()) {
          articlesQuery = articlesQuery.startAfter(lastDocRef);
        }
      }

      // Request one extra document to check if there are more pages
      const querySnapshot = await articlesQuery.limit(limitCount + 1).get();
      const articles: Article[] = [];
      const docs = querySnapshot.docs;

      // Check if we have more documents than requested
      let hasNextPage = false;
      let nextCursor: string | null = null;

      if (docs.length > limitCount) {
        hasNextPage = true;
        docs.pop(); // Remove the extra document
      }

      // Convert documents to articles
      docs.forEach((doc) => {
        articles.push(this.documentToArticle(doc));
      });

      // Create cursor for next page if there are more results
      if (hasNextPage && articles.length > 0) {
        nextCursor = articles[articles.length - 1].id;
      }

      console.log(`📚 Retrieved ${articles.length} articles via Firebase, hasNextPage: ${hasNextPage}`);

      return {
        articles,
        hasNextPage,
        nextCursor,
      };

    } catch (error) {
      console.error('Error fetching all articles via Firebase:', error);
      firebaseApp.logError('Failed to fetch all articles', error);
      return {
        articles: [],
        hasNextPage: false,
        nextCursor: null,
      };
    }
  }

  /**
   * Get article by ID using React Native Firebase operations
   *
   * Migrated from Cloud Function endpoint: /api/articles/:id
   */
  async getArticleById(articleId: string): Promise<Article | null> {
    try {
      console.log('🔍 Fetching article by ID via React Native Firebase:', articleId);

      const docRef = firestore().collection('articles').doc(articleId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        console.log('Article not found:', articleId);
        return null;
      }

      const article = this.documentToArticle(docSnap);
      console.log('📖 Retrieved article:', article.title);
      return article;

    } catch (error) {
      console.error('Error fetching article by ID via React Native Firebase:', error);
      firebaseApp.logError('Failed to fetch article by ID', error);
      return null;
    }
  }

  /**
   * Logs article read analytics using React Native Firebase operations and increments the article's read count
   *
   * Migrated from Cloud Function endpoint: /api/analytics/read
   */
  async logArticleRead(articleId: string): Promise<void> {
    try {
      console.log(`📊 Logging article read via React Native Firebase: ${articleId}`);

      // Use batch write for better performance and atomicity
      const batch = firestore().batch();

      // Log analytics data
      const analyticsRef = firestore().collection('analytics');
      const newAnalyticsDoc = analyticsRef.doc();
      batch.set(newAnalyticsDoc, {
        articleId: articleId,
        platform: Platform.OS,
        timestamp: firestore.FieldValue.serverTimestamp(),
        userAgent: 'React Native App',
      });

      // Update article read count
      const articleRef = firestore().collection('articles').doc(articleId);
      batch.update(articleRef, {
        readCount: firestore.FieldValue.increment(1)
      });

      // Execute batch write
      await batch.commit();
      console.log('✅ Article read logged and count updated successfully via Firebase');

    } catch (error) {
      console.error('Error logging article read via React Native Firebase:', error);
      firebaseApp.logError('Failed to log article read analytics', error);
      // Don't throw error for analytics - it's not critical
    }
  }

  /**
   * Log article like using React Native Firebase operations
   *
   * Migrated from Cloud Function endpoint: /api/articles/:articleId/vote
   */
  async logArticleLike(articleId: string): Promise<void> {
    try {
      console.log(`📊 Logging article like via React Native Firebase: ${articleId}`);

      const articleRef = firestore().collection('articles').doc(articleId);
      await articleRef.update({
        likeCount: firestore.FieldValue.increment(1)
      });
      console.log('✅ Article like logged and count updated successfully via Firebase');

    } catch (error) {
      console.error('Error logging article like via React Native Firebase:', error);
      firebaseApp.logError('Failed to log article like analytics', error);
      // Don't throw error for analytics - it's not critical
    }
  }

  /**
   * Log article dislike using React Native Firebase operations
   *
   * Migrated from Cloud Function endpoint: /api/articles/:articleId/vote
   */
  async logArticleDislike(articleId: string): Promise<void> {
    try {
      console.log(`📊 Logging article dislike via React Native Firebase: ${articleId}`);

      const articleRef = firestore().collection('articles').doc(articleId);
      await articleRef.update({
        dislikeCount: firestore.FieldValue.increment(1)
      });
      console.log('✅ Article dislike logged and count updated successfully via Firebase');

    } catch (error) {
      console.error('Error logging article dislike via React Native Firebase:', error);
      firebaseApp.logError('Failed to log article dislike analytics', error);
      // Don't throw error for analytics - it's not critical
    }
  }

  /**
   * Remove article like using React Native Firebase operations
   *
   * Migrated from Cloud Function endpoint: /api/articles/:articleId/vote
   */
  async removeArticleLike(articleId: string): Promise<void> {
    try {
      console.log(`📊 Removing article like via React Native Firebase: ${articleId}`);

      const articleRef = firestore().collection('articles').doc(articleId);

      // Use transaction to safely decrement only if count > 0
      await firestore().runTransaction(async (transaction) => {
        const articleDoc = await transaction.get(articleRef);

        if (articleDoc.exists()) {
          const data = articleDoc.data();
          const currentLikeCount = data?.likeCount || 0;

          if (currentLikeCount > 0) {
            transaction.update(articleRef, {
              likeCount: firestore.FieldValue.increment(-1)
            });
          }
        }
      });

      console.log('✅ Article like removed and count updated successfully via Firebase');

    } catch (error) {
      console.error('Error removing article like via React Native Firebase:', error);
      firebaseApp.logError('Failed to remove article like', error);
      // Don't throw error for analytics - it's not critical
    }
  }

  /**
   * Remove article dislike using React Native Firebase operations
   *
   * Migrated from Cloud Function endpoint: /api/articles/:articleId/vote
   */
  async removeArticleDislike(articleId: string): Promise<void> {
    try {
      console.log(`📊 Removing article dislike via React Native Firebase: ${articleId}`);

      const articleRef = firestore().collection('articles').doc(articleId);

      // Use transaction to safely decrement only if count > 0
      await firestore().runTransaction(async (transaction) => {
        const articleDoc = await transaction.get(articleRef);

        if (articleDoc.exists()) {
          const data = articleDoc.data();
          const currentDislikeCount = data?.dislikeCount || 0;

          if (currentDislikeCount > 0) {
            transaction.update(articleRef, {
              dislikeCount: firestore.FieldValue.increment(-1)
            });
          }
        }
      });

      console.log('✅ Article dislike removed and count updated successfully via Firebase');

    } catch (error) {
      console.error('Error removing article dislike via React Native Firebase:', error);
      firebaseApp.logError('Failed to remove article dislike', error);
      // Don't throw error for analytics - it's not critical
    }
  }

  /**
   * Update user preferences (local storage for now)
   */
  async updateUserPreferences(preferences: Record<string, any>): Promise<void> {
    try {
      console.log('User preferences updated:', preferences);
      // TODO: Could implement user preferences storage when authentication is added
      // For now, this could be stored locally or ignored
    } catch (error) {
      console.error('Error updating user preferences:', error);
      firebaseApp.logError('Failed to update user preferences', error);
    }
  }

  /**
   * Get React Native Firebase status and connectivity information
   */
  async getApiStatus(): Promise<{ isOnline: boolean; baseUrl: string; lastCheck: string }> {
    try {
      // Test basic connectivity by attempting to read a small document
      const testRef = firestore().collection('test').doc('connectivity');
      await testRef.get(); // This will throw if there's no connectivity

      return {
        isOnline: true,
        baseUrl: 'React Native Firebase (Direct)',
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error testing React Native Firebase connection:', error);
      firebaseApp.logError('React Native Firebase connection test failed', error);
      return {
        isOnline: false,
        baseUrl: 'React Native Firebase (Direct)',
        lastCheck: new Date().toISOString()
      };
    }
  }

  /**
   * Get AI Summary for an article - checks Firestore cache first, then generates via API
   *
   * Optimized flow: Firestore SDK (fast) → API fallback (generates + caches)
   */
  async getAiSummary(articleId: string): Promise<{ success: boolean; summary?: string; generatedAt?: string; wordCount?: number; cached?: boolean; error?: string }> {
    try {
      console.log('🔍 Checking Firestore for cached AI summary...');

      // First, try to get AI summary directly from Firestore using Firebase SDK
      const articleRef = firestore().collection('articles').doc(articleId);
      const articleDoc = await articleRef.get();

      if (articleDoc.exists()) {
        const articleData = articleDoc.data();

        // Check if AI summary exists and is not empty
        if (articleData?.aiSummary?.summary) {
          console.log('✅ Found cached AI summary in Firestore');

          return {
            success: true,
            summary: articleData.aiSummary.summary,
            generatedAt: articleData.aiSummary.generatedAt || new Date().toISOString(),
            wordCount: articleData.aiSummary.wordCount || 0,
            cached: true
          };
        }
      }

      // If no cached summary found, generate new one via API
      console.log('💡 No cached summary found, generating new AI summary via API...');

      const result = await apiService.getAiSummary(articleId);
      return result;

    } catch (error) {
      console.error('Error fetching AI summary via Firebase SDK:', error);
      firebaseApp.logError('Failed to fetch AI summary', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get AI Translation for an article - checks Firestore cache first, then generates via API
   *
   * Optimized flow: Firestore SDK (fast) → API fallback (generates + caches)
   */
  async getTranslation(articleId: string, language: string): Promise<{ success: boolean; translation?: string; generatedAt?: string; language?: string; cached?: boolean; error?: string }> {
    try {
      console.log(`🔍 Checking Firestore for cached AI translation (${language})...`);

      // First, try to get AI translation directly from Firestore using Firebase SDK
      const articleRef = firestore().collection('articles').doc(articleId);
      const articleDoc = await articleRef.get();

      if (articleDoc.exists()) {
        const articleData = articleDoc.data();

        // Check if AI translation exists for the requested language
        if (articleData?.aiTranslation?.[language]?.translation) {
          console.log(`✅ Found cached AI translation in Firestore (${language})`);

          return {
            success: true,
            translation: articleData.aiTranslation[language].translation,
            generatedAt: articleData.aiTranslation[language].generatedAt || new Date().toISOString(),
            language: articleData.aiTranslation[language].language || language,
            cached: true
          };
        }
      }

      // If no cached translation found, generate new one via API
      console.log(`💡 No cached translation found, generating new AI translation via API (${language})...`);

      const result = await apiService.getTranslation(articleId, language);
      return result;

    } catch (error) {
      console.error('Error fetching AI translation via Firebase SDK:', error);
      firebaseApp.logError('Failed to fetch AI translation', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get cached article content directly from Firestore
   * Falls back to API if no cached content exists
   */
  async getArticleContent(articleId: string): Promise<{
    success: boolean;
    title?: string;
    excerpt?: string;
    author?: string;
    readingTime?: number;
    wordCount?: number;
    cached?: boolean;
    error?: string;
  }> {
    try {
      console.log(`🔍 Checking Firestore for cached article content: ${articleId}`);

      // First, try to get cached content directly from Firestore
      const articleRef = firestore().collection('articles').doc(articleId);
      const articleDoc = await articleRef.get();

      if (articleDoc.exists()) {
        const articleData = articleDoc.data();

        // Check if article content exists and is not empty
        if (articleData?.content?.html) {
          console.log('✅ Found cached article content in Firestore');

          return {
            success: true,
            title: articleData.title,
            excerpt: articleData.content.excerpt,
            author: articleData.content.author || articleData.author,
            readingTime: articleData.content.readingTime || articleData.estimatedReadTime,
            wordCount: articleData.content.wordCount,
            cached: true
          };
        }
      }

      // If no cached content found, fall back to API
      console.log('💡 No cached content found, fetching via API...');
      const result = await apiService.getArticleContent(articleId);
      return result;

    } catch (error) {
      console.error('Error fetching article content via Firebase SDK:', error);
      firebaseApp.logError('Failed to fetch article content', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get all unique tags from articles
   */
  async getAllTags(): Promise<string[]> {
    try {
      console.log('🏷️ Fetching all unique tags from articles...');

      const articlesRef = firestore().collection('articles');
      const today = getTodayString();

      const querySnapshot = await articlesRef
        .where('isActive', '==', true)
        .where('routineDay', '<=', today)
        .get();

      const tagsSet = new Set<string>();

      querySnapshot.forEach((doc) => {
        const articleData = doc.data();
        if (articleData.tags && Array.isArray(articleData.tags)) {
          articleData.tags.forEach((tag: string) => {
            if (tag && tag.trim()) {
              tagsSet.add(tag.trim());
            }
          });
        }
      });

      const uniqueTags = Array.from(tagsSet).sort();
      console.log(`🏷️ Found ${uniqueTags.length} unique tags:`, uniqueTags);

      return uniqueTags;

    } catch (error) {
      console.error('Error fetching tags from Firebase:', error);
      firebaseApp.logError('Failed to fetch tags', error);
      return [];
    }
  }

  /**
   * Get articles filtered by tags with pagination
   */
  async getArticlesByTags(
    selectedTags: string[],
    limitCount: number = 20,
    lastDocId: string | null = null
  ): Promise<{
    articles: Article[];
    hasNextPage: boolean;
    nextCursor: string | null;
  }> {
    try {
      console.log(`🔍 Fetching articles with tags: [${selectedTags.join(', ')}], limit: ${limitCount}, lastDocId: ${lastDocId || 'null'}`);

      if (selectedTags.length === 0) {
        // If no tags selected, return all articles
        return this.getAllArticles(limitCount, lastDocId);
      }

      const articlesRef = firestore().collection('articles');
      const today = getTodayString();

      // Use a much simpler approach - just query by active status first
      // Then filter by tags and date in memory to avoid complex Firestore indexes
      let baseQuery = articlesRef.where('isActive', '==', true);

      // For small to medium datasets, get all active articles and filter in memory
      // This avoids the need for complex composite indexes
      const querySnapshot = await baseQuery.get();

      // Filter articles by tags and date in memory
      const filteredArticles: Article[] = [];

      querySnapshot.forEach((doc) => {
        const articleData = doc.data();

        // Check if article has any of the selected tags
        const articleTags = articleData.tags || [];
        const hasMatchingTag = selectedTags.some(selectedTag =>
          articleTags.includes(selectedTag)
        );

        // Filter by routineDay <= today and matching tags
        if (hasMatchingTag &&
            articleData.routineDay &&
            articleData.routineDay <= today) {
          filteredArticles.push(this.documentToArticle(doc));
        }
      });

      // Sort by routineDay descending
      filteredArticles.sort((a, b) => b.routineDay.localeCompare(a.routineDay));

      // Apply cursor-based pagination in memory
      let startIndex = 0;
      if (lastDocId) {
        const lastDocIndex = filteredArticles.findIndex(article => article.id === lastDocId);
        if (lastDocIndex !== -1) {
          startIndex = lastDocIndex + 1;
        }
      }

      // Get the requested page
      const articles = filteredArticles.slice(startIndex, startIndex + limitCount);
      const hasNextPage = startIndex + limitCount < filteredArticles.length;
      const nextCursor = hasNextPage && articles.length > 0 ? articles[articles.length - 1].id : null;

      console.log(`📚 Retrieved ${articles.length} articles with selected tags (filtered from ${filteredArticles.length} matching articles), hasNextPage: ${hasNextPage}`);

      return {
        articles,
        hasNextPage,
        nextCursor,
      };

    } catch (error) {
      console.error('Error fetching articles by tags from Firebase:', error);
      firebaseApp.logError('Failed to fetch articles by tags', error);
      return {
        articles: [],
        hasNextPage: false,
        nextCursor: null,
      };
    }
  }

  /**
   * Get beta user data by app ID
   */
  async getBetaUserData(appId?: string): Promise<BetaUserData | null> {
    try {
      const targetAppId = appId || await this.getDeviceId();
      console.log('🔍 Fetching beta user data for app ID:', targetAppId);

      const userDocRef = firestore().collection('beta_users').doc(targetAppId);
      const userDoc = await userDocRef.get();

      if (userDoc.exists()) {
        const userData = userDoc.data() as BetaUserData;
        console.log('📥 Found beta user data:', {
          betaStatus: userData.betaStatus,
          appId: targetAppId
        });
        return userData;
      } else {
        console.log('📭 No beta user data found for app ID:', targetAppId);
        return null;
      }
    } catch (error) {
      console.error('Error fetching beta user data:', error);

      // Check if it's a permission error
      if (error instanceof Error && error.message.includes('permission-denied')) {
        console.warn('⚠️ Firestore read permission denied for beta_users collection');
        return null; // Return null instead of throwing
      }

      firebaseApp.logError('Failed to fetch beta user data', error);
      return null;
    }
  }

  /**
   * Create or update beta user data
   */
  async createOrUpdateBetaUser(betaData: Partial<BetaUserData>, appId?: string): Promise<boolean> {
    try {
      const targetAppId = appId || await this.getDeviceId();
      console.log('💾 Creating/updating beta user data for app ID:', targetAppId);

      const userDocRef = firestore().collection('beta_users').doc(targetAppId);

      // First, try to get existing document
      const existingDoc = await userDocRef.get();

      if (existingDoc.exists()) {
        // Document exists, update only the fields we want to update
        const updateData: Partial<BetaUserData> = {
          ...betaData,
          appId: targetAppId, // Always ensure appId is correct
        };

        // Remove undefined values
        Object.keys(updateData).forEach(key => {
          if (updateData[key as keyof BetaUserData] === undefined) {
            delete updateData[key as keyof BetaUserData];
          }
        });

        await userDocRef.set(updateData, { merge: true });
        console.log('🔄 Updated existing beta user record');
      } else {
        // Document doesn't exist, create new one with required fields
        const newUserData: BetaUserData = {
          appId: targetAppId,
          firstStartupTimestamp: Date.now(),
          subscriptionStatus: 'free',
          betaStatus: 0,
          ...betaData, // Override with any provided data
        };

        await userDocRef.set({
          ...newUserData,
          firstStartupTimestamp: firestore.FieldValue.serverTimestamp(), // Use server timestamp for consistency
        });
        console.log('✨ Created new beta user record');
      }

      return true;
    } catch (error) {
      console.error('Error creating/updating beta user data:', error);

      // Check if it's a permission error
      if (error instanceof Error && error.message.includes('permission-denied')) {
        console.warn('⚠️ Firestore write permission denied for beta_users collection - this is expected without proper rules');
        return false; // Return false instead of throwing
      }

      firebaseApp.logError('Failed to create/update beta user data', error);
      return false;
    }
  }

  /**
   * Get beta status for current app
   */
  async getBetaStatus(appId?: string): Promise<number> {
    try {
      const userData = await this.getBetaUserData(appId);
      return userData?.betaStatus || 0;
    } catch (error) {
      console.error('Error fetching beta status:', error);
      firebaseApp.logError('Failed to fetch beta status', error);
      return 0;
    }
  }

  /**
   * Update subscription analytics for beta user
   */
  async updateBetaUserSubscriptionAnalytics(data: {
    subscriptionStatus: 'free' | 'premium' | 'beta';
    subscriptionStart?: number;
    subscriptionEnd?: number;
  }, appId?: string): Promise<boolean> {
    try {
      console.log('📊 Updating beta user subscription analytics');
      return await this.createOrUpdateBetaUser(data, appId);
    } catch (error) {
      // Check if it's a permission error
      if (error instanceof Error && error.message.includes('permission-denied')) {
        console.warn('⚠️ Analytics update permission denied - this is expected without proper Firestore rules');
        return false; // Return false instead of throwing
      }

      console.error('Error updating beta user subscription analytics:', error);
      firebaseApp.logError('Failed to update beta user subscription analytics', error);
      return false;
    }
  }
}

export const firebaseService = FirebaseService.getInstance();
export default firebaseService;
