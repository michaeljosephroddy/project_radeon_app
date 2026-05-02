import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as api from '../../api/client';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useGradualKeyboardInset } from '../../hooks/useGradualKeyboardInset';
import {
    useDeleteReflectionMutation,
    useReflection,
    useReflectionHistory,
    useSaveTodayReflectionMutation,
    useShareReflectionMutation,
    useTodayReflection,
    useUpdateReflectionMutation,
} from '../../hooks/queries/useReflections';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import { formatSobrietyDate } from '../../utils/date';
import { REFLECTION_QUESTIONS } from '../../utils/reflections';

interface DailyReflectionScreenProps {
    currentUserId: string;
    initialReflectionId?: string | null;
    isActive: boolean;
    onBack: () => void;
    onReflectionSaved?: (reflectionId: string) => void;
}

type ReflectionView = 'write' | 'review' | 'history' | 'detail';

export function DailyReflectionScreen({
    currentUserId,
    initialReflectionId,
    isActive,
    onBack,
    onReflectionSaved,
}: DailyReflectionScreenProps) {
    const [view, setView] = useState<ReflectionView>('write');
    const [selectedReflection, setSelectedReflection] = useState<api.DailyReflection | null>(null);
    const [detailBackCloses, setDetailBackCloses] = useState(false);
    const initialReflectionQuery = useReflection(initialReflectionId ?? null, isActive && Boolean(initialReflectionId));
    const historyQuery = useReflectionHistory(18, isActive && view === 'history');
    const todayQuery = useTodayReflection(isActive && !initialReflectionId);
    const saveTodayMutation = useSaveTodayReflectionMutation();
    const updateMutation = useUpdateReflectionMutation();
    const shareMutation = useShareReflectionMutation(currentUserId);
    const deleteMutation = useDeleteReflectionMutation();
    const hasRoutedToTodayRef = useRef(false);

    const [gratefulFor, setGratefulFor] = useState('');
    const [onMind, setOnMind] = useState('');
    const [blockingToday, setBlockingToday] = useState('');
    const [detailGratefulFor, setDetailGratefulFor] = useState('');
    const [detailOnMind, setDetailOnMind] = useState('');
    const [detailBlockingToday, setDetailBlockingToday] = useState('');

    const historyItems = useMemo(
        () => (historyQuery.data?.pages ?? []).flatMap(page => page.items ?? []),
        [historyQuery.data],
    );
    const groupedHistory = useMemo(() => groupReflectionsByMonth(historyItems), [historyItems]);
    const todayLabel = useMemo(() => {
        const now = new Date();
        return now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    }, []);
    const composedBody = composeReflectionBody(gratefulFor, onMind, blockingToday);
    const detailComposedBody = composeReflectionBody(detailGratefulFor, detailOnMind, detailBlockingToday);
    const detailHasChanges = Boolean(selectedReflection)
        && (detailGratefulFor.trim() !== getGratefulFor(selectedReflection).trim()
            || detailOnMind.trim() !== getOnMind(selectedReflection).trim()
            || detailBlockingToday.trim() !== getBlockingToday(selectedReflection).trim());
    const canSave = composedBody.length > 0 && !saveTodayMutation.isPending;
    const canSaveDetail = Boolean(selectedReflection) && detailComposedBody.length > 0 && detailHasChanges && !updateMutation.isPending;

    useEffect(() => {
        if (!selectedReflection) return;
        setDetailGratefulFor(getGratefulFor(selectedReflection));
        setDetailOnMind(getOnMind(selectedReflection));
        setDetailBlockingToday(getBlockingToday(selectedReflection));
    }, [selectedReflection]);

    useEffect(() => {
        if (!initialReflectionId) return;
        setSelectedReflection(null);
        setDetailBackCloses(true);
        setView('detail');
    }, [initialReflectionId]);

    useEffect(() => {
        if (hasRoutedToTodayRef.current) return;
        const today = todayQuery.data;
        if (!today) return;
        if (view !== 'write') return;
        if (composedBody.length > 0) return;
        hasRoutedToTodayRef.current = true;
        setSelectedReflection(today);
        setDetailBackCloses(true);
        setView('detail');
    }, [todayQuery.data, view, composedBody]);

    useEffect(() => {
        const reflection = initialReflectionQuery.data;
        if (!reflection) return;
        setSelectedReflection(reflection);
    }, [initialReflectionQuery.data]);

    const handleReview = () => {
        if (!composedBody) return;
        setView('review');
    };

    const resetWriteState = () => {
        setGratefulFor('');
        setOnMind('');
        setBlockingToday('');
    };

    const handleConfirmSave = async () => {
        if (!composedBody) return;

        try {
            const saved = await saveTodayMutation.mutateAsync({
                body: composedBody,
                grateful_for: gratefulFor.trim() || null,
                on_mind: onMind.trim() || null,
                blocking_today: blockingToday.trim() || null,
            });
            setSelectedReflection(saved);
            setDetailBackCloses(true);
            setView('detail');
            resetWriteState();
            onReflectionSaved?.(saved.id);
        } catch (e: unknown) {
            Alert.alert('Could not save reflection', e instanceof Error ? e.message : 'Something went wrong.');
        }
    };

    const handleSaveDetail = async () => {
        if (!selectedReflection) return;
        if (!detailComposedBody) return;

        try {
            const updated = await updateMutation.mutateAsync({
                id: selectedReflection.id,
                input: {
                    body: detailComposedBody,
                    grateful_for: detailGratefulFor.trim() || null,
                    on_mind: detailOnMind.trim() || null,
                    blocking_today: detailBlockingToday.trim() || null,
                },
            });
            setSelectedReflection(updated);
        } catch (e: unknown) {
            Alert.alert('Could not save reflection', e instanceof Error ? e.message : 'Something went wrong.');
        }
    };

    const handleShare = async (reflection: api.DailyReflection) => {
        try {
            await shareMutation.mutateAsync(reflection.id);
            Alert.alert('Shared to feed', 'Your reflection was shared as a post.');
        } catch (e: unknown) {
            Alert.alert('Could not share reflection', e instanceof Error ? e.message : 'Something went wrong.');
        }
    };

    const handleDelete = (reflection: api.DailyReflection) => {
        Alert.alert('Delete reflection?', 'This removes the private reflection. Shared feed posts stay on the feed.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                    const deletingReflectionId = reflection.id;
                    deleteMutation.mutate(reflection.id, {
                        onSuccess: () => {
                            if (selectedReflection?.id === deletingReflectionId) {
                                setSelectedReflection(null);
                                if (detailBackCloses) {
                                    onBack();
                                } else {
                                    setView('history');
                                }
                            }
                        },
                        onError: (e: unknown) => Alert.alert('Could not delete reflection', e instanceof Error ? e.message : 'Something went wrong.'),
                    });
                },
            },
        ]);
    };

    const openHistory = () => setView('history');
    const openWrite = () => {
        setSelectedReflection(null);
        setDetailBackCloses(false);
        setView('write');
    };
    const openDetail = (reflection: api.DailyReflection) => {
        setSelectedReflection(reflection);
        setDetailBackCloses(false);
        setView('detail');
    };

    const trailing = view === 'review' ? null : (
        <TouchableOpacity
            style={styles.headerAction}
            onPress={view === 'write' ? openHistory : openWrite}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
            <Ionicons
                name={view === 'write' ? 'library-outline' : 'create-outline'}
                size={21}
                color={Colors.primary}
            />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <ScreenHeader
                onBack={
                    view === 'detail'
                        ? detailBackCloses ? onBack : () => setView('history')
                        : view === 'review' || view === 'history' ? () => setView('write') : onBack
                }
                title={view === 'history' ? 'Journal' : view === 'review' ? 'Review' : 'Reflection'}
                trailing={trailing}
            />
            {view === 'write' ? (
                <ReflectionEditor
                    dateLabel={todayLabel}
                    gratefulFor={gratefulFor}
                    onMind={onMind}
                    blockingToday={blockingToday}
                    isLoading={false}
                    canSave={canSave}
                    onChangeGratefulFor={setGratefulFor}
                    onChangeOnMind={setOnMind}
                    onChangeBlockingToday={setBlockingToday}
                    onSave={handleReview}
                />
            ) : view === 'review' ? (
                <ReflectionReviewView
                    dateLabel={todayLabel}
                    gratefulFor={gratefulFor}
                    onMind={onMind}
                    blockingToday={blockingToday}
                    isSaving={saveTodayMutation.isPending}
                    canSave={canSave}
                    onEdit={() => setView('write')}
                    onSave={handleConfirmSave}
                />
            ) : view === 'history' ? (
                <ReflectionHistoryView
                    groupedHistory={groupedHistory}
                    isLoading={historyQuery.isLoading}
                    isFetchingNextPage={historyQuery.isFetchingNextPage}
                    hasNextPage={Boolean(historyQuery.hasNextPage)}
                    onFetchNextPage={() => historyQuery.fetchNextPage()}
                    onOpenReflection={openDetail}
                />
            ) : selectedReflection ? (
                <ReflectionDetailView
                    reflection={selectedReflection}
                    gratefulFor={detailGratefulFor}
                    onMind={detailOnMind}
                    blockingToday={detailBlockingToday}
                    canSave={canSaveDetail}
                    isSaving={updateMutation.isPending}
                    isSharing={shareMutation.isPending}
                    isDeleting={deleteMutation.isPending}
                    onChangeGratefulFor={setDetailGratefulFor}
                    onChangeOnMind={setDetailOnMind}
                    onChangeBlockingToday={setDetailBlockingToday}
                    onSave={handleSaveDetail}
                    onShare={() => handleShare(selectedReflection)}
                    onDelete={() => handleDelete(selectedReflection)}
                />
            ) : initialReflectionQuery.isLoading ? (
                <View style={styles.detailLoading}>
                    <ActivityIndicator color={Colors.primary} />
                </View>
            ) : null}
        </View>
    );
}

