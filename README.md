# CodeRoutine - Open Source

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-1.0.0-blue.svg?cacheSeconds=2592000" />
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
  <img alt="React Native" src="https://img.shields.io/badge/react_native-%2320232a.svg?style=flat&logo=react&logoColor=%2361DAFB" />
  <img alt="TypeScript" src="https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white" />
  <img alt="Expo" src="https://img.shields.io/badge/expo-1C1E24?style=flat&logo=expo&logoColor=#D04A37" />
</p>

> A beautifully crafted React Native app for building daily coding routines with articles, progress tracking, and community features.

## 🚀 Try It Now

<p align="center">
  <a href="https://play.google.com/store/apps/details?id=com.edodusi.coderoutine">
    <img alt="Get it on Google Play" src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" width="200"/>
  </a>
</p>

<p align="center">
  <strong>Download and try the live version of this app!</strong>
</p>

## ✨ Features

- **📚 Daily Articles**: Curated coding articles delivered daily
- **📊 Progress Tracking**: Track reading streaks and learning progress
- **🔥 Reading Streaks**: Gamified learning experience
- **🌙 Dark/Light Theme**: Beautiful adaptive themes
- **📱 Offline Reading**: Read articles without internet connection
- **🔔 Push Notifications**: Stay notified about new content
- **🎧 Podcast Mode**: AI-generated audio versions of articles
- **🌍 Multi-language**: Support for multiple languages
- **⭐ Favorites**: Save articles for later reading
- **📈 Analytics**: Track your learning journey
- **💾 Local Storage**: All data stored locally with optional cloud sync
- **🔒 Privacy-First**: Your data stays on your device

## 📱 Screenshots

<p align="center">
  <img src="docs/CodeRoutine-8.png" width="200" alt="CodeRoutine Screenshot 8"/>
  <img src="docs/CodeRoutine-9.png" width="200" alt="CodeRoutine Screenshot 9"/>
  <img src="docs/CodeRoutine-10.png" width="200" alt="CodeRoutine Screenshot 10"/>
  <img src="docs/CodeRoutine-11.png" width="200" alt="CodeRoutine Screenshot 11"/>
</p>

<p align="center">
  <img src="docs/CodeRoutine-12.png" width="200" alt="CodeRoutine Screenshot 12"/>
  <img src="docs/CodeRoutine-13.png" width="200" alt="CodeRoutine Screenshot 13"/>
  <img src="docs/CodeRoutine-14.png" width="200" alt="CodeRoutine Screenshot 14"/>
  <img src="docs/CodeRoutine-15.png" width="200" alt="CodeRoutine Screenshot 15"/>
</p>

## 🏗️ Architecture

This app follows a clean architecture pattern with:

- **Frontend**: React Native with Expo
- **State Management**: React Context + Hooks
- **Local Storage**: AsyncStorage with structured data
- **Primary Database**: Firebase (user data, settings, progress)
- **Content Management**: RESTful API (articles, notifications)
- **Authentication**: No authentication required, the app is fully functional without accounts
- **Push Notifications**: Expo Push Notifications
- **Analytics**: Firebase Crashlytics for logging errors plus custom read counts and likes (anonymous)

### Architecture Overview

The app uses a **hybrid architecture** that combines Firebase for user data management with a custom REST API for content management:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Native  │    │    Firebase     │    │   Google Cloud  │
│   Mobile App    │◄──►│   (User Data)   │    │  (Content Mgmt) │
│                 │    │                 │    │                 │
│ • UI Components │    │ • Articles R    │    │ • Articles R/W  │
│ • Local Storage │    │ • Reading Stats │    │ • Notifications │
│ • State Mgmt    │    │ • Sync Data     │    │ • AI Gen        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

**Firebase handles**: Article content delivery, stats, and push notification tokens.

**REST API handles**: Article management, content generation (summaries, translations, podcasts), push notifications triggers and admin functions.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator (Mac) or Android Studio

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/edodusi/coderoutine-oss.git
cd coderoutine-oss
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start development server**
```bash
npx expo start
```

## ⚙️ Configuration

### Required Environment Variables

