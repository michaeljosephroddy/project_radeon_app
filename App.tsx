import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { AppNavigator } from './src/navigation/AppNavigator';
import { NotificationProvider } from './src/notifications/NotificationProvider';
import { Colors } from './src/utils/theme';
import { StatusBar } from 'expo-status-bar';

// Chooses between the authenticated app shell and the auth flow once session state is resolved.
function RootNavigator() {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        // Hold the app shell on a neutral splash while AuthProvider restores any
        // persisted session so we do not flash the logged-out stack on launch.
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.background }}>
                <ActivityIndicator color={Colors.primary} />
            </View>
        );
    }

    return isAuthenticated ? (
        <NotificationProvider>
            <AppNavigator />
        </NotificationProvider>
    ) : <AuthNavigator />;
}

// Mounts the global providers required by every screen in the app.
export default function App() {
    return (
        // These top-level providers need to wrap the whole tree because gesture
        // handling, safe-area layout, and auth state are shared across every screen.
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <StatusBar style="dark" />
                <AuthProvider>
                    <RootNavigator />
                </AuthProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