interface ReflectionEditorProps {
    dateLabel: string;
    gratefulFor: string;
    onMind: string;
    blockingToday: string;
    isLoading: boolean;
    canSave: boolean;
    onChangeGratefulFor: (value: string) => void;
    onChangeOnMind: (value: string) => void;
    onChangeBlockingToday: (value: string) => void;
    onSave: () => void;
}

function ReflectionEditor({
    dateLabel,
    gratefulFor,
    onMind,
    blockingToday,
    isLoading,
    canSave,
    onChangeGratefulFor,
    onChangeOnMind,
    onChangeBlockingToday,
    onSave,
}: ReflectionEditorProps): React.ReactElement {
    const insets = useSafeAreaInsets();
    const bottomSafeSpace = Math.max(insets.bottom, Spacing.sm);
    const { height: keyboardInset } = useGradualKeyboardInset({
        closedHeight: bottomSafeSpace,
        openedOffset: Spacing.sm,
    });
    const spacerStyle = useAnimatedStyle((): { height: number } => ({
        height: keyboardInset.value,
    }));

    return (
        <View style={styles.keyboardView}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.writeContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                automaticallyAdjustContentInsets={false}
                automaticallyAdjustKeyboardInsets={false}
                contentInsetAdjustmentBehavior="never"
            >
                <View style={styles.hero}>
                    <Text style={styles.dateLabel}>{dateLabel}</Text>
                    <Text style={styles.prompt}>What do you want to reflect on?</Text>
                </View>

                {isLoading ? (
                    <View style={styles.editorShell}>
                        <View style={styles.loadingBox}>
                            <ActivityIndicator color={Colors.primary} />
                        </View>
                    </View>
                ) : (
                    <ReflectionPromptFields
                        gratefulFor={gratefulFor}
                        onMind={onMind}
                        blockingToday={blockingToday}
                        onChangeGratefulFor={onChangeGratefulFor}
                        onChangeOnMind={onChangeOnMind}
                        onChangeBlockingToday={onChangeBlockingToday}
                    />
                )}

            </ScrollView>

            <View style={styles.actionDock}>
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={[styles.primaryButton, !canSave && styles.buttonDisabled]}
                        onPress={onSave}
                        disabled={!canSave}
                    >
                        <Text style={styles.primaryButtonText}>Review</Text>
                    </TouchableOpacity>
                </View>
            </View>
            <Animated.View style={spacerStyle} />
        </View>
    );
}

