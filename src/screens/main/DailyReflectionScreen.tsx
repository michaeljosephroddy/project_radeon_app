import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../api/client';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import {
    useDeleteReflectionMutation,
    useReflection,
    useReflectionHistory,
    useSaveTodayReflectionMutation,
    useShareReflectionMutation,
    useTodayReflection,
    useUpdateReflectionMutation,
} from '../../hooks/queries/useReflections';
import { useReflectionForm } from '../../hooks/useReflectionForm';
import { Colors } from '../../theme';
import { ReflectionDetailView } from './reflection/ReflectionDetailView';
import { ReflectionEditor } from './reflection/ReflectionEditor';
import { ReflectionHistoryView } from './reflection/ReflectionHistoryView';
import { ReflectionReviewView } from './reflection/ReflectionReviewView';
import {
    getBackHandler,
    getBlockingToday,
    getGratefulFor,
    getOnMind,
    groupReflectionsByMonth,
    type ReflectionView,
} from './reflection/utils';

interface DailyReflectionScreenProps {
    currentUserId: string;
    initialReflectionId?: string | null;
    isActive: boolean;
    onBack: () => void;
    onReflectionSaved?: (reflectionId: string) => void;
}

export function DailyReflectionScreen({
    currentUserId,
    initialReflectionId,
    isActive,
    onBack,
    onReflectionSaved,
}: DailyReflectionScreenProps): React.ReactElement {
    const [view, setView] = useState<ReflectionView>('write');
    const [selectedReflection, setSelectedReflection] = useState<api.DailyReflection | null>(null);
    const [detailBackCloses, setDetailBackCloses] = useState(false);
    const initialReflectionQuery = useReflection(
        initialReflectionId ?? null,
        isActive && Boolean(initialReflectionId),
    );
    const historyQuery = useReflectionHistory(20, isActive && view === 'history');
    const todayQuery = useTodayReflection(isActive && !initialReflectionId);
    const saveTodayMutation = useSaveTodayReflectionMutation();
    const updateMutation = useUpdateReflectionMutation();
    const shareMutation = useShareReflectionMutation(currentUserId);
    const deleteMutation = useDeleteReflectionMutation();
    const hasRoutedToTodayRef = useRef(false);

    const writeForm = useReflectionForm();
    const detailForm = useReflectionForm();

    const historyItems = useMemo(
        () => (historyQuery.data?.pages ?? []).flatMap(page => page.items ?? []),
        [historyQuery.data],
    );
    const groupedHistory = useMemo(() => groupReflectionsByMonth(historyItems), [historyItems]);
    const todayLabel = useMemo(() => {
        const now = new Date();
        return now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    }, []);

    const canSave = writeForm.composedBody.length > 0 && !saveTodayMutation.isPending;
    const canSaveDetail = Boolean(selectedReflection)
        && detailForm.composedBody.length > 0
        && detailForm.isDirty
        && !updateMutation.isPending;

    useEffect(() => {
        if (!selectedReflection) return;
        detailForm.reset({
            gratefulFor: getGratefulFor(selectedReflection),
            onMind: getOnMind(selectedReflection),
            blockingToday: getBlockingToday(selectedReflection),
        });
    }, [selectedReflection, detailForm.reset]);

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
        if (!writeForm.isEmpty) return;
        hasRoutedToTodayRef.current = true;
        setSelectedReflection(today);
        setDetailBackCloses(true);
        setView('detail');
    }, [todayQuery.data, view, writeForm.isEmpty]);

    useEffect(() => {
        const reflection = initialReflectionQuery.data;
        if (!reflection) return;
        setSelectedReflection(reflection);
    }, [initialReflectionQuery.data]);

    const handleReview = (): void => {
        if (!writeForm.composedBody) return;
        setView('review');
    };

    const handleConfirmSave = async (): Promise<void> => {
        if (!writeForm.composedBody) return;
        try {
            const saved = await saveTodayMutation.mutateAsync({
                body: writeForm.composedBody,
                grateful_for: writeForm.values.gratefulFor.trim() || null,
                on_mind: writeForm.values.onMind.trim() || null,
                blocking_today: writeForm.values.blockingToday.trim() || null,
            });
            setSelectedReflection(saved);
            setDetailBackCloses(true);
            setView('detail');
            writeForm.reset();
            onReflectionSaved?.(saved.id);
        } catch (e: unknown) {
            Alert.alert(
                'Could not save reflection',
                e instanceof Error ? e.message : 'Something went wrong.',
            );
        }
    };

    const handleSaveDetail = async (): Promise<void> => {
        if (!selectedReflection) return;
        if (!detailForm.composedBody) return;
        try {
            const updated = await updateMutation.mutateAsync({
                id: selectedReflection.id,
                input: {
                    body: detailForm.composedBody,
                    grateful_for: detailForm.values.gratefulFor.trim() || null,
                    on_mind: detailForm.values.onMind.trim() || null,
                    blocking_today: detailForm.values.blockingToday.trim() || null,
                },
            });
            setSelectedReflection(updated);
        } catch (e: unknown) {
            Alert.alert(
                'Could not save reflection',
                e instanceof Error ? e.message : 'Something went wrong.',
            );
        }
    };

    const handleShare = async (reflection: api.DailyReflection): Promise<void> => {
        try {
            await shareMutation.mutateAsync(reflection.id);
            Alert.alert('Shared to feed', 'Your reflection was shared as a post.');
        } catch (e: unknown) {
            Alert.alert(
                'Could not share reflection',
                e instanceof Error ? e.message : 'Something went wrong.',
            );
        }
    };

    const handleDelete = (reflection: api.DailyReflection): void => {
        Alert.alert(
            'Delete reflection?',
            'This removes the private reflection. Shared feed posts stay on the feed.',
            [
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
                            onError: (e: unknown) =>
                                Alert.alert(
                                    'Could not delete reflection',
                                    e instanceof Error ? e.message : 'Something went wrong.',
                                ),
                        });
                    },
                },
            ],
        );
    };

    const openHistory = (): void => setView('history');
    const openWrite = (): void => {
        setSelectedReflection(null);
        setDetailBackCloses(false);
        setView('write');
    };
    const openDetail = (reflection: api.DailyReflection): void => {
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
                onBack={getBackHandler(view, detailBackCloses, onBack, setView)}
                title={view === 'history' ? 'Journal' : view === 'review' ? 'Review' : 'Reflection'}
                trailing={trailing}
            />
            {view === 'write' ? (
                <ReflectionEditor
                    dateLabel={todayLabel}
                    values={writeForm.values}
                    onChange={writeForm.setField}
                    isLoading={false}
                    canSave={canSave}
                    onSave={handleReview}
                />
            ) : view === 'review' ? (
                <ReflectionReviewView
                    dateLabel={todayLabel}
                    values={writeForm.values}
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
                    values={detailForm.values}
                    onChange={detailForm.setField}
                    canSave={canSaveDetail}
                    isSaving={updateMutation.isPending}
                    isSharing={shareMutation.isPending}
                    isDeleting={deleteMutation.isPending}
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    detailLoading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerAction: {
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
