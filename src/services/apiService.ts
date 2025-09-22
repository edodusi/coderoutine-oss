import { Article, FirebaseArticleData } from '../types';
import { appConfig } from '../config/appConfig';
import { Platform } from 'react-native';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}

export interface ArticleListResponse {
  articles: Article[];
  count: number;
  limit: number;
  offset: number;
}

export interface TodayArticleResponse {
  article: Article;
  routineDay: string;
  fallback?: boolean;
  requestedDate: string;
}

export interface ArticleContentResponse {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  author: string;
  readingTime: number;
  wordCount: number;
  parsedAt: string;
  cached: boolean;
}

export interface CloudFunctionContentResponse {
  success: boolean;
  data: ArticleContentResponse;
}

export interface AnalyticsRequest {
  articleId: string;
  platform: string;
}

export interface AiSummaryResponse {
  summary: string;
  generatedAt: string;
  wordCount: number;
}

export interface TranslationResponse {
  translation: string;
  generatedAt: string;
  language: string;
  cached: boolean;
}

class ApiService {
  private static instance: ApiService;
  private baseUrl: string;
  private timeout: number = 10000; // 10 seconds

  private constructor() {
    // Use the configured API base URL
    this.baseUrl = appConfig.apiBaseUrl;
    this.timeout = appConfig.timeout.api;
  }

  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  /**
   * Set the base URL for the API (useful for different environments)
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
    console.log('API base URL set to:', this.baseUrl);
  }

  /**
   * Generic HTTP request method with error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      console.log(`🌐 API Request: ${options.method || 'GET'} ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Access-Token': appConfig.accessToken,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        console.error(`❌ API Error (${response.status}):`, data);
        return {
          success: false,
          error: data.error || 'Request failed',
          code: data.code || 'HTTP_ERROR',
          message: data.message
        };
      }

      console.log(`✅ API Success: ${endpoint}`);
      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error(`❌ API Request failed for ${endpoint}:`, error);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: 'Request timeout',
            code: 'TIMEOUT_ERROR'
          };
        }

        return {
          success: false,
          error: error.message,
          code: 'NETWORK_ERROR'
        };
      }

      return {
        success: false,
        error: 'Unknown error occurred',
        code: 'UNKNOWN_ERROR'
      };
    }
  }

  /**
   * GET request helper
   */
  private async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  /**
   * POST request helper
   */
  private async post<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Health check to verify API connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.get<{ status: string }>('/health');
      return response.success && response.data?.status === 'healthy';
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  /**
   * Get today's article from the API
   */
  async getTodaysArticle(): Promise<FirebaseArticleData | null> {
    try {
      console.log('🔍 Fetching today\'s article from API...');

      const response = await this.get<TodayArticleResponse>('/api/articles/today');

      if (!response.success || !response.data) {
        console.log('No article found or API error:', response.error);
        return null;
      }

      console.log('📖 Retrieved today\'s article:', response.data.article.title);

      return {
        article: response.data.article,
        routineDay: response.data.routineDay
      };

    } catch (error) {
      console.error('Error fetching today\'s article from API:', error);
      return null;
    }
  }

  /**
   * Get all articles from the API
   */
  async getAllArticles(limit: number = 50, offset: number = 0): Promise<Article[]> {
    try {
      console.log(`🔍 Fetching all articles from API (limit: ${limit}, offset: ${offset})...`);

      const endpoint = `/api/articles?limit=${limit}&offset=${offset}`;
      const response = await this.get<ArticleListResponse>(endpoint);

      if (!response.success || !response.data) {
        console.error('Failed to fetch articles:', response.error);
        return [];
      }

      console.log(`📚 Retrieved ${response.data.articles.length} articles from API`);
      return response.data.articles;

    } catch (error) {
      console.error('Error fetching all articles from API:', error);
      return [];
    }
  }

