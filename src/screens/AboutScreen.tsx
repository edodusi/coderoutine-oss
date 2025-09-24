import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import Constants from 'expo-constants';

const AboutScreen: React.FC = () => {
  const { theme, isDarkMode } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContainer: {
      flexGrow: 1,
      padding: 16,
    },
    section: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      elevation: 2,
      shadowOpacity: 0.1,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 12,
    },
    appVersion: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 16,
    },
    description: {
      fontSize: 16,
      color: theme.colors.text,
      lineHeight: 24,
      marginBottom: 16,
    },
    feature: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    featureIcon: {
      marginRight: 12,
      marginTop: 2,
    },
    featureText: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.text,
      lineHeight: 20,
    },
    footer: {
      alignItems: 'center',
      marginTop: 24,
      paddingTop: 16,
      paddingBottom: 60,
    },
    footerText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
  });

  const coreFeatures = [
    {
      icon: 'book-outline',
      text: 'One hand-picked article daily to prevent information overload.',
    },
    {
      icon: 'analytics-outline',
      text: 'Track your growth with reading streaks and expertise points.',
    },
    {
      icon: 'heart-outline',
      text: 'Save your favorite articles and find them easily with tags.',
    },
    {
      icon: 'moon-outline',
      text: 'Clean, distraction-free interface with light and dark themes.',
    },
  ];

  const premiumFeatures = [
    {
      icon: 'sparkles-outline',
      text: 'Generate smart summaries when you\'re short on time.',
    },
    {
      icon: 'language-outline',
      text: 'Translate summaries into your native language (🇮🇹 🇪🇸 🇩🇪 🇫🇷).',
    },
    {
      icon: 'headset-outline',
      text: 'Learn on the go by converting articles into podcast episodes.',
    },
  ];

  const comingSoonFeatures = [
    {
      icon: 'cloud-outline',
      text: 'Sync your reading history and favorites across devices.',
    },
    {
      icon: 'people-outline',
      text: 'Social features to learn with friends.',
    },
    {
      icon: 'chatbubbles-outline',
      text: 'Discuss articles and ask questions with an AI assistant.',
    },
    {
      icon: 'lock-closed-outline',
      text: 'Exclusive content for premium members.',
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContainer}>
      {/* App Info Section */}
      <View style={styles.section}>
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <Image
            source={require('../../assets/icon.png')}
            style={{
              width: 80,
              height: 80,
              marginBottom: 12,
              borderRadius: 16,
            }}
            resizeMode="contain"
          />
          <Image
            source={isDarkMode ? require('../../assets/header-dark.png') : require('../../assets/header.png')}
            style={{
              height: 50,
              width: 180,
              marginLeft: 10,
            }}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.appVersion}>Version {Constants.expoConfig?.version || '1.0.0'}</Text>
        <Text style={styles.description}>
          CodeRoutine helps you grow your skills sustainably by delivering one high-quality technical article each day.
        </Text>
      </View>

      {/* Core Features Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Key Features</Text>
        {coreFeatures.map((feature, index) => (
          <View key={index} style={styles.feature}>
            <Ionicons
              name={feature.icon as any}
              size={20}
              color={theme.colors.primary}
              style={styles.featureIcon}
            />
            <Text style={styles.featureText}>{feature.text}</Text>
          </View>
        ))}
      </View>

      {/* Premium Features Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Premium AI Features</Text>
        {premiumFeatures.map((feature, index) => (
          <View key={index} style={styles.feature}>
            <Ionicons
              name={feature.icon as any}
              size={20}
              color={theme.colors.primary}
              style={styles.featureIcon}
            />
            <Text style={styles.featureText}>
              {feature.text}
            </Text>
          </View>
        ))}
      </View>

      {/* Coming Soon Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Coming Soon</Text>
        {comingSoonFeatures.map((feature, index) => (
          <View key={index} style={styles.feature}>
            <Ionicons
              name={feature.icon as any}
              size={20}
              color={theme.colors.primary}
              style={styles.featureIcon}
            />
            <Text style={styles.featureText}>{feature.text}</Text>
          </View>
        ))}
      </View>

      {/* How It Works Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How It Works</Text>
        <Text style={styles.description}>
          <Text style={{ fontWeight: '600' }}>1. Daily Discovery{'\n'}</Text>
          Open the app to find today's curated technical article.
          {'\n\n'}

          <Text style={{ fontWeight: '600' }}>2. Choose Your Mode{'\n'}</Text>
          Read the full piece, generate an AI summary, or listen to it as a podcast.
          {'\n\n'}

          <Text style={{ fontWeight: '600' }}>3. Track Your Progress{'\n'}</Text>
          Mark the article as read to build your streak and earn expertise points.
          {'\n\n'}

          <Text style={{ fontWeight: '600' }}>4. Revisit Anytime{'\n'}</Text>
          Access your entire reading history and saved favorites whenever you want.
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Made with ❤️ by Edo for the global developer community.
        </Text>
      </View>
    </ScrollView>
  );
};

export default AboutScreen;
