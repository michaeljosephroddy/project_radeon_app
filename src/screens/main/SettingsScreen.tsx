import { appAlert } from '@/components/ui/appAlert';
import React, { useState } from 'react';
import {
    Modal,
    Linking,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as api from '../../api/client';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { TextField } from '../../components/ui/TextField';
import { useAuth } from '../../hooks/useAuth';
import { screenStandards } from '../../styles/screenStandards';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import { LEGAL_LINKS, type LegalLink } from '../../utils/legalLinks';

interface SettingsScreenProps {
    onBack: () => void;
    onLogout: () => void;
    onOpenHiddenContent: () => void;
    onOpenMutedAuthors: () => void;
    onOpenBlockedUsers: () => void;
    onOpenNotificationPreferences: () => void;
}

// Renders the settings screen and exposes account-level actions.
export function SettingsScreen({
    onBack,
    onLogout,
    onOpenHiddenContent,
    onOpenMutedAuthors,
    onOpenBlockedUsers,
    onOpenNotificationPreferences,
}: SettingsScreenProps) {
    const { user, refreshUser, deleteAccount } = useAuth();
    const [savingDatingMode, setSavingDatingMode] = useState(false);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deletingAccount, setDeletingAccount] = useState(false);
    const datingEnabled = user?.connection_intents?.includes('dating') ?? false;
    const canSubmitDelete = deleteConfirmText.trim().toLowerCase() === 'delete';

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

    const handleOpenDeleteConfirm = (): void => {
        setDeleteConfirmText('');
        setDeleteConfirmVisible(true);
    };

    const handleCloseDeleteConfirm = (): void => {
        if (deletingAccount) return;
        setDeleteConfirmVisible(false);
        setDeleteConfirmText('');
    };

    const handleDeleteAccount = async (): Promise<void> => {
        if (!canSubmitDelete || deletingAccount) return;

        setDeletingAccount(true);
        try {
            await deleteAccount();
        } catch (error: unknown) {
            appAlert.alert(
                'Could not delete account',
                error instanceof Error ? error.message : 'Please try again.',
            );
            setDeletingAccount(false);
        }
    };

    const openLegalLink = async (link: LegalLink): Promise<void> => {
        try {
            await Linking.openURL(link.url);
        } catch {
            appAlert.alert('Could not open link', link.url);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
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
                    <SectionLabel>NOTIFICATIONS</SectionLabel>
                </View>
                <View style={styles.group}>
                    <TouchableOpacity style={styles.row} onPress={onOpenNotificationPreferences}>
                        <Text style={styles.rowText}>Notifications</Text>
                    </TouchableOpacity>
                </View>
                <View style={screenStandards.sectionLabelBlockTight}>
                    <SectionLabel>SAFETY</SectionLabel>
                </View>
                <View style={styles.group}>
                    <TouchableOpacity style={styles.row} onPress={onOpenBlockedUsers}>
                        <Text style={styles.rowText}>Blocked users</Text>
                    </TouchableOpacity>
                </View>
                <View style={screenStandards.sectionLabelBlockTight}>
                    <SectionLabel>LEGAL & SUPPORT</SectionLabel>
                </View>
                <View style={styles.group}>
                    <TouchableOpacity style={styles.row} onPress={() => { void openLegalLink(LEGAL_LINKS.terms); }}>
                        <Text style={styles.rowText}>{LEGAL_LINKS.terms.label}</Text>
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <TouchableOpacity style={styles.row} onPress={() => { void openLegalLink(LEGAL_LINKS.privacy); }}>
                        <Text style={styles.rowText}>{LEGAL_LINKS.privacy.label}</Text>
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <TouchableOpacity style={styles.row} onPress={() => { void openLegalLink(LEGAL_LINKS.guidelines); }}>
                        <Text style={styles.rowText}>{LEGAL_LINKS.guidelines.label}</Text>
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <TouchableOpacity style={styles.row} onPress={() => { void openLegalLink(LEGAL_LINKS.support); }}>
                        <Text style={styles.rowText}>{LEGAL_LINKS.support.label}</Text>
                    </TouchableOpacity>
                </View>
                <View style={screenStandards.sectionLabelBlockTight}>
                    <SectionLabel>FEED</SectionLabel>
                </View>
                <View style={styles.group}>
                    <TouchableOpacity style={styles.row} onPress={onOpenHiddenContent}>
                        <Text style={styles.rowText}>Hidden content</Text>
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <TouchableOpacity style={styles.row} onPress={onOpenMutedAuthors}>
                        <Text style={styles.rowText}>Muted authors</Text>
                    </TouchableOpacity>
                </View>
                <View style={screenStandards.sectionLabelBlockTight}>
                    <SectionLabel>ACCOUNT</SectionLabel>
                </View>
                <View style={styles.group}>
                    <TouchableOpacity style={styles.row} onPress={onLogout}>
                        <Text style={styles.logoutText}>Log out</Text>
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <TouchableOpacity style={styles.row} onPress={handleOpenDeleteConfirm}>
                        <Text style={styles.deleteText}>Delete account</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <Modal
                animationType="fade"
                transparent
                visible={deleteConfirmVisible}
                onRequestClose={handleCloseDeleteConfirm}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.confirmPanel}>
                        <Text style={styles.confirmTitle}>Delete account</Text>
                        <Text style={styles.confirmCopy}>
                            This permanently deletes your account access, removes your private profile details, and signs you out.
                        </Text>
                        <Text style={styles.confirmPrompt}>Type delete to confirm.</Text>
                        <TextField
                            value={deleteConfirmText}
                            onChangeText={setDeleteConfirmText}
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!deletingAccount}
                            placeholder="delete"
                            returnKeyType="done"
                            style={styles.confirmInput}
                        />
                        <View style={styles.confirmActions}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={handleCloseDeleteConfirm}
                                disabled={deletingAccount}
                            >
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <PrimaryButton
                                label="Delete account"
                                variant="danger"
                                onPress={handleDeleteAccount}
                                disabled={!canSubmitDelete}
                                loading={deletingAccount}
                                style={styles.deleteButton}
                            />
                        </View>
                    </View>
                </View>
            </Modal>
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
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: Colors.border.default,
        marginLeft: Spacing.md,
    },
    rowDescription: {
        marginTop: Spacing.xs,
        fontSize: Typography.sizes.sm,
        lineHeight: 18,
        color: Colors.text.secondary,
    },
    logoutText: { fontSize: Typography.sizes.base, color: Colors.danger },
    deleteText: { fontSize: Typography.sizes.base, color: Colors.danger },
    modalOverlay: {
        flex: 1,
        backgroundColor: Colors.overlay,
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.lg,
    },
    confirmPanel: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: Colors.bg.surface,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
    },
    confirmTitle: {
        fontSize: Typography.sizes.xl,
        fontWeight: Typography.weights.bold,
        color: Colors.text.primary,
    },
    confirmCopy: {
        marginTop: Spacing.sm,
        fontSize: Typography.sizes.base,
        lineHeight: 22,
        color: Colors.text.secondary,
    },
    confirmPrompt: {
        marginTop: Spacing.lg,
        marginBottom: Spacing.sm,
        fontSize: Typography.sizes.sm,
        color: Colors.text.primary,
    },
    confirmInput: {
        width: '100%',
    },
    confirmActions: {
        marginTop: Spacing.lg,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: Spacing.sm,
    },
    cancelButton: {
        minHeight: 44,
        paddingHorizontal: Spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelText: {
        fontSize: Typography.sizes.base,
        color: Colors.text.secondary,
    },
    deleteButton: {
        minWidth: 150,
    },
});
