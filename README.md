# Project Radeon — React Native Frontend

A social-first sober community app. Built with Expo + TypeScript.

## Setup

```bash
cd project_radeon_app
cp .env.example .env
npm install
npx expo start
```

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
├── components/
│   └── Avatar.tsx          # Reusable avatar with colour palette
├── hooks/
│   └── useAuth.tsx         # Auth context — login, register, logout, session restore
├── navigation/
│   ├── AppNavigator.tsx    # Main tab bar (feed, people, events, messages)
│   └── AuthNavigator.tsx   # Login / register switcher
├── screens/
│   ├── auth/
│   │   ├── LoginScreen.tsx
│   │   └── RegisterScreen.tsx
│   └── main/
│       ├── FeedScreen.tsx      # Posts, compose, react
│       ├── PeopleScreen.tsx    # Discover + pending requests
│       ├── EventsScreen.tsx    # Upcoming events + RSVP
│       ├── MessagesScreen.tsx  # Conversations list
│       └── ChatScreen.tsx      # Individual conversation
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