  /**
   * Get article by ID from the API
   */
  async getArticleById(articleId: string): Promise<Article | null> {
    try {
      console.log('🔍 Fetching article by ID from API:', articleId);

      const response = await this.get<{ article: Article }>(`/api/articles/${articleId}`);

      if (!response.success || !response.data) {
        console.log('Article not found or API error:', response.error);
        return null;
      }

      console.log('📖 Retrieved article:', response.data.article.title);
      return response.data.article;

    } catch (error) {
      console.error('Error fetching article by ID from API:', error);
      return null;
    }
  }

  /**
   * Log article read analytics to the API and increment the article's read count
   */
  async logArticleRead(articleId: string): Promise<void> {
    try {
      console.log(`📊 Logging article read to API: ${articleId}`);

      const analyticsData: AnalyticsRequest = {
        articleId,
        platform: Platform.OS
      };

      const response = await this.post<{ success: boolean }>('/api/analytics/read', analyticsData);

      if (!response.success) {
        console.error('Failed to log analytics:', response.error);
        // Don't throw error for analytics - it's not critical
        return;
      }

      console.log('✅ Article read logged and count updated successfully');

    } catch (error) {
      console.error('Error logging article read to API:', error);
      // Don't throw error for analytics - it's not critical
    }
  }

  /**
   * Log article like count +1 (endpoint is '/api/articles/:id/vote')
   * Vote type can be 'upvote', 'downvote', 'removeUpvote', 'removeDownvote'
   */
  async logArticleLike(articleId: string): Promise<void> {
    try {
      console.log(`📊 Logging article upvote to API: ${articleId}`);

      const response = await this.post<{ success: boolean }>(`/api/articles/${articleId}/vote`, { voteType: 'upvote' });

      if (!response.success) {
        console.error('Failed to log article upvote:', response.error);
        // Don't throw error for analytics - it's not critical
        return;
      }

      console.log('✅ Article upvote logged and count updated successfully');

    } catch (error) {
      console.error('Error logging article upvote to API:', error);
      // Don't throw error for analytics - it's not critical
    }
  }

  /**
   * Log article dislike count +1 (endpoint is '/api/articles/:id/vote')
   */
  async logArticleDislike(articleId: string): Promise<void> {
    try {
      console.log(`📊 Logging article dislike to API: ${articleId}`);

      const response = await this.post<{ success: boolean }>(`/api/articles/${articleId}/vote`, { voteType: 'downvote' });

      if (!response.success) {
        console.error('Failed to log article dislike:', response.error);
        // Don't throw error for analytics - it's not critical
        return;
      }

      console.log('✅ Article dislike logged and count updated successfully');

    } catch (error) {
      console.error('Error logging article dislike to API:', error);
      // Don't throw error for analytics - it's not critical
    }
  }

  /**
   * Remove article like
   */
   async removeArticleLike(articleId: string): Promise<void> {
    try {
      console.log(`📊 Removing article like from API: ${articleId}`);

      const response = await this.post<{ success: boolean }>(`/api/articles/${articleId}/vote`, { voteType: 'removeUpvote' });

      if (!response.success) {
        console.error('Failed to remove article like:', response.error);
        // Don't throw error for analytics - it's not critical
        return;
      }

      console.log('✅ Article like removed successfully');

    } catch (error) {
      console.error('Error removing article like from API:', error);
      // Don't throw error for analytics - it's not critical
    }
  }

  /**
   * Remove article dislike
   */
   async removeArticleDislike(articleId: string): Promise<void> {
    try {
      console.log(`📊 Removing article dislike from API: ${articleId}`);

      const response = await this.post<{ success: boolean }>(`/api/articles/${articleId}/vote`, { voteType: 'removeDownvote' });

      if (!response.success) {
        console.error('Failed to remove article dislike:', response.error);
        // Don't throw error for analytics - it's not critical
        return;
      }

      console.log('✅ Article dislike removed successfully');

    } catch (error) {
      console.error('Error removing article dislike from API:', error);
      // Don't throw error for analytics - it's not critical
    }
  }

