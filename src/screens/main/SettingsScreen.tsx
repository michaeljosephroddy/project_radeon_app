import { appAlert } from '@/components/ui/appAlert';
import React, { useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { TextField } from '../../components/ui/TextField';
import { useAuth } from '../../hooks/useAuth';
import { screenStandards } from '../../styles/screenStandards';
import { Colors, Radius, Spacing, TargetSizes, TextStyles } from '../../theme';
import { LEGAL_DOCUMENTS, type LegalDocumentKey } from '../../utils/legalDocuments';

interface SettingsScreenProps {
    onBack: () => void;
    onLogout: () => void;
    onOpenHiddenContent: () => void;
    onOpenMutedAuthors: () => void;
    onOpenBlockedUsers: () => void;
    onOpenNotificationPreferences: () => void;
    onOpenLegalDocument: (documentKey: LegalDocumentKey) => void;
}

// Renders the settings screen and exposes account-level actions.
export function SettingsScreen({
    onBack,
    onLogout,
    onOpenHiddenContent,
    onOpenMutedAuthors,
    onOpenBlockedUsers,
    onOpenNotificationPreferences,
    onOpenLegalDocument,
}: SettingsScreenProps) {
    const { deleteAccount } = useAuth();
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deletingAccount, setDeletingAccount] = useState(false);
    const canSubmitDelete = deleteConfirmText.trim().toLowerCase() === 'delete';

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

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <ScreenHeader onBack={onBack} title="Settings" />

            <ScrollView style={styles.scroll} contentContainerStyle={screenStandards.detailContent}>
                <View style={styles.firstSectionLabel}>
                    <SectionLabel>NOTIFICATIONS</SectionLabel>
                </View>
                <View style={styles.group}>
                    <TouchableOpacity style={styles.row} onPress={onOpenNotificationPreferences}>
                        <Text style={styles.rowText}>Notifications</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.sectionLabel}>
                    <SectionLabel>SAFETY</SectionLabel>
                </View>
                <View style={styles.group}>
                    <TouchableOpacity style={styles.row} onPress={onOpenBlockedUsers}>
                        <Text style={styles.rowText}>Blocked users</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.sectionLabel}>
                    <SectionLabel>LEGAL & SUPPORT</SectionLabel>
                </View>
                <View style={styles.group}>
                    <TouchableOpacity style={styles.row} onPress={() => onOpenLegalDocument('terms')}>
                        <Text style={styles.rowText}>{LEGAL_DOCUMENTS.terms.label}</Text>
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <TouchableOpacity style={styles.row} onPress={() => onOpenLegalDocument('privacy')}>
                        <Text style={styles.rowText}>{LEGAL_DOCUMENTS.privacy.label}</Text>
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <TouchableOpacity style={styles.row} onPress={() => onOpenLegalDocument('guidelines')}>
                        <Text style={styles.rowText}>{LEGAL_DOCUMENTS.guidelines.label}</Text>
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <TouchableOpacity style={styles.row} onPress={() => onOpenLegalDocument('support')}>
                        <Text style={styles.rowText}>{LEGAL_DOCUMENTS.support.label}</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.sectionLabel}>
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
                <View style={styles.sectionLabel}>
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
    firstSectionLabel: {
        marginBottom: Spacing.sm,
    },
    sectionLabel: {
        marginTop: Spacing.lg,
        marginBottom: Spacing.sm,
    },
    group: {
        backgroundColor: Colors.bg.surface,
        borderRadius: Radius.lg,
        overflow: 'hidden',
    },
    row: {
        paddingHorizontal: Spacing.md,
        paddingVertical: 13,
    },
    rowText: { ...TextStyles.rowTitle },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: Colors.border.default,
    },
    logoutText: { ...TextStyles.rowTitle, color: Colors.danger },
    deleteText: { ...TextStyles.rowTitle, color: Colors.danger },
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
        ...TextStyles.sectionTitle,
        color: Colors.text.primary,
    },
    confirmCopy: {
        marginTop: Spacing.sm,
        ...TextStyles.body,
    },
    confirmPrompt: {
        marginTop: Spacing.lg,
        marginBottom: Spacing.sm,
        ...TextStyles.label,
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
        minHeight: TargetSizes.minimum,
        paddingHorizontal: Spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelText: {
        ...TextStyles.button,
        color: Colors.text.secondary,
    },
    deleteButton: {
        minWidth: 150,
    },
});
