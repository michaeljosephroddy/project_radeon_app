import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as api from '../../../api/client';
import { CREATE_SURFACE_HEADER_HEIGHT, CreateSurfaceHeader } from '../../../components/ui/CreateSurfaceHeader';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { TextField } from '../../../components/ui/TextField';
import { useCreateGroupMutation } from '../../../hooks/queries/useGroups';
import { useGradualKeyboardInset } from '../../../hooks/useGradualKeyboardInset';
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

interface SelectedGroupImage {
    uri: string;
    mimeType: string;
    fileName: string;
}

interface GroupImageState {
    localImage: SelectedGroupImage;
    status: 'uploading' | 'uploaded' | 'failed';
    uploadedAvatarUrl?: string;
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
    const [selectedImage, setSelectedImage] = useState<GroupImageState | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const uploadPromiseRef = useRef<Promise<api.GroupImageUploadResult> | null>(null);
    const { height: keyboardInsetHeight } = useGradualKeyboardInset({
        closedHeight: 0,
        openedOffset: Spacing.sm,
    });
    const keyboardSpacerStyle = useAnimatedStyle((): { height: number } => ({
        height: keyboardInsetHeight.value,
    }));

    const trimmedName = name.trim();
    const isCreating = createGroupMutation.isPending || submitting;
    const canSubmit = trimmedName.length >= 3 && !isCreating;

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

    const beginImageUpload = useCallback((image: SelectedGroupImage): Promise<api.GroupImageUploadResult> => {
        const uploadPromise = api.uploadGroupImage({
            uri: image.uri,
            mimeType: image.mimeType,
            fileName: image.fileName,
        });
        uploadPromiseRef.current = uploadPromise;

        void uploadPromise
            .then((uploaded) => {
                setSelectedImage((current) => {
                    if (!current || current.localImage.uri !== image.uri) return current;
                    return {
                        ...current,
                        status: 'uploaded',
                        uploadedAvatarUrl: uploaded.avatar_url,
                    };
                });
            })
            .catch(() => {
                setSelectedImage((current) => {
                    if (!current || current.localImage.uri !== image.uri) return current;
                    return { ...current, status: 'failed' };
                });
            });

        return uploadPromise;
    }, []);

    const handlePickImage = useCallback(async (): Promise<void> => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('Permission required', 'Allow photo library access to add a group image.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.75,
        });
        if (result.canceled) return;

