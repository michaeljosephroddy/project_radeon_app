import React from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { AuthProvider } from './src/hooks/useAuth';
import { RootNavigation } from './src/navigation/RootNavigation';
import { AppPopupProvider } from './src/components/ui/AppPopupProvider';
import { asyncStoragePersister } from './src/query/asyncStoragePersister';
import { queryClient } from './src/query/queryClient';
import { StatusBar } from 'expo-status-bar';

// Mounts the global providers required by every screen in the app.
export default function App() {
    return (
        // These top-level providers need to wrap the whole tree because gesture
        // handling, safe-area layout, and auth state are shared across every screen.
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
                    <StatusBar style="dark" />
                    <PersistQueryClientProvider
                        client={queryClient}
                        persistOptions={{
                            persister: asyncStoragePersister,
                            maxAge: 1000 * 60 * 60 * 24 * 7,
                            buster: 'client-cache-v6-faceted-meeting-filters',
                        }}
                    >
                        <AuthProvider>
                            <AppPopupProvider>
                                <RootNavigation />
                            </AppPopupProvider>
                        </AuthProvider>
                    </PersistQueryClientProvider>
                </KeyboardProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
