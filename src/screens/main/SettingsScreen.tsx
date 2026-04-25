import React from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing } from '../../utils/theme';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { screenStandards } from '../../styles/screenStandards';

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
            <ScreenHeader onBack={onBack} title="Settings" />

            <ScrollView style={styles.scroll} contentContainerStyle={screenStandards.detailContent}>
                <View style={screenStandards.sectionLabelBlockTight}>
                    <SectionLabel>ACCOUNT</SectionLabel>
                </View>
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
