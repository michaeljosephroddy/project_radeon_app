import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as api from '../../../api/client';
import { CREATE_SURFACE_HEADER_HEIGHT, CreateSurfaceHeader } from '../../../components/ui/CreateSurfaceHeader';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { TextField } from '../../../components/ui/TextField';
import { useCreateGroupMutation } from '../../../hooks/queries/useGroups';
import { Colors, ContentInsets, ControlSizes, Radius, Spacing, TextStyles } from '../../../theme';

interface GroupCreateScreenProps {
    onBack: () => void;
    onCreated: (group: api.Group) => void;
}

interface GroupFocusOption {
    label: string;
    tag?: string;
    recoveryPathway?: string;
}

const FOCUS_OPTIONS: GroupFocusOption[] = [
    { label: 'Alcohol-free', tag: 'alcohol-free' },
    { label: 'Early recovery', recoveryPathway: 'early-recovery' },
    { label: 'SMART', recoveryPathway: 'smart' },
    { label: 'AA', recoveryPathway: 'aa' },
    { label: 'LGBTQ+', tag: 'lgbtq' },
    { label: 'Women', tag: 'women' },
    { label: 'Local', tag: 'local' },
];

export function GroupCreateScreen({
    onBack,
    onCreated,
}: GroupCreateScreenProps): React.ReactElement {
    const createGroupMutation = useCreateGroupMutation();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [rules, setRules] = useState('');
    const [country, setCountry] = useState('');
    const [city, setCity] = useState('');
    const [visibility, setVisibility] = useState<api.GroupVisibility>('public');
    const [postingPermission, setPostingPermission] = useState<api.GroupPostingPermission>('members');
    const [selectedFocus, setSelectedFocus] = useState<GroupFocusOption[]>([]);

    const trimmedName = name.trim();
    const canSubmit = trimmedName.length >= 3 && !createGroupMutation.isPending;

    const selectedTags = useMemo(
        () => selectedFocus.map(item => item.tag).filter((tag): tag is string => Boolean(tag)),
        [selectedFocus],
    );
    const selectedPathways = useMemo(
        () => selectedFocus.map(item => item.recoveryPathway).filter((pathway): pathway is string => Boolean(pathway)),
        [selectedFocus],
    );

    const toggleFocus = (option: GroupFocusOption): void => {
        setSelectedFocus(current => {
            const isSelected = current.some(item => item.label === option.label);
            if (isSelected) return current.filter(item => item.label !== option.label);
            return [...current, option];
        });
    };

    const handleCreate = async (): Promise<void> => {
        if (!canSubmit) return;

        try {
            const group = await createGroupMutation.mutateAsync({
                name: trimmedName,
                description: description.trim() || null,
                rules: rules.trim() || null,
                visibility,
                posting_permission: postingPermission,
                city: city.trim() || null,
                country: country.trim() || null,
                tags: selectedTags,
                recovery_pathways: selectedPathways,
            });
            onCreated(group);
        } catch (error: unknown) {
            Alert.alert(
                'Could not create group',
                error instanceof Error ? error.message : 'Something went wrong.',
            );
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <KeyboardAvoidingView
                style={styles.keyboardAvoiding}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <CreateSurfaceHeader
                    title="Create group"
                    onBack={onBack}
                    trailing={(
                        <TouchableOpacity
                            style={[styles.headerAction, !canSubmit && styles.disabled]}
                            onPress={handleCreate}
                            disabled={!canSubmit}
                        >
                            {createGroupMutation.isPending ? (
                                <ActivityIndicator size="small" color={Colors.primary} />
                            ) : (
                                <Text style={styles.headerActionText}>Create</Text>
                            )}
                        </TouchableOpacity>
                    )}
                />
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Basics</Text>
                        <TextField
                            value={name}
                            onChangeText={setName}
                            placeholder="Group name"
                            autoCapitalize="words"
                            returnKeyType="next"
                        />
                        <TextField
                            value={description}
                            onChangeText={setDescription}
                            placeholder="What is this group for?"
                            multiline
                            style={styles.descriptionInput}
                        />
                    </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Access</Text>
                    <SegmentedControl
                        items={[
                            { key: 'public', label: 'Public' },
                            { key: 'approval_required', label: 'Approval' },
                            { key: 'invite_only', label: 'Invite' },
                        ]}
                        activeKey={visibility}
                        onChange={(next) => setVisibility(next as api.GroupVisibility)}
                    />
                    <SegmentedControl
                        items={[
                            { key: 'members', label: 'Members can post' },
                            { key: 'admins', label: 'Admins only' },
                        ]}
                        activeKey={postingPermission}
                        onChange={(next) => setPostingPermission(next as api.GroupPostingPermission)}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Focus</Text>
                    <View style={styles.focusGrid}>
                        {FOCUS_OPTIONS.map(option => {
                            const selected = selectedFocus.some(item => item.label === option.label);
                            return (
                                <TouchableOpacity
                                    key={option.label}
                                    style={[styles.focusChip, selected && styles.focusChipSelected]}
                                    onPress={() => toggleFocus(option)}
                                    activeOpacity={0.86}
                                >
                                    <Text style={[styles.focusChipText, selected && styles.focusChipTextSelected]}>
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Location</Text>
                    <View style={styles.locationRow}>
                        <TextField
                            value={city}
                            onChangeText={setCity}
                            placeholder="City"
                            style={styles.locationInput}
                        />
                        <TextField
                            value={country}
                            onChangeText={setCountry}
                            placeholder="Country"
                            style={styles.locationInput}
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Rules</Text>
                    <TextField
                        value={rules}
                        onChangeText={setRules}
                        placeholder="Optional group rules"
                        multiline
                        style={styles.rulesInput}
                    />
                </View>

                    <TouchableOpacity
                        style={[styles.primaryButton, !canSubmit && styles.disabled]}
                        onPress={handleCreate}
                        disabled={!canSubmit}
                    >
                        {createGroupMutation.isPending ? (
                            <ActivityIndicator color={Colors.textOn.primary} />
                        ) : (
                            <>
                                <Ionicons name="people-outline" size={18} color={Colors.textOn.primary} />
                                <Text style={styles.primaryButtonText}>Create group</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    keyboardAvoiding: {
        flex: 1,
    },
    headerAction: {
        minHeight: ControlSizes.iconButton,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerActionText: {
        ...TextStyles.chip,
        color: Colors.primary,
        fontWeight: '800',
    },
    scroll: {
        flex: 1,
    },
    content: {
        paddingHorizontal: ContentInsets.screenHorizontal,
        paddingTop: CREATE_SURFACE_HEADER_HEIGHT + Spacing.md,
        paddingBottom: ContentInsets.detailBottom + ControlSizes.fabMinHeight + Spacing.xl,
        gap: Spacing.lg,
    },
    section: {
        gap: Spacing.sm,
    },
    sectionTitle: {
        ...TextStyles.label,
        fontWeight: '800',
    },
    descriptionInput: {
        minHeight: 108,
        textAlignVertical: 'top',
    },
    rulesInput: {
        minHeight: 128,
        textAlignVertical: 'top',
    },
    focusGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    focusChip: {
        minHeight: ControlSizes.chipMinHeight,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.pill,
        backgroundColor: Colors.bg.surface,
        paddingHorizontal: Spacing.md,
    },
    focusChipSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primarySubtle,
    },
    focusChipText: {
        ...TextStyles.chip,
    },
    focusChipTextSelected: {
        color: Colors.primary,
        fontWeight: '800',
    },
    locationRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    locationInput: {
        flex: 1,
    },
    primaryButton: {
        minHeight: ControlSizes.fabMinHeight,
        borderRadius: Radius.pill,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: Spacing.xs,
        paddingHorizontal: Spacing.lg,
    },
    primaryButtonText: {
        ...TextStyles.button,
    },
    disabled: {
        opacity: 0.5,
    },
});