```bash
# API Configuration
EXPO_PUBLIC_API_BASE_URL=https://your-api-url.com
EXPO_PUBLIC_ACCESS_TOKEN=your-secure-access-token

# RevenueCat (Optional - for subscriptions)
EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY=appl_your_key
EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY=goog_your_key
```

### Setup Guide

#### 1. Firebase Setup (Required)

1. **Create a Firebase project**
   ```bash
   # Visit https://console.firebase.google.com
   # Create new project
   # Enable Authentication, Firestore, and Cloud Messaging
   ```

2. **Configure Authentication**
   ```bash
   # Enable Email/Password and Google Sign-In
   # Configure OAuth settings for your domain
   ```

3. **Setup Firestore Database**
   ```bash
   # Create Firestore database in production mode
   # Use the database structure provided above
   ```

4. **Get Firebase configuration**
   ```bash
   # Project Settings > General > Your apps
   # Copy the config object values to your .env file
   ```

#### 2. Content API Setup (Optional)

The REST API is **optional** and only needed for content management and advanced features. The app works fully with just Firebase.

**When you need the REST API:**
- Adding new articles programmatically
- Push notification management
- AI features (podcasts, translations, summaries)
- Administrative dashboards

**Implementation options:**
1. **Use the provided OpenAPI spec**
   - Implement endpoints from `api-spec.yaml`
   - Focus on articles and notifications endpoints

2. **Simple backend options**
   - Node.js with Express + your preferred database
   - Python with FastAPI or Django
   - PHP with Laravel or Slim
   - Any REST API framework

3. **Mock API for development**
   - Use JSON Server with the provided schema
   - Perfect for testing and development

**Without the REST API**: You can manually add articles directly to Firebase Firestore and the app will work perfectly.

## 📋 Firebase Database Structure

The app uses Firebase Firestore with the following collections and document structure:

### Collections

#### `articles` collection
```typescript
// articles/{articleId}
{
  id: string,
  title: string,
  url: string,
  routineDay: string,           // ISO date string (YYYY-MM-DD)
  tags: string[],
  estimatedReadTime: number,    // in minutes
  description?: string,
  author?: string,
  source?: string,
  content?: string,
  needsJavascript?: boolean,    // Whether article requires JavaScript
  isActive: boolean,            // Whether article is active/published
  readCount?: number,           // Number of times read
  likeCount?: number,           // Number of likes
  dislikeCount?: number,        // Number of dislikes
  podcastUrl?: string,          // URL to generated podcast MP3
  podcastStatus?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
}
```

#### `analytics` collection
```typescript
// analytics/{analyticsId}
{
  articleId: string,
  platform: 'ios' | 'android',
  timestamp: timestamp,         // Firestore server timestamp
  userAgent: string
}
```

#### `beta_users` collection
```typescript
// beta_users/{deviceId}
{
  appId: string,                           // Unique device identifier
  firstStartupTimestamp: timestamp,        // First app launch
  subscriptionStart?: number,              // Unix timestamp
  subscriptionEnd?: number,                // Unix timestamp
  betaStatus: number                       // 0 = not beta, 1 = beta active
}
```

## 📡 REST API Documentation

The REST API handles content management and administrative functions. See [`api-spec.yaml`](./api-spec.yaml) for the complete OpenAPI 3.0 specification.

### Core Endpoints

#### Articles Management
```typescript
GET  /api/articles/today           // Get today's featured article
GET  /api/articles                // Get paginated articles list
GET  /api/articles/{id}            // Get specific article details
GET  /api/articles/{id}/content    // Get article full content
POST /api/articles                 // Create new article (admin)
POST /api/articles/{id}/vote       // Submit article rating
```

#### Content Generation
```typescript
POST /api/parse                           // Parse content from URL
POST /api/articles/generate-summary       // Generate AI summary
POST /api/articles/generate-translation   // Translate article
POST /api/articles/generate-podcast       // Generate audio version
```

#### Analytics & Notifications
```typescript
POST /api/analytics/read              // Track article read
GET  /api/analytics                  // Get analytics data
POST /api/notification/register      // Register for push notifications
POST /api/notification/unregister    // Unregister from notifications
POST /api/notification/send          // Send push notification (admin)
```

### Authentication

All API endpoints require an access token in the header:
```typescript
headers: {
  'x-access-token': 'your-secure-access-token',
  'Content-Type': 'application/json'
}
```

