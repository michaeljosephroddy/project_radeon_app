# Project Radeon — React Native Frontend

A social-first sober community app. Built with Expo + TypeScript.

## Setup

```bash
cd project_radeon_app
npm install
npx expo start
```

Create a `.env` at the repo root and set `EXPO_PUBLIC_API_URL` to your backend URL (see [API URL](#api-url)).

Then press:
- `i` — open iOS simulator
- `a` — open Android emulator
- Scan QR with Expo Go on your phone

## API URL

The app talks to your Go backend. By default it points to `http://localhost:8080`.

**iOS simulator**: `localhost` works out of the box.

**Android emulator**: Change `EXPO_PUBLIC_API_URL` to `http://10.0.2.2:8080` in `.env`.

**Physical device**: Use your machine's local IP, e.g. `http://192.168.1.10:8080`. Find it with `ifconfig` (Mac/Linux) or `ipconfig` (Windows).

## Project structure

```
src/
├── api/
│   └── client.ts          # All API calls + types
├── components/             # Reusable UI (Avatar, ProfileSheet, ConnectionSheet, …)
├── hooks/                  # useAuth + data hooks (queries/)
├── navigation/
│   ├── AppNavigator.tsx       # Main tab bar (feed, discover, meetups, chats, profile)
│   ├── AuthNavigator.tsx      # Login / register switcher
│   └── OnboardingNavigator.tsx
├── screens/
│   ├── auth/                  # LoginScreen, RegisterScreen
│   ├── onboarding/
│   └── main/
│       ├── FeedScreen.tsx           # Posts, compose, react
│       ├── DiscoverScreen.tsx       # Discover + friend requests
│       ├── MeetupsScreen.tsx        # Upcoming meetups + RSVP
│       ├── ChatsScreen.tsx          # Chats list
│       ├── ChatScreen.tsx           # Individual chat
│       ├── SupportScreen.tsx        # Support requests + recovery meetings
│       ├── NotificationsScreen.tsx
│       ├── ProfileTabScreen.tsx
│       ├── UserProfileScreen.tsx
│       ├── SettingsScreen.tsx
│       └── …
└── utils/
    └── theme.ts            # Colours, typography, spacing, avatar palette
```

## Design tokens

All colours come from `src/utils/theme.ts` and match the original design:
- Primary: `#7F77DD`
- Avatar palette: purple, green, amber, coral — assigned deterministically by name
- Tab bar with indicator dots matching the mockup

## Auth flow

Tokens are stored in `expo-secure-store` (encrypted on-device).
On app launch, the stored token is validated — if it's expired or revoked the user is sent back to login automatically.
