import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { AppNavigator } from './src/navigation/AppNavigator';
import { OnboardingNavigator } from './src/navigation/OnboardingNavigator';
import { ChatRealtimeProvider } from './src/hooks/chat/ChatRealtimeProvider';
import { NotificationProvider } from './src/notifications/NotificationProvider';
import { asyncStoragePersister } from './src/query/asyncStoragePersister';
import { queryClient } from './src/query/queryClient';
import { Colors } from './src/utils/theme';
import { StatusBar } from 'expo-status-bar';

// Chooses between the authenticated app shell and the auth flow once session state is resolved.
function RootNavigator() {
    const { isAuthenticated, isLoading, isNewUser } = useAuth();

    if (isLoading) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.background }}>
                <ActivityIndicator color={Colors.primary} />
            </View>
        );
    }

    if (!isAuthenticated) return <AuthNavigator />;
    if (isNewUser) return <OnboardingNavigator />;

    return (
        <ChatRealtimeProvider>
            <NotificationProvider>
                <AppNavigator />
            </NotificationProvider>
        </ChatRealtimeProvider>
    );
}

// Mounts the global providers required by every screen in the app.
export default function App() {
    return (
        // These top-level providers need to wrap the whole tree because gesture
        // handling, safe-area layout, and auth state are shared across every screen.
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <StatusBar style="dark" />
                <PersistQueryClientProvider
                    client={queryClient}
                    persistOptions={{
                        persister: asyncStoragePersister,
                        maxAge: 1000 * 60 * 60 * 24 * 7,
                        buster: 'client-cache-v2-chat-cursor',
                    }}
                >
                    <AuthProvider>
                        <RootNavigator />
                    </AuthProvider>
                </PersistQueryClientProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
