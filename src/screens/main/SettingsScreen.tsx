import { appAlert } from '@/components/ui/appAlert';
import React, { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as api from '../../api/client';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { useAuth } from '../../hooks/useAuth';
import { screenStandards } from '../../styles/screenStandards';
import { Colors, Radius, Spacing, Typography } from '../../theme';

interface SettingsScreenProps {
    onBack: () => void;
    onLogout: () => void;
    onOpenHiddenContent: () => void;
}

// Renders the settings screen and exposes account-level actions.
export function SettingsScreen({ onBack, onLogout, onOpenHiddenContent }: SettingsScreenProps) {
    const { user, refreshUser } = useAuth();
    const [savingDatingMode, setSavingDatingMode] = useState(false);
    const datingEnabled = user?.connection_intents?.includes('dating') ?? false;

    const handleDatingModeChange = async (enabled: boolean): Promise<void> => {
        setSavingDatingMode(true);
        try {
            await api.updateMe({
                connection_intents: enabled ? ['friends', 'dating'] : ['friends'],
            });
            await refreshUser();
        } catch (error: unknown) {
            appAlert.alert(
                'Could not update Dating mode',
                error instanceof Error ? error.message : 'Please try again.',
            );
        } finally {
            setSavingDatingMode(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            {/* Settings currently exposes a single destructive action, but the grouped
                layout keeps room for more account/system options later. */}
            <ScreenHeader onBack={onBack} title="Settings" />

            <ScrollView style={styles.scroll} contentContainerStyle={screenStandards.detailContent}>
                <View style={screenStandards.sectionLabelBlockTight}>
                    <SectionLabel>DISCOVERY & CONNECTIONS</SectionLabel>
                </View>
                <View style={styles.group}>
                    <View style={[styles.row, styles.rowWithControl]}>
                        <View style={styles.rowCopy}>
                            <Text style={styles.rowText}>Dating mode</Text>
                            <Text style={styles.rowDescription}>
                                See and be shown in Dating only with people who also opted in.
                            </Text>
                        </View>
                        <Switch
                            value={datingEnabled}
                            onValueChange={handleDatingModeChange}
                            disabled={savingDatingMode}
                            trackColor={{ false: Colors.border.default, true: Colors.primarySubtle }}
                            thumbColor={datingEnabled ? Colors.primary : Colors.bg.surface}
                            ios_backgroundColor={Colors.border.default}
                        />
                    </View>
                </View>
                <View style={screenStandards.sectionLabelBlockTight}>
                    <SectionLabel>FEED</SectionLabel>
                </View>
                <View style={styles.group}>
                    <TouchableOpacity style={styles.row} onPress={onOpenHiddenContent}>
                        <Text style={styles.rowText}>Hidden content</Text>
                    </TouchableOpacity>
                </View>
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
    container: { flex: 1, backgroundColor: Colors.bg.page },
    scroll: { flex: 1 },
    group: {
        backgroundColor: Colors.bg.surface,
        borderRadius: Radius.lg,
        overflow: 'hidden',
    },
    row: {
        paddingHorizontal: Spacing.md,
        paddingVertical: 13,
    },
    rowWithControl: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    rowCopy: {
        flex: 1,
    },
    rowText: { fontSize: Typography.sizes.base, color: Colors.text.primary },
    rowDescription: {
        marginTop: Spacing.xs,
        fontSize: Typography.sizes.sm,
        lineHeight: 18,
        color: Colors.text.secondary,
    },
    logoutText: { fontSize: Typography.sizes.base, color: Colors.danger },
});
