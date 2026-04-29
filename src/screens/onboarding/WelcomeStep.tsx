import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Typography, Spacing, Radius } from '../../theme';

interface WelcomeStepProps {
    onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
    const { user } = useAuth();

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <StatusBar style="light" />
            <View style={styles.inner}>
                <View style={styles.iconWrap}>
                    <Ionicons name="heart" size={52} color={Colors.primary} />
                </View>
                <Text style={styles.wordmark}>
                    Sober<Text style={styles.accent}>Space</Text>
                </Text>
                <Text style={styles.headline}>
                    Welcome{user?.username ? `, ${user.username}` : ''}
                </Text>
                <Text style={styles.body}>
                    Let's set up your profile so the community can get to know you. It only takes a minute.
                </Text>
            </View>
            <View style={styles.footer}>
                <PrimaryButton label="Let's go" onPress={onNext} />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.page },
    inner: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.xxl,
    },
    iconWrap: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: Colors.bg.surface,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.xl,
    },
    wordmark: {
        fontSize: Typography.sizes.xxxl,
        fontWeight: '600',
        color: Colors.text.primary,
        letterSpacing: -0.5,
        marginBottom: Spacing.xl,
    },
    accent: { color: Colors.primary },
    headline: {
        fontSize: Typography.sizes.xxl,
        fontWeight: '600',
        color: Colors.text.primary,
        textAlign: 'center',
        marginBottom: Spacing.md,
    },
    body: {
        fontSize: Typography.sizes.lg,
        color: Colors.text.secondary,
        textAlign: 'center',
        lineHeight: 24,
    },
    footer: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.lg,
    },
});