interface ReflectionReviewViewProps {
    dateLabel: string;
    gratefulFor: string;
    onMind: string;
    blockingToday: string;
    isSaving: boolean;
    canSave: boolean;
    onEdit: () => void;
    onSave: () => void;
}

function ReflectionReviewView({
    dateLabel,
    gratefulFor,
    onMind,
    blockingToday,
    isSaving,
    canSave,
    onEdit,
    onSave,
}: ReflectionReviewViewProps): React.ReactElement {
    const insets = useSafeAreaInsets();
    const bottomSafeSpace = Math.max(insets.bottom, Spacing.sm);
    return (
        <View style={styles.keyboardView}>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.reviewContent}>
                <View style={styles.hero}>
                    <Text style={styles.dateLabel}>{dateLabel}</Text>
                    <Text style={styles.prompt}>Review your reflection</Text>
                    <View style={styles.privatePill}>
                        <Ionicons name="lock-closed-outline" size={13} color={Colors.text.secondary} />
                        <Text style={styles.privatePillText}>Private</Text>
                    </View>
                </View>
                <ReflectionAnswerPreview
                    question={REFLECTION_QUESTIONS.gratefulFor}
                    answer={gratefulFor}
                />
                <ReflectionAnswerPreview
                    question={REFLECTION_QUESTIONS.onMind}
                    answer={onMind}
                />
                <ReflectionAnswerPreview
                    question={REFLECTION_QUESTIONS.blockingToday}
                    answer={blockingToday}
                />
            </ScrollView>
            <View style={styles.actionDock}>
                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.secondaryButton} onPress={onEdit}>
                        <Ionicons name="create-outline" size={16} color={Colors.primary} />
                        <Text style={styles.secondaryButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.primaryButton, !canSave && styles.buttonDisabled]}
                        onPress={onSave}
                        disabled={!canSave}
                    >
                        {isSaving ? (
                            <ActivityIndicator size="small" color={Colors.textOn.primary} />
                        ) : (
                            <Text style={styles.primaryButtonText}>Save reflection</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
            <View style={{ height: bottomSafeSpace }} />
        </View>
    );
}

