# Global Perspectives Mobile App - Development Guide

**Project:** global-perspectives-mobile
**Platform:** iOS + Android
**Framework:** React Native (Expo)
**Timeline:** 4 months

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Prerequisites](#2-prerequisites)
3. [Project Setup](#3-project-setup)
4. [Project Structure](#4-project-structure)
5. [Backend API Integration](#5-backend-api-integration)
6. [Screens & Navigation](#6-screens--navigation)
7. [Features Specification](#7-features-specification)
8. [Development Timeline](#8-development-timeline)
9. [UI/UX Design](#9-uiux-design)
10. [Push Notifications](#10-push-notifications)
11. [Offline Mode](#11-offline-mode)
12. [Testing](#12-testing)
13. [Deployment](#13-deployment)
14. [Checklist](#14-checklist)

---

## 1. Project Overview

### What We're Building

A mobile app (iOS + Android) for **Global Perspectives** - an AI-powered news aggregation platform that:

- Shows 10+ trending global topics
- Provides AI-generated summaries, predictions, and trace cause analysis
- Displays news on an interactive world map
- Sends push notifications for breaking news
- Works offline

### Existing Backend

The backend already exists and is running. The mobile app will connect to:

- **API Endpoint:** AWS API Gateway → Lambda
- **Data Source:** DynamoDB (topics, summaries, predictions)
- **AI Services:** xAI Grok 4 Fast, Brave Search API

**The mobile app is a new frontend only. No backend changes needed.**

### Web App Reference

The existing web app is at: `globalperspective.net`

The mobile app should have similar functionality but optimized for mobile.

---

## 2. Prerequisites

### Accounts Needed

| Account | Cost | Required For |
|---------|------|--------------|
| Apple Developer | $99 USD/year | iOS App Store, TestFlight |
| Google Play Developer | $25 USD (one-time) | Google Play Store |
| Expo Account | Free | Building and deploying |

### Software to Install

| Software | Purpose | Install Command |
|----------|---------|-----------------|
| Node.js (v18+) | JavaScript runtime | `brew install node` |
| Xcode | iOS simulator & build | App Store |
| Android Studio | Android emulator & build | https://developer.android.com/studio |
| VS Code | Code editor | https://code.visualstudio.com |
| Expo CLI | React Native framework | `npm install -g expo-cli` |
| Git | Version control | `brew install git` |

### Hardware

- **Mac computer** (required for iOS development)
- iPhone or Android phone for testing (optional, can use simulators)

---

## 3. Project Setup

### Step 1: Create Project

```bash
# Navigate to your projects folder (NOT inside globalPerspective-v1)
cd ~/Projects  # or your preferred location

# Create new Expo project
npx create-expo-app global-perspectives-mobile --template blank

# Navigate into project
cd global-perspectives-mobile
```

### Step 2: Install Dependencies

```bash
# Navigation
npm install @react-navigation/native
npm install @react-navigation/bottom-tabs
npm install @react-navigation/native-stack
npm install react-native-screens react-native-safe-area-context

# Maps
npm install react-native-maps

# Storage (offline mode)
npm install @react-native-async-storage/async-storage

# Notifications
npm install expo-notifications
npm install expo-device

# UI Components
npm install expo-status-bar
npm install react-native-gesture-handler
npm install react-native-reanimated

# Icons
npm install @expo/vector-icons

# Date handling
npm install date-fns
```

### Step 3: Configure app.json

```json
{
  "expo": {
    "name": "Global Perspectives",
    "slug": "global-perspectives",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#1a1a2e"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.globalperspectives.app",
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "Used to show news near your location on the map."
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#1a1a2e"
      },
      "package": "com.globalperspectives.app",
      "permissions": ["RECEIVE_BOOT_COMPLETED", "VIBRATE"]
    },
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#ffffff"
        }
      ]
    ]
  }
}
```

### Step 4: Initialize Git

```bash
git init
git add .
git commit -m "Initial commit: Expo project setup"
```

### Step 5: Create GitHub Repository

```bash
# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/global-perspectives-mobile.git
git branch -M main
git push -u origin main
```

---

## 4. Project Structure

```
global-perspectives-mobile/
├── App.js                      # Entry point
├── app.json                    # Expo configuration
├── package.json                # Dependencies
├── babel.config.js             # Babel configuration
├── assets/                     # Static assets
│   ├── icon.png                # App icon (1024x1024)
│   ├── splash.png              # Splash screen
│   ├── adaptive-icon.png       # Android adaptive icon
│   ├── notification-icon.png   # Notification icon
│   └── logo.png                # Logo for in-app use
├── src/
│   ├── screens/                # App screens
│   │   ├── HomeScreen.js           # Topics list
│   │   ├── TopicDetailScreen.js    # Summary/Predict/Trace
│   │   ├── MapScreen.js            # World map
│   │   ├── SettingsScreen.js       # Settings
│   │   └── SupportersScreen.js     # Kickstarter supporters
│   ├── components/             # Reusable components
│   │   ├── TopicCard.js            # Topic list item
│   │   ├── SummaryView.js          # Summary display
│   │   ├── PredictionView.js       # Prediction display
│   │   ├── TraceCauseView.js       # Trace cause display
│   │   ├── LoadingSpinner.js       # Loading indicator
│   │   ├── ErrorView.js            # Error display
│   │   └── SourcesList.js          # News sources list
│   ├── navigation/             # Navigation setup
│   │   └── AppNavigator.js         # Tab + Stack navigation
│   ├── services/               # API and external services
│   │   ├── api.js                  # Backend API calls
│   │   ├── storage.js              # Local storage (offline)
│   │   └── notifications.js        # Push notifications
│   ├── hooks/                  # Custom React hooks
│   │   ├── useTopics.js            # Fetch topics
│   │   ├── useSummary.js           # Fetch summary
│   │   └── useOfflineData.js       # Offline data management
│   ├── utils/                  # Helper functions
│   │   ├── formatDate.js           # Date formatting
│   │   └── helpers.js              # Misc helpers
│   ├── constants/              # App constants
│   │   ├── colors.js               # Color palette
│   │   ├── config.js               # API URLs, settings
│   │   └── theme.js                # Theme configuration
│   └── context/                # React Context (global state)
│       └── AppContext.js           # App-wide state
└── README.md                   # Project documentation
```

---

## 5. Backend API Integration

### API Configuration

Create `src/constants/config.js`:

```javascript
export const API_CONFIG = {
  // IMPORTANT: Replace with your actual API Gateway URL
  BASE_URL: 'https://YOUR_API_GATEWAY_ID.execute-api.ap-northeast-1.amazonaws.com/prod',

  // Endpoints (all use POST to /proxy with action in body)
  ENDPOINTS: {
    PROXY: '/proxy'
  },

  // Actions
  ACTIONS: {
    TOPICS: 'topics',
    SUMMARY: 'summary',
    PREDICTION: 'prediction',
    TRACE_CAUSE: 'trace_cause',
    GEOCODE: 'geocode'
  },

  // Cache settings
  CACHE_DURATION: 60 * 60 * 1000, // 1 hour in milliseconds
};
```

### API Service

Create `src/services/api.js`:

```javascript
import { API_CONFIG } from '../constants/config';

const { BASE_URL, ENDPOINTS, ACTIONS } = API_CONFIG;

/**
 * Make API request to backend
 */
async function apiRequest(action, payload = {}) {
  try {
    const response = await fetch(`${BASE_URL}${ENDPOINTS.PROXY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, payload }),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`API request failed (${action}):`, error);
    throw error;
  }
}

/**
 * Fetch all topics
 */
export async function fetchTopics() {
  const response = await apiRequest(ACTIONS.TOPICS);
  return response.data?.topics || [];
}

/**
 * Fetch summary for a topic
 */
export async function fetchSummary(topicId) {
  const response = await apiRequest(ACTIONS.SUMMARY, { topicId });
  return response.data;
}

/**
 * Fetch prediction for a topic
 */
export async function fetchPrediction(topicId) {
  const response = await apiRequest(ACTIONS.PREDICTION, { topicId });
  return response.data;
}

/**
 * Fetch trace cause for a topic
 */
export async function fetchTraceCause(topicId) {
  const response = await apiRequest(ACTIONS.TRACE_CAUSE, { topicId });
  return response.data;
}

/**
 * Geocode an address for map
 */
export async function geocodeAddress(address) {
  const response = await apiRequest(ACTIONS.GEOCODE, { address });
  return response.data;
}
```

### API Response Formats

**Topics Response:**
```json
{
  "success": true,
  "data": {
    "topics": [
      {
        "id": "topic-id-hash",
        "topicId": "topic-id-hash",
        "title": "Topic Title Here",
        "category": "politics",
        "regions": ["United States", "China"],
        "sources": [
          {
            "title": "Article Title",
            "url": "https://...",
            "source": "reuters.com",
            "age": "2 hours ago",
            "snippet": "Article description..."
          }
        ]
      }
    ],
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

**Summary Response:**
```json
{
  "success": true,
  "data": {
    "topicId": "topic-id-hash",
    "content": "• Bullet point 1\n• Bullet point 2\n• Bullet point 3",
    "generatedAt": "2024-01-15T10:05:00.000Z"
  }
}
```

---

## 6. Screens & Navigation

### Navigation Structure

```
App
├── BottomTabs
│   ├── Home (Stack)
│   │   ├── HomeScreen (Topics List)
│   │   └── TopicDetailScreen
│   ├── Map (Stack)
│   │   └── MapScreen
│   └── Settings (Stack)
│       ├── SettingsScreen
│       └── SupportersScreen
```

### Navigation Setup

Create `src/navigation/AppNavigator.js`:

```javascript
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import TopicDetailScreen from '../screens/TopicDetailScreen';
import MapScreen from '../screens/MapScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SupportersScreen from '../screens/SupportersScreen';

import { COLORS } from '../constants/colors';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.background },
        headerTintColor: COLORS.text,
      }}
    >
      <Stack.Screen
        name="HomeMain"
        component={HomeScreen}
        options={{ title: 'Global Perspectives' }}
      />
      <Stack.Screen
        name="TopicDetail"
        component={TopicDetailScreen}
        options={({ route }) => ({ title: route.params?.title || 'Topic' })}
      />
    </Stack.Navigator>
  );
}

function MapStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.background },
        headerTintColor: COLORS.text,
      }}
    >
      <Stack.Screen
        name="MapMain"
        component={MapScreen}
        options={{ title: 'World Map' }}
      />
    </Stack.Navigator>
  );
}

function SettingsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.background },
        headerTintColor: COLORS.text,
      }}
    >
      <Stack.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
      <Stack.Screen
        name="Supporters"
        component={SupportersScreen}
        options={{ title: 'Supporters' }}
      />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;
            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Map') {
              iconName = focused ? 'map' : 'map-outline';
            } else if (route.name === 'Settings') {
              iconName = focused ? 'settings' : 'settings-outline';
            }
            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.textSecondary,
          tabBarStyle: { backgroundColor: COLORS.background },
          headerShown: false,
        })}
      >
        <Tab.Screen name="Home" component={HomeStack} />
        <Tab.Screen name="Map" component={MapStack} />
        <Tab.Screen name="Settings" component={SettingsStack} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
```

### Colors

Create `src/constants/colors.js`:

```javascript
export const COLORS = {
  // Dark theme (matches web app)
  background: '#1a1a2e',
  surface: '#16213e',
  primary: '#4f8cff',
  secondary: '#e94560',
  accent: '#ffd700',

  text: '#ffffff',
  textSecondary: '#a0a0a0',
  textMuted: '#666666',

  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',

  border: '#2a2a4e',

  // Category colors
  politics: '#e94560',
  economy: '#4f8cff',
  technology: '#9c27b0',
  environment: '#4caf50',
  security: '#ff9800',
  health: '#00bcd4',
  culture: '#ff5722',
};

// Light theme (optional, for future)
export const LIGHT_COLORS = {
  background: '#ffffff',
  surface: '#f5f5f5',
  primary: '#4f8cff',
  // ... etc
};
```

---

## 7. Features Specification

### Feature 1: Topics List (Home Screen)

**Purpose:** Display all current global topics

**Requirements:**
- Show 10+ topics in a scrollable list
- Each topic card shows: title, category, regions, source count
- Pull-to-refresh to update
- Tap to navigate to detail screen
- Show "last updated" timestamp

**Data needed:**
- `fetchTopics()` from API

---

### Feature 2: Topic Detail Screen

**Purpose:** Show AI analysis for a topic

**Requirements:**
- Three tabs: Summary, Prediction, Trace Cause
- Each tab fetches data on demand (lazy loading)
- Show loading state while fetching
- Show sources list at bottom
- Share button to share topic

**Data needed:**
- `fetchSummary(topicId)`
- `fetchPrediction(topicId)`
- `fetchTraceCause(topicId)`

---

### Feature 3: World Map

**Purpose:** Visualize news geographically

**Requirements:**
- Interactive map with markers
- Markers colored by topic category
- Tap marker to see topic info
- Zoom and pan controls

**Data needed:**
- Topics with regions
- `geocodeAddress(region)` for coordinates

---

### Feature 4: Push Notifications

**Purpose:** Alert users to breaking news

**Requirements:**
- Request notification permission on first launch
- Send notification when new high-priority topic appears
- Tap notification opens relevant topic

**Implementation:**
- Use Expo Notifications
- Backend would need to trigger notifications (future enhancement)

---

### Feature 5: Offline Mode

**Purpose:** Access cached content without internet

**Requirements:**
- Cache topics, summaries, predictions locally
- Show cached data when offline
- Indicate stale data with timestamp
- Sync when back online

**Implementation:**
- AsyncStorage for local storage
- Check network status
- Cache API responses

---

### Feature 6: Dark Mode

**Purpose:** Comfortable viewing in low light

**Requirements:**
- Dark theme by default (matches web app)
- Option for light theme in settings
- Respect system preference

---

### Feature 7: Settings

**Purpose:** User preferences

**Requirements:**
- Toggle notifications on/off
- Toggle dark/light mode
- Clear cache button
- About/credits section
- Link to supporters page

---

## 8. Development Timeline

### Month 1: Core App

**Week 1:**
- [ ] Project setup (Expo, dependencies)
- [ ] Navigation structure
- [ ] API service integration
- [ ] Basic HomeScreen with topics list

**Week 2:**
- [ ] TopicCard component
- [ ] Pull-to-refresh
- [ ] TopicDetailScreen structure
- [ ] Summary tab

**Week 3:**
- [ ] Prediction tab
- [ ] Trace Cause tab
- [ ] Tab navigation in detail screen
- [ ] Sources list component

**Week 4:**
- [ ] Error handling
- [ ] Loading states
- [ ] Basic styling/polish
- [ ] Test on iOS simulator

### Month 2: Advanced Features

**Week 5:**
- [ ] MapScreen with react-native-maps
- [ ] Geocoding for markers
- [ ] Marker tap interaction

**Week 6:**
- [ ] Push notifications setup
- [ ] Notification permissions
- [ ] Settings screen

**Week 7:**
- [ ] Offline mode (AsyncStorage)
- [ ] Cache management
- [ ] Network status detection

**Week 8:**
- [ ] Dark/light mode toggle
- [ ] Supporters screen
- [ ] Polish and refinements

### Month 3: Beta Testing

**Week 9-10:**
- [ ] Internal testing
- [ ] Fix bugs
- [ ] Performance optimization

**Week 11-12:**
- [ ] Beta release to Kickstarter backers
- [ ] Collect feedback
- [ ] Fix reported issues

### Month 4: Launch

**Week 13-14:**
- [ ] Final bug fixes
- [ ] App Store screenshots
- [ ] App Store description
- [ ] Submit to Apple App Store

**Week 15-16:**
- [ ] Submit to Google Play
- [ ] Address review feedback
- [ ] Public launch

---

## 9. UI/UX Design

### Home Screen Mockup

```
┌─────────────────────────────────────┐
│ ◀ Global Perspectives          🔔  │  <- Header
├─────────────────────────────────────┤
│ Updated 5 minutes ago               │  <- Last update
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 🔴 Trade War Escalates Between  │ │
│ │    US and China                 │ │
│ │ Politics • US, China • 5 sources│ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 🔵 Bank of Japan Raises Rates   │ │
│ │    to 0.25%                     │ │
│ │ Economy • Japan • 3 sources     │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 🟠 Gaza Ceasefire Negotiations  │ │
│ │    Enter Final Stage            │ │
│ │ Security • Israel, Palestine    │ │
│ └─────────────────────────────────┘ │
│                                     │
│           [Load More]               │
├─────────────────────────────────────┤
│  🏠 Home    🗺️ Map    ⚙️ Settings  │  <- Bottom tabs
└─────────────────────────────────────┘
```

### Topic Detail Screen Mockup

```
┌─────────────────────────────────────┐
│ ◀ Trade War Escalates...      📤   │  <- Header + Share
├─────────────────────────────────────┤
│ ┌──────────┬──────────┬──────────┐ │
│ │ Summary  │ Predict  │  Trace   │ │  <- Tabs
│ └──────────┴──────────┴──────────┘ │
├─────────────────────────────────────┤
│                                     │
│ • The US announced new tariffs on   │
│   Chinese goods worth $50 billion   │
│                                     │
│ • China responded with retaliatory  │
│   tariffs on American products      │
│                                     │
│ • Markets reacted negatively with   │
│   major indices falling 2-3%        │
│                                     │
│ • Analysts predict prolonged        │
│   economic uncertainty              │
│                                     │
├─────────────────────────────────────┤
│ Sources (5)                      ▼  │
│ ┌─────────────────────────────────┐ │
│ │ Reuters - 2 hours ago           │ │
│ │ BBC News - 3 hours ago          │ │
│ │ Al Jazeera - 4 hours ago        │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Map Screen Mockup

```
┌─────────────────────────────────────┐
│ ◀ World Map                         │
├─────────────────────────────────────┤
│                                     │
│         🔴                          │
│    ┌────────────┐                   │
│    │ US-China   │     🔵            │
│    │ Trade War  │                   │
│    └────────────┘                   │
│                        🟠           │
│           [WORLD MAP]               │
│                                     │
│      🟢                   🔵        │
│                                     │
│                 🔴                  │
│                                     │
├─────────────────────────────────────┤
│  🏠 Home    🗺️ Map    ⚙️ Settings  │
└─────────────────────────────────────┘
```

---

## 10. Push Notifications

### Setup

Create `src/services/notifications.js`:

```javascript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions
 */
export async function requestPermissions() {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Notification permission denied');
    return false;
  }

  // Get push token for backend (future use)
  const token = await Notifications.getExpoPushTokenAsync();
  console.log('Push token:', token.data);

  return true;
}

/**
 * Schedule a local notification (for testing)
 */
export async function scheduleLocalNotification(title, body) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
    },
    trigger: null, // Immediate
  });
}

/**
 * Add notification listener
 */
export function addNotificationListener(callback) {
  const subscription = Notifications.addNotificationReceivedListener(callback);
  return subscription;
}

/**
 * Add notification response listener (when user taps notification)
 */
export function addNotificationResponseListener(callback) {
  const subscription = Notifications.addNotificationResponseReceivedListener(callback);
  return subscription;
}
```

---

## 11. Offline Mode

### Storage Service

Create `src/services/storage.js`:

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../constants/config';

const STORAGE_KEYS = {
  TOPICS: '@topics',
  SUMMARIES: '@summaries',
  PREDICTIONS: '@predictions',
  TRACE_CAUSES: '@trace_causes',
  LAST_UPDATED: '@last_updated',
};

/**
 * Save topics to local storage
 */
export async function cacheTopics(topics) {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(topics));
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_UPDATED, Date.now().toString());
  } catch (error) {
    console.error('Failed to cache topics:', error);
  }
}

/**
 * Get cached topics
 */
export async function getCachedTopics() {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.TOPICS);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to get cached topics:', error);
    return null;
  }
}

/**
 * Check if cache is stale
 */
export async function isCacheStale() {
  try {
    const lastUpdated = await AsyncStorage.getItem(STORAGE_KEYS.LAST_UPDATED);
    if (!lastUpdated) return true;

    const elapsed = Date.now() - parseInt(lastUpdated, 10);
    return elapsed > API_CONFIG.CACHE_DURATION;
  } catch (error) {
    return true;
  }
}

/**
 * Cache a summary
 */
export async function cacheSummary(topicId, summary) {
  try {
    const existing = await AsyncStorage.getItem(STORAGE_KEYS.SUMMARIES);
    const summaries = existing ? JSON.parse(existing) : {};
    summaries[topicId] = summary;
    await AsyncStorage.setItem(STORAGE_KEYS.SUMMARIES, JSON.stringify(summaries));
  } catch (error) {
    console.error('Failed to cache summary:', error);
  }
}

/**
 * Get cached summary
 */
export async function getCachedSummary(topicId) {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SUMMARIES);
    const summaries = data ? JSON.parse(data) : {};
    return summaries[topicId] || null;
  } catch (error) {
    return null;
  }
}

/**
 * Clear all cached data
 */
export async function clearCache() {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.TOPICS,
      STORAGE_KEYS.SUMMARIES,
      STORAGE_KEYS.PREDICTIONS,
      STORAGE_KEYS.TRACE_CAUSES,
      STORAGE_KEYS.LAST_UPDATED,
    ]);
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}
```

---

## 12. Testing

### Testing on iOS Simulator

```bash
# Start Expo
npx expo start

# Press 'i' to open iOS simulator
```

### Testing on Android Emulator

```bash
# Start Expo
npx expo start

# Press 'a' to open Android emulator
```

### Testing on Physical Device

1. Install **Expo Go** app on your phone
2. Run `npx expo start`
3. Scan QR code with Expo Go

### Beta Testing (TestFlight / Google Play Beta)

**iOS (TestFlight):**
```bash
# Build for iOS
eas build --platform ios --profile preview

# Upload to TestFlight through App Store Connect
```

**Android (Internal Testing):**
```bash
# Build for Android
eas build --platform android --profile preview

# Upload .aab to Google Play Console
```

---

## 13. Deployment

### App Store (iOS)

1. **Create App Store Connect listing**
   - App name: Global Perspectives
   - Bundle ID: com.globalperspectives.app
   - Add screenshots, description, keywords

2. **Build for production**
   ```bash
   eas build --platform ios --profile production
   ```

3. **Submit for review**
   - Upload build to App Store Connect
   - Fill in review information
   - Submit

### Google Play (Android)

1. **Create Google Play Console listing**
   - App name: Global Perspectives
   - Package name: com.globalperspectives.app
   - Add screenshots, description

2. **Build for production**
   ```bash
   eas build --platform android --profile production
   ```

3. **Submit for review**
   - Upload .aab to Google Play Console
   - Fill in content rating questionnaire
   - Submit

### App Store Screenshots Needed

| Device | Size |
|--------|------|
| iPhone 6.7" | 1290 x 2796 |
| iPhone 6.5" | 1284 x 2778 |
| iPhone 5.5" | 1242 x 2208 |
| iPad 12.9" | 2048 x 2732 |

---

## 14. Checklist

### Before Starting Development

- [ ] Mac computer ready
- [ ] Node.js installed
- [ ] Xcode installed
- [ ] Android Studio installed
- [ ] Apple Developer account ($99)
- [ ] Google Play account ($25)
- [ ] Expo account created
- [ ] API endpoint URL confirmed

### Before Beta Release

- [ ] All core features working
- [ ] Tested on iOS simulator
- [ ] Tested on Android emulator
- [ ] Tested on physical devices
- [ ] Error handling implemented
- [ ] Loading states implemented
- [ ] Offline mode working
- [ ] Push notifications working

### Before App Store Submission

- [ ] App icon ready (1024x1024)
- [ ] Splash screen ready
- [ ] Screenshots for all required sizes
- [ ] App description written
- [ ] Privacy policy URL
- [ ] Support URL
- [ ] Keywords selected
- [ ] Age rating completed
- [ ] Tested production build

---

## Quick Reference

### Key Commands

```bash
# Start development server
npx expo start

# Run on iOS
npx expo start --ios

# Run on Android
npx expo start --android

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Install dependencies
npm install

# Update Expo
npx expo install expo@latest
```

### Key Files

| File | Purpose |
|------|---------|
| `App.js` | Entry point |
| `app.json` | Expo config |
| `src/constants/config.js` | API URL |
| `src/services/api.js` | Backend calls |
| `src/navigation/AppNavigator.js` | Navigation |

### API Endpoint

**URL:** `https://YOUR_API_GATEWAY_ID.execute-api.ap-northeast-1.amazonaws.com/prod/proxy`

**Method:** POST

**Body:**
```json
{
  "action": "topics",
  "payload": {}
}
```

---

**END OF GUIDE**
