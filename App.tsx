import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { AppNavigator } from './src/navigation/AppNavigator';
import { Colors } from './src/utils/theme';
import { StatusBar } from 'expo-status-bar';

function RootNavigator() {
    const { isAuthenticated, isLoading } = useAuth();
    console.log('RootNavigator render — isAuthenticated:', isAuthenticated, 'isLoading:', isLoading);

    if (isLoading) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.background }}>
                <ActivityIndicator color={Colors.primary} />
            </View>
        );
    }

    return isAuthenticated ? <AppNavigator /> : <AuthNavigator />;
}

export default function App() {
    return (
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