interface ReflectionAnswerPreviewProps {
    question: string;
    answer: string;
}

function ReflectionAnswerPreview({
    question,
    answer,
}: ReflectionAnswerPreviewProps) {
    const trimmedAnswer = answer.trim();
    if (!trimmedAnswer) return null;

    return (
        <View style={styles.reviewAnswer}>
            <Text style={styles.reviewQuestion}>{question}</Text>
            <Text style={styles.reviewAnswerText}>{trimmedAnswer}</Text>
        </View>
    );
}

interface ReflectionPromptFieldsProps {
    gratefulFor: string;
    onMind: string;
    blockingToday: string;
    onChangeGratefulFor: (value: string) => void;
    onChangeOnMind: (value: string) => void;
    onChangeBlockingToday: (value: string) => void;
}

function ReflectionPromptFields({
    gratefulFor,
    onMind,
    blockingToday,
    onChangeGratefulFor,
    onChangeOnMind,
    onChangeBlockingToday,
}: ReflectionPromptFieldsProps) {
    return (
        <View style={styles.promptFields}>
            <ReflectionField
                label={REFLECTION_QUESTIONS.gratefulFor}
                value={gratefulFor}
                onChangeText={onChangeGratefulFor}
                placeholder="One person, moment, or small thing..."
            />
            <ReflectionField
                label={REFLECTION_QUESTIONS.onMind}
                value={onMind}
                onChangeText={onChangeOnMind}
                placeholder="A thought you keep coming back to..."
            />
            <ReflectionField
                label={REFLECTION_QUESTIONS.blockingToday}
                value={blockingToday}
                onChangeText={onChangeBlockingToday}
                placeholder="A pressure, fear, craving, or obstacle..."
            />
        </View>
    );
}