        const asset = result.assets[0];
        const nextImage: SelectedGroupImage = {
            uri: asset.uri,
            mimeType: asset.mimeType ?? inferMimeType(asset.uri),
            fileName: asset.fileName ?? inferFileName(asset.uri, 'group.jpg'),
        };
        setSelectedImage({ localImage: nextImage, status: 'uploading' });
        beginImageUpload(nextImage).catch(() => {});
    }, [beginImageUpload]);

    const handleRetryImageUpload = useCallback((): void => {
        setSelectedImage((current) => {
            if (!current) return current;
            beginImageUpload(current.localImage).catch(() => {});
            return { ...current, status: 'uploading' };
        });
    }, [beginImageUpload]);

    const handleRemoveImage = useCallback((): void => {
        uploadPromiseRef.current = null;
        setSelectedImage(null);
    }, []);

    const handleCreate = async (): Promise<void> => {
        if (!canSubmit) return;

        setSubmitting(true);
        try {
            let avatarURL: string | null = null;
            if (selectedImage) {
                if (selectedImage.uploadedAvatarUrl) {
                    avatarURL = selectedImage.uploadedAvatarUrl;
                } else if (selectedImage.status === 'uploading' && uploadPromiseRef.current) {
                    const uploaded = await waitForImageUpload(uploadPromiseRef.current, 8000);
                    if (uploaded?.avatar_url) {
                        avatarURL = uploaded.avatar_url;
                    } else {
                        const continueWithoutImage = await confirmContinueWithoutImage();
                        if (!continueWithoutImage) return;
                    }
                } else {
                    const continueWithoutImage = await confirmContinueWithoutImage();
                    if (!continueWithoutImage) return;
                }
            }

            const group = await createGroupMutation.mutateAsync({
                name: trimmedName,
                description: description.trim() || null,
                rules: rules.trim() || null,
                avatar_url: avatarURL,
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
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <CreateSurfaceHeader
                title="Create group"
                onBack={onBack}
                trailing={(
                    <TouchableOpacity
                        style={[styles.headerAction, !canSubmit && styles.disabled]}
                        onPress={handleCreate}
                        disabled={!canSubmit}
                    >
                        {isCreating ? (
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
                keyboardDismissMode="interactive"
                automaticallyAdjustKeyboardInsets={false}
            >
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Group photo</Text>
                    <View style={styles.imageRow}>
                        <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage} activeOpacity={0.9}>
                            {selectedImage ? (
                                <Image source={{ uri: selectedImage.localImage.uri }} style={styles.imagePreview} />
                            ) : (
                                <Ionicons name="image-outline" size={24} color={Colors.text.muted} />
                            )}
                        </TouchableOpacity>
                        <View style={styles.imageActions}>
                            <TouchableOpacity style={styles.imageButton} onPress={handlePickImage}>
                                <Text style={styles.imageButtonText}>{selectedImage ? 'Replace image' : 'Add image'}</Text>
                            </TouchableOpacity>
                            {selectedImage?.status === 'uploading' ? (
                                <View style={styles.imageUploadStatus}>
                                    <ActivityIndicator size="small" color={Colors.primary} />
                                    <Text style={styles.imageUploadText}>Uploading…</Text>
                                </View>
                            ) : null}
                            {selectedImage?.status === 'failed' ? (
                                <View style={styles.imageFailureActions}>
                                    <TouchableOpacity style={styles.imageSecondaryButton} onPress={handleRetryImageUpload}>
                                        <Text style={styles.imageSecondaryButtonText}>Retry</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.imageSecondaryButton} onPress={handleRemoveImage}>
                                        <Text style={styles.imageSecondaryButtonText}>Remove</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : null}
                        </View>
                    </View>
                </View>

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
                    {isCreating ? (
                        <ActivityIndicator color={Colors.textOn.primary} />
                    ) : (
                        <>
                            <Ionicons name="people-outline" size={18} color={Colors.textOn.primary} />
                            <Text style={styles.primaryButtonText}>Create group</Text>
                        </>
                    )}
                </TouchableOpacity>
            </ScrollView>
            <Animated.View style={[styles.keyboardSpacer, keyboardSpacerStyle]} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
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
    keyboardSpacer: {
        flexShrink: 0,
        backgroundColor: Colors.bg.page,
    },
    content: {
        paddingHorizontal: ContentInsets.screenHorizontal,
        paddingTop: CREATE_SURFACE_HEADER_HEIGHT + Spacing.md,
        paddingBottom: Spacing.lg,
        gap: Spacing.lg,
    },
    section: {
        gap: Spacing.sm,
    },
    imageRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    imagePicker: {
        width: 76,
        height: 76,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    imagePreview: {
        width: '100%',
        height: '100%',
    },
    imageActions: {
        flex: 1,
        gap: Spacing.xs,
    },
    imageButton: {
        alignSelf: 'flex-start',
        minHeight: ControlSizes.iconButton,
        borderRadius: Radius.pill,
        backgroundColor: Colors.primarySubtle,
        borderWidth: 1,
        borderColor: Colors.primary,
        justifyContent: 'center',
        paddingHorizontal: Spacing.md,
    },
    imageButtonText: {
        ...TextStyles.button,
        color: Colors.primary,
        fontSize: TextStyles.chip.fontSize,
    },
    imageUploadStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    imageUploadText: {
        ...TextStyles.caption,
    },
    imageFailureActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    imageSecondaryButton: {
        minHeight: ControlSizes.chipMinHeight,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.border.default,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.sm,
    },
    imageSecondaryButtonText: {
        ...TextStyles.badge,
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

function inferMimeType(uri: string | undefined, fallback = 'image/jpeg'): string {
    const normalized = uri?.toLowerCase() ?? '';
    if (normalized.endsWith('.png')) return 'image/png';
    if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
    return fallback;
}

function inferFileName(uri: string | undefined, fallback: string): string {
    if (!uri) return fallback;
    const segment = uri.split('/').pop()?.split('?')[0];
    return segment && segment.includes('.') ? segment : fallback;
}

function confirmContinueWithoutImage(): Promise<boolean> {
    return new Promise((resolve) => {
        Alert.alert(
            'Image not ready',
            'The group photo upload is still processing or failed. Create the group now without a photo, or retry upload first.',
            [
                { text: 'Retry upload', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Create without photo', onPress: () => resolve(true) },
            ],
            { cancelable: false },
        );
    });
}

function waitForImageUpload(
    uploadPromise: Promise<api.GroupImageUploadResult>,
    timeoutMs: number,
): Promise<api.GroupImageUploadResult | null> {
    return new Promise((resolve) => {
        let settled = false;
        const timeoutId = setTimeout(() => {
            if (settled) return;
            settled = true;
            resolve(null);
        }, timeoutMs);

        void uploadPromise
            .then((result) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                resolve(result);
            })
            .catch(() => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                resolve(null);
            });
    });
}