  /**
   * Get parsed article content from the API
   */
  async getArticleContent(articleId: string): Promise<{
    success: boolean;
    content?: string;
    title?: string;
    excerpt?: string;
    author?: string;
    readingTime?: number;
    wordCount?: number;
    cached?: boolean;
    error?: string;
  }> {
    try {
      console.log(`🔍 Fetching content for article: ${articleId}`);

      const response = await this.get<any>(`/api/articles/${articleId}/content`);

      if (!response.success || !response.data) {
        console.error('Failed to fetch article content:', response.error);
        return {
          success: false,
          error: response.error || 'Failed to fetch content'
        };
      }

      // Cloud function returns { success: true, data: ArticleContentResponse }
      // ApiService wraps it in { success: true, data: cloudFunctionResponse }
      // @ts-ignore - Cloud function response structure
      const cloudFunctionResponse = response.data;

      // @ts-ignore - Cloud function response structure
      if (!cloudFunctionResponse || !cloudFunctionResponse.data) {
        console.error('Invalid cloud function response structure');
        return {
          success: false,
          error: 'Invalid response structure'
        };
      }

      // @ts-ignore - Cloud function response structure
      const contentData = cloudFunctionResponse.data;
      console.log(`📖 Retrieved article content: ${contentData.title} (${contentData.wordCount} words, ${contentData.cached ? 'cached' : 'fresh'})`);

      return {
        success: true,
        content: contentData.content,
        title: contentData.title,
        excerpt: contentData.excerpt,
        author: contentData.author,
        readingTime: contentData.readingTime,
        wordCount: contentData.wordCount,
        cached: contentData.cached
      };

    } catch (error) {
      console.error('Error fetching article content from API:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Parse article content from any URL (without storing in database)
   */
  async parseArticleFromUrl(url: string): Promise<{
    success: boolean;
    content?: string;
    title?: string;
    excerpt?: string;
    author?: string;
    readingTime?: number;
    wordCount?: number;
    error?: string;
  }> {
    try {
      console.log('🔍 Parsing article from URL via API:', url);

      const response = await this.post<{
        title: string;
        content: string;
        excerpt: string;
        author: string;
        readingTime: number;
        wordCount: number;
        url: string;
        parsedAt: string;
      }>('/api/parse', { url });

      if (!response.success || !response.data) {
        console.error('Failed to parse article:', response.error);
        return {
          success: false,
          error: response.error || 'Failed to parse article'
        };
      }

      console.log(`📖 Parsed article: ${response.data.title} (${response.data.wordCount} words)`);

      return {
        success: true,
        content: response.data.content,
        title: response.data.title,
        excerpt: response.data.excerpt,
        author: response.data.author,
        readingTime: response.data.readingTime,
        wordCount: response.data.wordCount
      };

    } catch (error) {
      console.error('Error parsing article from URL via API:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Add new article via the API (admin function)
   */
  async addArticle(article: Omit<Article, 'id'>): Promise<string | null> {
    try {
      console.log('➕ Adding new article via API:', article.title);

      const response = await this.post<{ success: boolean; articleId: string }>('/api/articles', article);

      if (!response.success || !response.data) {
        console.error('Failed to add article:', response.error);
        throw new Error(response.error || 'Failed to add article');
      }

      console.log('✅ Article added successfully via API:', response.data.articleId);
      return response.data.articleId;

    } catch (error) {
      console.error('Error adding article via API:', error);
      throw error;
    }
  }

  /**
   * Check if API is accessible and ready
   */
  async checkConnectivity(): Promise<boolean> {
    try {
      console.log('🔍 Checking API connectivity...');

      const isHealthy = await this.healthCheck();

      if (isHealthy) {
        console.log('✅ API is accessible and healthy');
        return true;
      } else {
        console.log('⚠️ API health check failed');
        return false;
      }

    } catch (error) {
      console.error('❌ API connectivity check failed:', error);
      return false;
    }
  }

  /**
   * Get API status and information
   */
  async getApiInfo(): Promise<{ isOnline: boolean; baseUrl: string; lastCheck: string }> {
    const isOnline = await this.checkConnectivity();

    return {
      isOnline,
      baseUrl: this.baseUrl,
      lastCheck: new Date().toISOString()
    };
  }

  /**
   * Get or generate AI summary for an article by ID
   */
  async getAiSummary(articleId: string): Promise<{
    success: boolean;
    summary?: string;
    generatedAt?: string;
    wordCount?: number;
    cached?: boolean;
    error?: string;
  }> {
    try {
      console.log('🤖 Requesting AI summary for article:', articleId);

      // Use specific timeout for AI summary generation
      const originalTimeout = this.timeout;
      this.timeout = appConfig.timeout.aiSummary;

      const response = await this.post<{
        success: boolean;
        data: {
          summary: string;
          generatedAt: string;
          wordCount: number;
          cached: boolean;
        };
      }>('/api/articles/generate-summary', { articleId });

      // Restore original timeout
      this.timeout = originalTimeout;

      if (!response.success || !response.data) {
        console.error('Failed to get AI summary:', response.error);
        // Restore original timeout even on error
        this.timeout = originalTimeout;
        return {
          success: false,
          error: response.error || 'Failed to generate AI summary'
        };
      }

      // Cloud function returns { success: true, data: { summary, generatedAt, wordCount, cached } }
      // ApiService wraps it in { success: true, data: cloudFunctionResponse }
      const cloudFunctionResponse = response.data;

      if (!cloudFunctionResponse || !cloudFunctionResponse.data) {
        console.error('Invalid cloud function response structure');
        this.timeout = originalTimeout;
        return {
          success: false,
          error: 'Invalid response structure'
        };
      }

      const summaryData = cloudFunctionResponse.data;
      console.log(`🤖 ${summaryData.cached ? 'Retrieved cached' : 'Generated new'} AI summary: ${summaryData.wordCount} words`);

      return {
        success: true,
        summary: summaryData.summary,
        generatedAt: summaryData.generatedAt,
        wordCount: summaryData.wordCount,
        cached: summaryData.cached
      };

    } catch (error) {
      console.error('Error getting AI summary:', error);
      // Restore original timeout even on error
      this.timeout = appConfig.timeout.api;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get or generate translation for an article AI summary
   */
  async getTranslation(articleId: string, language: string): Promise<{
    success: boolean;
    translation?: string;
    generatedAt?: string;
    language?: string;
    cached?: boolean;
    error?: string;
  }> {
    try {
      console.log(`🌐 Requesting translation for article: ${articleId}, language: ${language}`);

      // Use specific timeout for translation generation
      const originalTimeout = this.timeout;
      this.timeout = appConfig.timeout.aiSummary; // Use same timeout as AI summary

      const response = await this.post<{
        success: boolean;
        data: {
          translation: string;
          generatedAt: string;
          language: string;
          cached: boolean;
        };
      }>('/api/articles/generate-translation', { articleId, language });

      // Restore original timeout
      this.timeout = originalTimeout;

      if (!response.success || !response.data) {
        console.error('Failed to get translation:', response.error);
        this.timeout = originalTimeout;
        return {
          success: false,
          error: response.error || 'Failed to generate translation'
        };
      }

      // Cloud function returns { success: true, data: { translation, generatedAt, language, cached } }
      const cloudFunctionResponse = response.data;

      if (!cloudFunctionResponse || !cloudFunctionResponse.data) {
        console.error('Invalid cloud function response structure');
        this.timeout = originalTimeout;
        return {
          success: false,
          error: 'Invalid response structure'
        };
      }

      const translationData = cloudFunctionResponse.data;
      console.log(`🌐 ${translationData.cached ? 'Retrieved cached' : 'Generated new'} translation for ${translationData.language}`);

      return {
        success: true,
        translation: translationData.translation,
        generatedAt: translationData.generatedAt,
        language: translationData.language,
        cached: translationData.cached
      };

    } catch (error) {
      console.error('Error getting translation:', error);
      // Restore original timeout even on error
      this.timeout = appConfig.timeout.api;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }



  /**
   * Verify Google Play purchase
   */


  /**
   * Set request timeout
   */
  setTimeout(timeoutMs: number): void {
    this.timeout = timeoutMs;
    console.log('API timeout set to:', timeoutMs, 'ms');
  }
}

export const apiService = ApiService.getInstance();
export default apiService;