interface ReflectionFieldProps {
    label: string;
    value: string;
    placeholder: string;
    onChangeText: (value: string) => void;
}

function ReflectionField({ label, value, placeholder, onChangeText }: ReflectionFieldProps) {
    return (
        <View style={styles.reflectionField}>
            <Text style={styles.reflectionFieldLabel}>{label}</Text>
            <TextInput
                value={value}
                onChangeText={onChangeText}
                multiline
                maxLength={600}
                textAlignVertical="top"
                placeholder={placeholder}
                placeholderTextColor={Colors.text.muted}
                style={styles.reflectionFieldInput}
            />
        </View>
    );
}

interface ReflectionHistoryViewProps {
    groupedHistory: GroupedReflections[];
    isLoading: boolean;
    isFetchingNextPage: boolean;
    hasNextPage: boolean;
    onFetchNextPage: () => void;
    onOpenReflection: (reflection: api.DailyReflection) => void;
}

function ReflectionHistoryView({
    groupedHistory,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    onFetchNextPage,
    onOpenReflection,
}: ReflectionHistoryViewProps): React.ReactElement {
    const insets = useSafeAreaInsets();
    const isEmpty = groupedHistory.every(group => group.items.length === 0);

    return (
        <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.historyContent, { paddingBottom: Spacing.xl + insets.bottom }]}
        >
            {isLoading ? (
                <View style={styles.historyLoading}>
                    <ActivityIndicator color={Colors.primary} />
                </View>
            ) : null}
            {!isLoading && isEmpty ? (
                <View style={styles.emptyState}>
                    <Ionicons name="journal-outline" size={28} color={Colors.text.muted} />
                    <Text style={styles.emptyTitle}>No reflections yet</Text>
                </View>
            ) : null}
            {groupedHistory.map(group => (
                <View key={group.monthKey} style={styles.historyGroup}>
                    <Text style={styles.monthLabel}>{group.monthLabel}</Text>
                    {group.items.map(reflection => (
                        <TouchableOpacity
                            key={reflection.id}
                            style={styles.historyItem}
                            activeOpacity={0.82}
                            onPress={() => onOpenReflection(reflection)}
                        >
                            <View style={styles.historyHead}>
                                <Text style={styles.historyDate}>{formatSobrietyDate(reflection.reflection_date)}</Text>
                                {reflection.shared_post_id ? (
                                    <View style={styles.inlinePill}>
                                        <Text style={styles.inlinePillText}>Shared</Text>
                                    </View>
                                ) : null}
                            </View>
                            <Text style={styles.historyBody} numberOfLines={3}>{reflection.body}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            ))}
            {hasNextPage ? (
                <TouchableOpacity
                    style={styles.loadMore}
                    onPress={onFetchNextPage}
                    disabled={isFetchingNextPage}
                >
                    {isFetchingNextPage ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                        <Text style={styles.loadMoreText}>Load more</Text>
                    )}
                </TouchableOpacity>
            ) : null}
        </ScrollView>
    );
}

interface ReflectionDetailViewProps {
    reflection: api.DailyReflection;
    gratefulFor: string;
    onMind: string;
    blockingToday: string;
    canSave: boolean;
    isSaving: boolean;
    isSharing: boolean;
    isDeleting: boolean;
    onChangeGratefulFor: (value: string) => void;
    onChangeOnMind: (value: string) => void;
    onChangeBlockingToday: (value: string) => void;
    onSave: () => void;
    onShare: () => void;
    onDelete: () => void;
}