### Example Responses

#### Today's Article
```json
{
  "article": {
    "id": "article-123",
    "title": "Understanding React Hooks",
    "url": "https://example.com/article",
    "description": "Learn about React Hooks and their usage patterns...",
    "routineDay": "2024-01-15",
    "estimatedReadTime": 8,
    "tags": ["react", "javascript", "hooks"],
    "author": "Jane Developer",
    "source": "React Blog",
    "readCount": 42,
    "likeCount": 15,
    "dislikeCount": 2,
    "podcastUrl": "https://{podcast-url}.mp3",
    "podcastStatus": "COMPLETED"
  },
  "routineDay": "2024-01-15"
}
```

### Advanced Features

#### Podcast Generation
The API supports generating audio versions of articles:
- Asynchronous processing with status tracking
- Multiple language support
- Background generation with webhooks

#### Content Translation
Multi-language support for articles:
- Supported languages: Italian, Spanish, German, French
- AI-powered translations
- Cached results for performance

#### Analytics Tracking
Privacy-first analytics system:
- Tracks reading patterns without PII
- Platform-specific metrics (iOS/Android/Web)
- Hashed device identifiers for privacy

## 🛠️ Development

### Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── common/         # Generic components
│   ├── navigation/     # Navigation components
│   └── onboarding/     # Onboarding flow
├── screens/            # Screen components
├── context/            # React Context providers
├── hooks/              # Custom React hooks
├── services/           # API and business logic
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── config/             # Configuration files
└── test/               # Test utilities
```

### Key Technologies

- **React Native**: Cross-platform mobile development
- **Expo**: Development toolchain and platform
- **TypeScript**: Type-safe JavaScript
- **AsyncStorage**: Local data persistence
- **React Navigation**: Navigation system
- **Expo Notifications**: Push notifications
- **Vitest**: Testing framework

### Development Scripts

```bash
npm start                # Start Expo development server
npm run android         # Run on Android emulator
npm run ios             # Run on iOS simulator
npm run web             # Run in web browser
npm test                # Run tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage
npm run lint            # Run ESLint
npm run type-check      # Run TypeScript compiler
```

## 🧪 Testing

The project includes comprehensive testing:

```bash
# Run all tests
npm test

# Run specific test file
npm test -- article.test.ts

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode during development
npm run test:watch
```

### Test Coverage

- Unit tests for services and utilities
- Component testing for UI components
- Integration tests for user flows
- Storage and data persistence tests
- Onboarding flow tests

## 📦 Building & Deployment

### Development Build

```bash
# Create development build
eas build --platform android --profile development
eas build --platform ios --profile development
```

### Production Build

```bash
# Build for app stores
eas build --platform android --profile production
eas build --platform ios --profile production
```

### Local Development

For local development with Expo Go:

```bash
npx expo start
# Scan QR code with Expo Go app
```

## 🔧 Customization

### Firebase Configuration

Customize Firebase behavior in `src/config/firebase.ts`:

```typescript
// Firestore collections and subcollections
export const COLLECTIONS = {
  USERS: 'users',
  READING_STATS: 'readingStats',
  READ_ARTICLES: 'readArticles',
  SETTINGS: 'settings'
};

// Custom Firestore rules
// Configure in Firebase Console > Firestore Database > Rules
```

### Theming

The app supports custom themes. Modify `src/context/ThemeContext.tsx`:

```typescript
const themes = {
  light: {
    colors: {
      primary: '#007AFF',
      background: '#FFFFFF',
      card: '#F2F2F7',
      text: '#000000',
      // ... your colors
    }
  },
  dark: {
    colors: {
      primary: '#0A84FF',
      background: '#000000',
      card: '#1C1C1E',
      text: '#FFFFFF',
      // ... dark theme colors
    }
  }
};
```

### Adding New Features

1. Create components in `src/components/`
2. Add screens in `src/screens/`
3. Update navigation in `src/components/Navigation.tsx`
4. Add Firebase collections if needed
5. Update API endpoints if required
6. Add types in `src/types/`
7. Write tests for new functionality

### Storage Customization

The app uses both Firebase and local storage:

```typescript
// Local storage (AsyncStorage)
// Modify in src/services/storageService.ts
const STORAGE_KEYS = {
  CUSTOM_DATA: 'custom_data',
  // ... existing keys
};

