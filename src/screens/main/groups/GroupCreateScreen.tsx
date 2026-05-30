import { appAlert } from '@/components/ui/appAlert';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as api from '../../../api/client';
import { CreateFlowFrame } from '../../../components/ui/CreateFlowFrame';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { TextField } from '../../../components/ui/TextField';
import { useCreateGroupMutation } from '../../../hooks/queries/useGroups';
import { Colors, ControlSizes, IconSizes, Radius, Spacing, TextStyles } from '../../../theme';

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

type GroupCreateStep = 'identity' | 'setup' | 'guidelines' | 'review';

interface GroupCreateStepMeta {
    key: GroupCreateStep;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
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

const GROUP_CREATE_STEPS: GroupCreateStepMeta[] = [
    { key: 'identity', label: 'Identity', icon: 'image-outline' },
    { key: 'setup', label: 'Setup', icon: 'options-outline' },
    { key: 'guidelines', label: 'Guidelines', icon: 'document-text-outline' },
    { key: 'review', label: 'Review', icon: 'checkmark-circle-outline' },
];

function getStepSubtitle(step: GroupCreateStep): string {
    if (step === 'identity') return 'Name the group and shape its first impression.';
    if (step === 'setup') return 'Choose how members can post and describe the group focus.';
    if (step === 'guidelines') return 'Add optional location and expectations.';
    return 'Confirm the details before the group goes live.';
}

function getPostingPermissionLabel(permission: api.GroupPostingPermission): string {
    return permission === 'admins' ? 'Admins only' : 'Members can post';
}

function getFocusSummary(selectedFocus: GroupFocusOption[]): string {
    if (!selectedFocus.length) return 'No focus selected';
    return selectedFocus.map((item) => item.label).join(', ');
}

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
    const [postingPermission, setPostingPermission] = useState<api.GroupPostingPermission>('members');
    const [selectedFocus, setSelectedFocus] = useState<GroupFocusOption[]>([]);
    const [selectedImage, setSelectedImage] = useState<GroupImageState | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [formError, setFormError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const uploadPromiseRef = useRef<Promise<api.GroupImageUploadResult> | null>(null);
    const trimmedName = name.trim();
    const currentStep = GROUP_CREATE_STEPS[currentStepIndex]?.key ?? 'identity';
    const isCreating = createGroupMutation.isPending || submitting;
    const canSubmit = trimmedName.length >= 3 && !isCreating;
    const hasDraft = trimmedName.length > 0
        || description.trim().length > 0
        || rules.trim().length > 0
        || country.trim().length > 0
        || city.trim().length > 0
        || postingPermission !== 'members'
        || selectedFocus.length > 0
        || selectedImage !== null;
    const nameHasError = Boolean(formError) && currentStep === 'identity' && trimmedName.length < 3;

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
            appAlert.alert('Permission required', 'Allow photo library access to add a group image.');
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
        if (!canSubmit) {
            setFormError('Group name must be at least 3 characters.');
            setCurrentStepIndex(0);
            return;
        }

        setFormError(null);
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
                posting_permission: postingPermission,
                city: city.trim() || null,
                country: country.trim() || null,
                tags: selectedTags,
                recovery_pathways: selectedPathways,
            });
            appAlert.alert('Group created', `${group.name} is live.`);
            onCreated(group);
        } catch (error: unknown) {
            appAlert.alert(
                'Could not create group',
                error instanceof Error ? error.message : 'Something went wrong.',
            );
        } finally {
            setSubmitting(false);
        }
    };

    const validateCurrentStep = (): boolean => {
        if (currentStep === 'identity' && trimmedName.length < 3) {
            setFormError('Group name must be at least 3 characters.');
            return false;
        }
        setFormError(null);
        return true;
    };

    const handlePrimaryAction = (): void => {
        if (currentStep === 'review') {
            void handleCreate();
            return;
        }
        if (!validateCurrentStep()) return;
        setCurrentStepIndex((index) => Math.min(index + 1, GROUP_CREATE_STEPS.length - 1));
    };

    const handleBackStep = (): void => {
        setFormError(null);
        setCurrentStepIndex((index) => Math.max(index - 1, 0));
    };

    const handleClose = (): void => {
        if (!hasDraft || isCreating) {
            onBack();
            return;
        }

        appAlert.alert('Discard group?', 'Your current group draft will be lost.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Discard', style: 'destructive', onPress: onBack },
        ]);
    };

    const renderImagePicker = (): React.ReactElement => (
        <View style={styles.imagePanel}>
            <TouchableOpacity style={styles.imageHero} onPress={handlePickImage} activeOpacity={0.9}>
                {selectedImage ? (
                    <Image source={{ uri: selectedImage.localImage.uri }} style={styles.imagePreview} />
                ) : (
                    <View style={styles.imagePlaceholder}>
                        <Ionicons name="image-outline" size={IconSizes.primaryAction} color={Colors.primary} />
                        <Text style={styles.imagePlaceholderTitle}>Add group image</Text>
                        <Text style={styles.imagePlaceholderText}>Use a photo or graphic that members will recognize.</Text>
                    </View>
                )}
                <View style={styles.imageOverlayButton}>
                    <Ionicons name={selectedImage ? 'camera-outline' : 'add'} size={IconSizes.inline} color={Colors.textOn.primary} />
                    <Text style={styles.imageOverlayText}>{selectedImage ? 'Replace' : 'Upload'}</Text>
                </View>
            </TouchableOpacity>
            {selectedImage?.status === 'uploading' ? (
                <View style={styles.imageStatusRow}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={styles.imageStatusText}>Uploading image...</Text>
                </View>
            ) : null}
            {selectedImage?.status === 'failed' ? (
                <View style={styles.imageFailureActions}>
                    <TouchableOpacity style={styles.imageSecondaryButton} onPress={handleRetryImageUpload} activeOpacity={0.84}>
                        <Text style={styles.imageSecondaryButtonText}>Retry upload</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.imageSecondaryButton} onPress={handleRemoveImage} activeOpacity={0.84}>
                        <Text style={styles.imageSecondaryButtonText}>Remove</Text>
                    </TouchableOpacity>
                </View>
            ) : null}
            {selectedImage?.status === 'uploaded' ? (
                <TouchableOpacity style={[styles.imageSecondaryButton, styles.imageRemoveButton]} onPress={handleRemoveImage} activeOpacity={0.84}>
                    <Text style={styles.imageSecondaryButtonText}>Remove image</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );

    const renderStepContent = (): React.ReactNode => {
        if (currentStep === 'identity') {
            return (
                <>
                    {renderImagePicker()}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Basics</Text>
                        <TextField
                            value={name}
                            onChangeText={(value) => {
                                setName(value);
                                if (formError) setFormError(null);
                            }}
                            placeholder="Group name"
                            autoCapitalize="words"
                            returnKeyType="next"
                            style={nameHasError && styles.inputError}
                        />
                        <TextField
                            value={description}
                            onChangeText={setDescription}
                            placeholder="What is this group for?"
                            multiline
                            style={styles.descriptionInput}
                        />
                    </View>
                </>
            );
        }

        if (currentStep === 'setup') {
            return (
                <>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Posting</Text>
                        <SegmentedControl
                            items={[
                                { key: 'members', label: 'Members can post' },
                                { key: 'admins', label: 'Admins only' },
                            ]}
                            activeKey={postingPermission}
                            onChange={(next) => setPostingPermission(next as api.GroupPostingPermission)}
                            layer="form"
                            tone="secondary"
                        />
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Focus</Text>
                        <View style={styles.focusGrid}>
                            {FOCUS_OPTIONS.map((option) => {
                                const selected = selectedFocus.some((item) => item.label === option.label);
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
                </>
            );
        }

        if (currentStep === 'guidelines') {
            return (
                <>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Location</Text>
                        <View style={styles.locationRow}>
                            <TextField
                                value={city}
                                onChangeText={setCity}
                                placeholder="City (optional)"
                                style={styles.locationInput}
                            />
                            <TextField
                                value={country}
                                onChangeText={setCountry}
                                placeholder="Country (optional)"
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
                </>
            );
        }

        return (
            <>
                <View style={styles.reviewHero}>
                    {selectedImage ? (
                        <Image source={{ uri: selectedImage.localImage.uri }} style={styles.reviewImage} />
                    ) : (
                        <View style={styles.reviewImageFallback}>
                            <Ionicons name="people-outline" size={IconSizes.primaryAction} color={Colors.primary} />
                        </View>
                    )}
                    <View style={styles.reviewHeroBody}>
                        <Text style={styles.reviewTitle}>{trimmedName || 'Untitled group'}</Text>
                        <Text style={styles.reviewDescription} numberOfLines={3}>
                            {description.trim() || 'No description added.'}
                        </Text>
                    </View>
                </View>

                <View style={styles.reviewSection}>
                    <ReviewRow label="Posting" value={getPostingPermissionLabel(postingPermission)} />
                    <ReviewRow label="Focus" value={getFocusSummary(selectedFocus)} />
                    <ReviewRow label="Location" value={[city.trim(), country.trim()].filter(Boolean).join(', ') || 'No location set'} />
                    <ReviewRow label="Rules" value={rules.trim() || 'No rules added'} last />
                </View>
            </>
        );
    };

    return (
        <CreateFlowFrame
            title="Create group"
            onBack={handleClose}
            footer={(
                <View style={styles.footerActionRow}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={currentStepIndex > 0 ? handleBackStep : handleClose}
                        activeOpacity={0.84}
                        disabled={isCreating}
                    >
                        {currentStepIndex > 0 ? <Ionicons name="chevron-back" size={IconSizes.row} color={Colors.primary} /> : null}
                        <Text style={styles.backButtonText}>{currentStepIndex > 0 ? 'Back' : 'Cancel'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.primaryButton, isCreating && styles.disabled]}
                        onPress={handlePrimaryAction}
                        activeOpacity={0.86}
                        disabled={isCreating}
                    >
                        {isCreating ? (
                            <ActivityIndicator color={Colors.textOn.primary} />
                        ) : (
                            <>
                                <Text style={styles.primaryButtonText}>{currentStep === 'review' ? 'Create group' : 'Next'}</Text>
                                <Ionicons name="chevron-forward" size={IconSizes.row} color={Colors.textOn.primary} />
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        >
                <View style={styles.progressBlock}>
                    <Text style={styles.progressText}>{`${GROUP_CREATE_STEPS[currentStepIndex]?.label ?? 'Step'} ${currentStepIndex + 1} of ${GROUP_CREATE_STEPS.length}`}</Text>
                    <View style={styles.progressTrack}>
                        {GROUP_CREATE_STEPS.map((item, index) => (
                            <View
                                key={item.key}
                                style={[
                                    styles.progressSegment,
                                    index <= currentStepIndex && styles.progressSegmentActive,
                                ]}
                            />
                        ))}
                    </View>
                    <View style={styles.stepTitleRow}>
                        <View style={styles.stepIcon}>
                            <Ionicons name={GROUP_CREATE_STEPS[currentStepIndex]?.icon ?? 'people-outline'} size={IconSizes.row} color={Colors.primary} />
                        </View>
                        <View style={styles.stepCopy}>
                            <Text style={styles.stepTitle}>{GROUP_CREATE_STEPS[currentStepIndex]?.label ?? 'Group'}</Text>
                            <Text style={styles.stepSubtitle}>{getStepSubtitle(currentStep)}</Text>
                        </View>
                    </View>
                </View>

                {formError ? (
                    <View style={styles.errorCard}>
                        <Text style={styles.errorText}>{formError}</Text>
                    </View>
                ) : null}

                <Animated.View
                    key={currentStep}
                    entering={FadeIn.duration(160)}
                    exiting={FadeOut.duration(100)}
                    style={styles.stepContent}
                >
                    {renderStepContent()}
                </Animated.View>
        </CreateFlowFrame>
    );
}

function ReviewRow({ label, value, last = false }: { label: string; value: string; last?: boolean }): React.ReactElement {
    return (
        <View style={[styles.reviewRow, last && styles.reviewRowLast]}>
            <Text style={styles.reviewLabel}>{label}</Text>
            <Text style={styles.reviewValue}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    progressBlock: {
        gap: Spacing.sm,
    },
    stepContent: {
        gap: Spacing.lg,
    },
    progressText: {
        ...TextStyles.caption,
        color: Colors.primary,
    },
    progressTrack: {
        flexDirection: 'row',
        gap: Spacing.xs,
    },
    progressSegment: {
        flex: 1,
        height: 4,
        borderRadius: Radius.pill,
        backgroundColor: Colors.border.default,
    },
    progressSegmentActive: {
        backgroundColor: Colors.primary,
    },
    stepTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    stepIcon: {
        width: 38,
        height: 38,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primarySubtle,
    },
    stepCopy: {
        flex: 1,
        gap: 2,
    },
    stepTitle: {
        ...TextStyles.sectionTitle,
    },
    stepSubtitle: {
        ...TextStyles.secondary,
    },
    errorCard: {
        borderRadius: Radius.lg,
        backgroundColor: Colors.dangerSubtle,
        borderWidth: 1,
        borderColor: Colors.danger,
        padding: Spacing.md,
    },
    errorText: {
        color: Colors.danger,
        fontSize: TextStyles.caption.fontSize,
        fontWeight: '700',
    },
    section: {
        gap: Spacing.sm,
        padding: Spacing.md,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
    },
    imagePanel: {
        gap: Spacing.sm,
    },
    imageHero: {
        minHeight: 218,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
        overflow: 'hidden',
    },
    imagePreview: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
    },
    imagePlaceholder: {
        flex: 1,
        minHeight: 218,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.lg,
    },
    imagePlaceholderTitle: {
        ...TextStyles.cardTitle,
    },
    imagePlaceholderText: {
        ...TextStyles.secondary,
        textAlign: 'center',
    },
    imageOverlayButton: {
        position: 'absolute',
        right: Spacing.md,
        bottom: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        paddingVertical: 9,
        backgroundColor: 'rgba(0,0,0,0.62)',
    },
    imageOverlayText: {
        color: Colors.textOn.primary,
        fontSize: TextStyles.caption.fontSize,
        fontWeight: '800',
    },
    imageStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    imageStatusText: {
        ...TextStyles.caption,
        color: Colors.text.secondary,
    },
    imageFailureActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    imageRemoveButton: {
        alignSelf: 'flex-start',
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
        ...TextStyles.chip,
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
    reviewHero: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        padding: Spacing.md,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
    },
    reviewImage: {
        width: 72,
        height: 72,
        borderRadius: Radius.lg,
        backgroundColor: Colors.bg.page,
    },
    reviewImageFallback: {
        width: 72,
        height: 72,
        borderRadius: Radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primarySubtle,
    },
    reviewHeroBody: {
        flex: 1,
        gap: Spacing.xs,
    },
    reviewTitle: {
        ...TextStyles.cardTitle,
    },
    reviewDescription: {
        ...TextStyles.secondary,
    },
    reviewSection: {
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
        overflow: 'hidden',
    },
    reviewRow: {
        gap: Spacing.xs,
        padding: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.emphasis,
    },
    reviewRowLast: {
        borderBottomWidth: 0,
    },
    reviewLabel: {
        ...TextStyles.caption,
        color: Colors.text.muted,
        textTransform: 'uppercase',
    },
    reviewValue: {
        ...TextStyles.body,
        color: Colors.text.primary,
    },
    footerActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    backButton: {
        minHeight: ControlSizes.buttonMinHeight,
        minWidth: 92,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.primary,
        backgroundColor: Colors.primarySubtle,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        paddingHorizontal: Spacing.md,
    },
    backButtonText: {
        color: Colors.primary,
        fontSize: TextStyles.chip.fontSize,
        fontWeight: '800',
    },
    primaryButton: {
        flex: 1,
        minHeight: ControlSizes.buttonMinHeight,
        borderRadius: Radius.md,
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
    inputError: {
        borderColor: Colors.danger,
        borderWidth: 1,
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
        appAlert.alert(
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