function ReflectionDetailView({
    reflection,
    gratefulFor,
    onMind,
    blockingToday,
    canSave,
    isSaving,
    isSharing,
    isDeleting,
    onChangeGratefulFor,
    onChangeOnMind,
    onChangeBlockingToday,
    onSave,
    onShare,
    onDelete,
}: ReflectionDetailViewProps): React.ReactElement {
    const insets = useSafeAreaInsets();
    const bottomSafeSpace = Math.max(insets.bottom, Spacing.sm);
    const { height: keyboardInset } = useGradualKeyboardInset({
        closedHeight: bottomSafeSpace,
        openedOffset: Spacing.sm,
    });
    const spacerStyle = useAnimatedStyle((): { height: number } => ({
        height: keyboardInset.value,
    }));

    return (
        <View style={styles.keyboardView}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.detailContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                automaticallyAdjustContentInsets={false}
                automaticallyAdjustKeyboardInsets={false}
                contentInsetAdjustmentBehavior="never"
            >
                <View style={styles.detailHero}>
                    <Text style={styles.dateLabel}>{formatSobrietyDate(reflection.reflection_date)}</Text>
                    {reflection.shared_post_id ? (
                        <View style={styles.sharedPill}>
                            <Ionicons name="checkmark-circle" size={15} color={Colors.success} />
                            <Text style={styles.sharedPillText}>Shared to feed</Text>
                        </View>
                    ) : null}
                </View>
                <ReflectionPromptFields
                    gratefulFor={gratefulFor}
                    onMind={onMind}
                    blockingToday={blockingToday}
                    onChangeGratefulFor={onChangeGratefulFor}
                    onChangeOnMind={onChangeOnMind}
                    onChangeBlockingToday={onChangeBlockingToday}
                />
            </ScrollView>
            <View style={styles.actionDock}>
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={[styles.iconTextButton, isDeleting && styles.buttonDisabled]}
                        onPress={onDelete}
                        disabled={isDeleting}
                    >
                        <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                        <Text style={[styles.secondaryButtonText, styles.deleteText]}>Delete</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.secondaryButton, isSharing && styles.buttonDisabled]}
                        onPress={onShare}
                        disabled={isSharing}
                    >
                        {isSharing ? (
                            <ActivityIndicator size="small" color={Colors.primary} />
                        ) : (
                            <>
                                <Ionicons name="share-outline" size={16} color={Colors.primary} />
                                <Text style={styles.secondaryButtonText}>Share</Text>
                            </>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.primaryButton, !canSave && styles.buttonDisabled]}
                        onPress={onSave}
                        disabled={!canSave}
                    >
                        {isSaving ? (
                            <ActivityIndicator size="small" color={Colors.textOn.primary} />
                        ) : (
                            <Text style={styles.primaryButtonText}>Save</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
            <Animated.View style={spacerStyle} />
        </View>
    );
}

function composeReflectionBody(gratefulFor: string, onMind: string, blockingToday: string): string {
    const parts: string[] = [];
    const grateful = gratefulFor.trim();
    const mind = onMind.trim();
    const blocking = blockingToday.trim();
    if (grateful) parts.push(`${REFLECTION_QUESTIONS.gratefulFor}\n${grateful}`);
    if (mind) parts.push(`${REFLECTION_QUESTIONS.onMind}\n${mind}`);
    if (blocking) parts.push(`${REFLECTION_QUESTIONS.blockingToday}\n${blocking}`);
    return parts.join('\n\n');
}

function getGratefulFor(reflection?: api.DailyReflection | null): string {
    return reflection?.grateful_for ?? '';
}

function getOnMind(reflection?: api.DailyReflection | null): string {
    if (!reflection) return '';
    if (reflection.on_mind) return reflection.on_mind;
    if (!reflection.grateful_for && !reflection.blocking_today) return reflection.body;
    return '';
}

function getBlockingToday(reflection?: api.DailyReflection | null): string {
    return reflection?.blocking_today ?? '';
}

interface GroupedReflections {
    monthKey: string;
    monthLabel: string;
    items: api.DailyReflection[];
}