// Firebase storage
// Add new collections in src/services/firebaseService.ts
async saveUserData(userId: string, data: UserData): Promise<void> {
  // Implementation
}
```

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`npm test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Code Style

- Follow TypeScript best practices
- Use the provided ESLint configuration
- Write tests for new features
- Update documentation as needed
- Follow existing naming conventions

## 📊 Performance

### Optimization Features

- **Lazy Loading**: Components loaded on demand
- **Memoization**: React.memo and useMemo where appropriate
- **Efficient Re-renders**: Optimized state management
- **Image Optimization**: Cached images and assets
- **Bundle Optimization**: Optimized build output

### Performance Monitoring

Monitor app performance with:

- React DevTools
- Flipper integration (for debugging)
- Custom analytics tracking
- Error boundary implementations

## 🔒 Security & Privacy

### Data Protection

- All sensitive data stored securely
- No hardcoded secrets in source code
- Environment variable configuration
- Secure API communication (HTTPS only)
- Input
 validation and sanitization

### Privacy-First Design

- **Local-First**: All data stored locally by default
- **No Tracking**: No analytics without explicit consent
- **Optional Cloud Sync**: Users choose whether to sync data
- **Transparent**: Clear about what data is collected
- **User Control**: Users can delete all data anytime

## 📚 API Documentation

### Authentication

All API requests require an access token:

```typescript
headers: {
  'x-access-token': 'your-access-token',
  'Content-Type': 'application/json'
}
```

### Error Handling

API responses follow this format:

```typescript
// Success
{
  data: any,
  success: true
}

// Error
{
  error: "Error message",
  code: "ERROR_CODE",
  success: false
}
```

### Rate Limiting

Be mindful of rate limiting in your backend implementation:
- Implement appropriate rate limits per user/IP
- Return proper HTTP status codes (429 for rate limit exceeded)
- Include retry headers when applicable

## 🆘 Troubleshooting

### Common Issues

**"Access token not configured"**
- Copy `.env.example` to `.env`
- Set `EXPO_PUBLIC_ACCESS_TOKEN` in your `.env` file

**"Network request failed"**
- Check `EXPO_PUBLIC_API_BASE_URL` configuration
- Verify your backend is running and accessible
- Check device network connectivity

**Build failures**
- Clear Metro cache: `npx expo start --clear`
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Update Expo CLI: `npm install -g @expo/cli@latest`

**TypeScript errors**
- Run type checking: `npm run type-check`
- Check for missing type definitions
- Ensure all imports are correctly typed

### Getting Help

- Check the [Issues](https://github.com/edodusi/coderoutine-oss/issues) page
- Start a [Discussion](https://github.com/edodusi/coderoutine-oss/discussions)
- Review existing code for examples

## 🚀 Deployment Options

### Expo Application Services (EAS)

1. Install EAS CLI: `npm install -g eas-cli`
2. Configure: `eas build:configure`
3. Build: `eas build --platform all`

### Manual Build

1. Eject from Expo (if needed): `npx expo eject`
2. Follow standard React Native build process
3. Use Xcode (iOS) or Android Studio (Android)

### Web Deployment

1. Build for web: `npx expo export:web`
2. Deploy static files to any hosting service
3. Configure routing for SPA behavior

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **React Native Community**: For the amazing framework
- **Expo Team**: For excellent development tools
- **Open Source Contributors**: Everyone who has contributed
- **The Developer Community**: For inspiration and feedback

## 🔗 Links

- [Repository](https://github.com/edodusi/coderoutine-oss)
- [Issues](https://github.com/edodusi/coderoutine-oss/issues)
- [Discussions](https://github.com/edodusi/coderoutine-oss/discussions)

## 📈 Roadmap

- [ ] Web version optimization
- [ ] Enhanced offline capabilities
- [ ] Plugin system for custom backends
- [ ] Advanced theming system
- [ ] Accessibility improvements
- [ ] Performance optimizations
- [ ] Community features

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/edodusi">Edoardo Dusi</a>
</p>

<p align="center">
  If this project helped you, please consider giving it a ⭐️
</p>
