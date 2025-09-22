import React, { useEffect, useRef } from 'react';
// Navigation with consolidated favorites screen
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { NavigationContainer, NavigationContainerRef, useNavigation, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useTheme } from '../context/ThemeContext';

// Import screens
import HomeScreen from '../screens/HomeScreen';
import ArticleScreen from '../screens/ArticleScreen';
import AboutScreen from '../screens/AboutScreen';
import SettingsScreen from '../screens/SettingsScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import FullHistoryScreen from '../screens/FullHistoryScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import ProgressScreen from '../screens/ProgressScreen';
import SummaryScreen from '../screens/SummaryScreen';
import BacklogScreen from '../screens/BacklogScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

export type RootTabParamList = {
  Home: undefined;
  Article: undefined;
  Favorites: undefined;
  About: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  MainTabs: { screen?: keyof RootTabParamList } | undefined;
  FullHistory: undefined;
  Subscription: undefined;
  SubscriptionDemo: undefined;
  Progress: undefined;
  Summary: {
    articleId: string;
    articleTitle: string;
    articleUrl: string;
  };
  Backlog: undefined;
};

const TabNavigator: React.FC = () => {
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation()

  const handleViewAbout = () => {
    navigation.navigate('About' as never);
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Article') {
            iconName = focused ? 'book' : 'book-outline';
          } else if (route.name === 'Favorites') {
            iconName = focused ? 'heart' : 'heart-outline';
          } else if (route.name === 'About') {
            iconName = focused ? 'information-circle' : 'information-circle-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          } else {
            iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          elevation: 8,
          shadowOpacity: 0.1,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: -2 },
        },
        headerStyle: {
          backgroundColor: theme.colors.card,
          elevation: 4,
          shadowOpacity: 0.1,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Home',
          headerTitle: () => (
            <Image
              source={isDarkMode ? require('../../assets/header-dark.png') : require('../../assets/header.png')}
              style={{ width: 160, marginTop: 5, marginLeft: 5 }}
              resizeMode="contain"
            />
          ),
          headerRight: () => (
            <Ionicons
              name="help-circle-outline"
              size={24}
              color={theme.colors.text}
              style={{ marginRight: 20, marginTop: 12 }}
              onPress={handleViewAbout}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Article"
        component={ArticleScreen}
        options={{
          title: "Today's Routine",
          headerTitle: "Today's Routine",
        }}
      />
      <Tab.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{
          title: 'Favorites',
          headerTitle: 'Favorites',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          headerTitle: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
};

const Navigation: React.FC = () => {
  const { theme, isDarkMode } = useTheme();
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  useEffect(() => {
    // Handle notification response when app is opened via notification
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {

      // Navigate to Home tab when notification is tapped
      if (navigationRef.current) {
        // Reset to main tabs and navigate to Home
        navigationRef.current.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });

        // Navigate to Home tab specifically
        setTimeout(() => {
          if (navigationRef.current) {
            // @ts-ignore - we know this navigation structure
            navigationRef.current.navigate('MainTabs', { screen: 'Home' });
          }
        }, 100);
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={{
        dark: isDarkMode,
        colors: {
          primary: theme.colors.primary,
          background: theme.colors.background,
          card: theme.colors.card,
          text: theme.colors.text,
          border: theme.colors.border,
          notification: theme.colors.notification,
        },
        fonts: DefaultTheme.fonts,
      }}
    >
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: theme.colors.card,
              elevation: 4,
              shadowOpacity: 0.1,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
            },
            headerTintColor: theme.colors.text,
            headerTitleStyle: {
              fontWeight: '600',
              fontSize: 18,
            },
          }}
        >
        <Stack.Screen
          name="MainTabs"
          component={TabNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="FullHistory"
          component={FullHistoryScreen}
          options={{
            title: 'Routine History',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="Subscription"
          component={SubscriptionScreen}
          options={{
            title: 'Subscription',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="Progress"
          component={ProgressScreen}
          options={{
            title: 'Your Progress',
            headerBackTitle: 'Back',
            cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="About"
          component={AboutScreen}
          options={{
            title: 'About',
            headerBackTitle: 'Back',
            cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="Summary"
          component={SummaryScreen}
          options={{
            headerShown: false,
            cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="Backlog"
          component={BacklogScreen}
          options={{
            title: 'Article Backlog',
            headerBackTitle: 'Back',
            cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
            gestureEnabled: true,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default Navigation;