function groupReflectionsByMonth(items: api.DailyReflection[]): GroupedReflections[] {
    const groups = new Map<string, GroupedReflections>();
    for (const item of items) {
        const date = new Date(`${item.reflection_date}T12:00:00`);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = date.toLocaleDateString([], { month: 'long', year: 'numeric' });
        const existing = groups.get(monthKey);
        if (existing) {
            existing.items.push(item);
        } else {
            groups.set(monthKey, { monthKey, monthLabel, items: [item] });
        }
    }
    return Array.from(groups.values());
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    keyboardView: {
        flex: 1,
    },
    scroll: {
        flex: 1,
    },
    headerAction: {
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
    },
    writeContent: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.xl,
        paddingBottom: Spacing.md,
        gap: Spacing.lg,
    },
    detailContent: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.md,
        gap: Spacing.lg,
    },
    reviewContent: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.xl,
        paddingBottom: Spacing.md,
        gap: Spacing.md,
    },
    detailLoading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    hero: {
        gap: Spacing.sm,
    },
    detailHero: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    dateLabel: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.primary,
    },
    prompt: {
        fontSize: Typography.sizes.xxl,
        lineHeight: 29,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    editorShell: {
        minHeight: 300,
        borderRadius: Radius.lg,
        backgroundColor: Colors.bg.surface,
        borderWidth: 1,
        borderColor: Colors.border.default,
        overflow: 'hidden',
    },
    loadingBox: {
        minHeight: 300,
        alignItems: 'center',
        justifyContent: 'center',
    },
    promptFields: {
        gap: Spacing.md,
    },
    reflectionField: {
        borderRadius: Radius.lg,
        backgroundColor: Colors.bg.surface,
        borderWidth: 1,
        borderColor: Colors.border.default,
        overflow: 'hidden',
    },
    reflectionFieldLabel: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.md,
        fontSize: Typography.sizes.md,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    reflectionFieldInput: {
        minHeight: 92,
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.lg,
        fontSize: Typography.sizes.base,
        lineHeight: 21,
        includeFontPadding: false,
        color: Colors.text.primary,
    },
    actionDock: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.md,
        borderTopWidth: 0.5,
        borderTopColor: Colors.border.default,
        backgroundColor: Colors.bg.page,
        gap: Spacing.sm,
    },
    sharedPill: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 6,
        borderRadius: Radius.pill,
        backgroundColor: Colors.bg.surface,
    },
    sharedPillText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
    privatePill: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 6,
        borderRadius: Radius.pill,
        backgroundColor: Colors.bg.surface,
    },
    privatePillText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
    reviewAnswer: {
        borderRadius: Radius.lg,
        backgroundColor: Colors.bg.surface,
        borderWidth: 1,
        borderColor: Colors.border.default,
        padding: Spacing.lg,
        gap: Spacing.sm,
    },
    reviewQuestion: {
        fontSize: Typography.sizes.md,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    reviewAnswerText: {
        fontSize: Typography.sizes.base,
        lineHeight: 21,
        color: Colors.text.secondary,
    },
    actionRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    primaryButton: {
        flex: 1.3,
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.md,
        backgroundColor: Colors.primary,
    },
    primaryButtonText: {
        fontSize: Typography.sizes.md,
        fontWeight: '700',
        color: Colors.textOn.primary,
    },
    secondaryButton: {
        flex: 1,
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
    },
    iconTextButton: {
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
    },
    secondaryButtonText: {
        fontSize: Typography.sizes.md,
        fontWeight: '700',
        color: Colors.primary,
    },
    deleteText: {
        color: Colors.danger,
    },
    buttonDisabled: {
        opacity: 0.45,
    },
    historyContent: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.xl,
        gap: Spacing.xl,
    },
    historyGroup: {
        gap: Spacing.sm,
    },
    monthLabel: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.text.muted,
        paddingHorizontal: 2,
    },
    historyLoading: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 72,
        gap: Spacing.sm,
    },
    emptyTitle: {
        fontSize: Typography.sizes.base,
        fontWeight: '600',
        color: Colors.text.muted,
    },
    historyItem: {
        backgroundColor: Colors.bg.page,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.default,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        marginHorizontal: -Spacing.md,
        gap: Spacing.sm,
    },
    historyHead: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    historyDate: {
        flex: 1,
        fontSize: Typography.sizes.md,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    inlinePill: {
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        backgroundColor: Colors.successSubtle,
    },
    inlinePillText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    historyBody: {
        fontSize: Typography.sizes.base,
        lineHeight: 20,
        color: Colors.text.secondary,
    },
    loadMore: {
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.surface,
    },
    loadMoreText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.primary,
    },
});
