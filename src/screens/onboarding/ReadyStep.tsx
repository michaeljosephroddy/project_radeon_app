import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Typography, Spacing } from '../../theme';

interface ReadyStepProps {
    onComplete: () => void;
}

export function ReadyStep({ onComplete }: ReadyStepProps) {
    const { user } = useAuth();

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <StatusBar style="light" />
            <View style={styles.inner}>
                <View style={styles.checkWrap}>
                    <Ionicons name="checkmark" size={52} color={Colors.success} />
                </View>
                <Text style={styles.headline}>
                    You're all set{user?.username ? `, ${user.username}` : ''}!
                </Text>
                <Text style={styles.body}>
                    Welcome to the SoberSpace community. You can update your profile any time from the profile tab.
                </Text>
            </View>
            <View style={styles.footer}>
                <PrimaryButton label="Enter SoberSpace" onPress={onComplete} variant="success" />
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
    checkWrap: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: 'rgba(25, 135, 84, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.xl,
        borderWidth: 1,
        borderColor: 'rgba(25, 135, 84, 0.3)',
    },
    headline: {
        fontSize: Typography.sizes.xxl,
        fontWeight: '700',
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
