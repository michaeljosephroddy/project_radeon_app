import React from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing } from '../../utils/theme';

interface SettingsScreenProps {
    onBack: () => void;
    onLogout: () => void;
}

// Renders the settings screen and exposes account-level actions.
export function SettingsScreen({ onBack, onLogout }: SettingsScreenProps) {
    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            {/* Settings currently exposes a single destructive action, but the grouped
                layout keeps room for more account/system options later. */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.headerSide}>
                    <Text style={styles.backIcon}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={styles.headerSide} />
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                <Text style={styles.sectionLabel}>ACCOUNT</Text>
                <View style={styles.group}>
                    <TouchableOpacity style={styles.row} onPress={onLogout}>
                        <Text style={styles.logoutText}>Log out</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.light.background },
    scroll: { flex: 1 },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: Colors.light.border,
    },
    headerSide: { width: 40 },
    backIcon: { fontSize: 20, color: Colors.primary, width: 40 },
    headerTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: '500',
        color: Colors.light.textPrimary,
    },

    content: { padding: Spacing.md, paddingBottom: 40 },
    sectionLabel: {
        fontSize: Typography.sizes.xs,
        fontWeight: '500',
        color: Colors.light.textTertiary,
        letterSpacing: 0.7,
        marginBottom: Spacing.sm,
    },
    group: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: 12,
        overflow: 'hidden',
    },
    row: {
        paddingHorizontal: Spacing.md,
        paddingVertical: 13,
    },
    logoutText: { fontSize: Typography.sizes.base, color: Colors.danger },
});
