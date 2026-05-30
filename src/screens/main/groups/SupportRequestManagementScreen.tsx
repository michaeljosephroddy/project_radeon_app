import { appAlert } from '@/components/ui/appAlert';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as api from '../../../api/client';
import { Avatar } from '../../../components/Avatar';
import { SupportRequestCard } from '../../../components/support/SupportRequestCard';
import { getSupportTypeLabel } from '../../../components/support/supportRequestPresentation';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { useSupportOffers, useSupportReplies } from '../../../hooks/queries/useSupport';
import { useGuardedEndReached } from '../../../hooks/useGuardedEndReached';
import { AvatarSizes, Colors, ControlSizes, Radius, Spacing, TextStyles } from '../../../theme';
import { formatReadableTimestamp } from '../../../utils/date';

const SUPPORT_MANAGEMENT_PAGE_SIZE = 25;
const OFFER_STATUS_FILTERS: Array<{ key: api.SupportOfferStatusFilter; label: string }> = [
    { key: 'pending', label: 'Pending' },
    { key: 'accepted', label: 'Accepted' },
];

type SupportManageTab = 'offers' | 'replies';

interface SupportRequestManagementScreenProps {
    groupId: string;
    request: api.SupportRequest;
    post?: api.GroupPost;
    onBack: () => void;
    onOpenComments: (post: api.GroupPost) => void;
    onOpenChat: (chat: api.Chat) => void;
    onChanged: () => void;
}

function getDefaultOfferStatusFilter(request: api.SupportRequest): api.SupportOfferStatusFilter {
    if (request.status === 'open') return 'pending';
    return 'accepted';
}

function getOfferStatusLabel(status: api.SupportOffer['status']): string {
    switch (status) {
        case 'pending':
            return 'Pending';
        case 'accepted':
            return 'Accepted';
        case 'not_selected':
            return 'Passed';
        default:
            return status;
    }
}

export function SupportRequestManagementScreen({
    groupId,
    request,
    post,
    onBack,
    onOpenComments,
    onOpenChat,
    onChanged,
}: SupportRequestManagementScreenProps): React.ReactElement {
    const queryClient = useQueryClient();
    const [activeManageTab, setActiveManageTab] = useState<SupportManageTab>('offers');
    const [offerStatusFilter, setOfferStatusFilter] = useState<api.SupportOfferStatusFilter>(() => getDefaultOfferStatusFilter(request));
    const [pendingId, setPendingId] = useState<string | null>(null);
    const offersQuery = useSupportOffers(
        request.id,
        offerStatusFilter,
        SUPPORT_MANAGEMENT_PAGE_SIZE,
        activeManageTab === 'offers',
    );
    const repliesQuery = useSupportReplies(
        request.id,
        SUPPORT_MANAGEMENT_PAGE_SIZE,
        activeManageTab === 'replies',
    );

    useEffect(() => {
        setOfferStatusFilter(getDefaultOfferStatusFilter(request));
    }, [request.id, request.status]);

    const offers = useMemo(
        () => offersQuery.data?.pages.flatMap((page) => page.items ?? []) ?? [],
        [offersQuery.data],
    );
    const replies = useMemo(
        () => repliesQuery.data?.pages.flatMap((page) => page.items ?? []) ?? [],
        [repliesQuery.data],
    );

    const invalidateManagementQueries = useCallback(async (): Promise<void> => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['groups', 'posts', groupId] }),
            queryClient.invalidateQueries({ queryKey: ['groups', 'detail', groupId] }),
            queryClient.invalidateQueries({ queryKey: ['support-requests'] }),
            queryClient.invalidateQueries({ queryKey: ['support-offers'] }),
            queryClient.invalidateQueries({ queryKey: ['support-replies'] }),
            queryClient.invalidateQueries({ queryKey: ['chats'] }),
        ]);
    }, [groupId, queryClient]);

    const handleAcceptOffer = useCallback(async (offer: api.SupportOffer): Promise<void> => {
        setPendingId(offer.id);
        try {
            const accepted = await api.acceptSupportOffer(request.id, offer.id);
            await invalidateManagementQueries();
            onChanged();
            if (accepted.chat_id) {
                const chat = await api.getChat(accepted.chat_id);
                onOpenChat(chat);
            }
        } catch (e: unknown) {
            appAlert.alert('Could not accept offer', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setPendingId(null);
        }
    }, [invalidateManagementQueries, onChanged, onOpenChat, request.id]);

    const handleDeclineOffer = useCallback(async (offer: api.SupportOffer): Promise<void> => {
        setPendingId(offer.id);
        try {
            await api.declineSupportOffer(request.id, offer.id);
            await invalidateManagementQueries();
        } catch (e: unknown) {
            appAlert.alert('Could not decline offer', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setPendingId(null);
        }
    }, [invalidateManagementQueries, request.id]);

    const handleCloseRequest = useCallback((): void => {
        appAlert.alert(
            'Close request?',
            'This marks the support request as closed.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Close',
                    style: 'destructive',
                    onPress: () => {
                        setPendingId(request.id);
                        void api.updateSupportRequest(request.id, { status: 'closed' })
                            .then(async () => {
                                await invalidateManagementQueries();
                                onChanged();
                            })
                            .catch((e: unknown) => {
                                appAlert.alert('Could not close request', e instanceof Error ? e.message : 'Something went wrong.');
                            })
                            .finally(() => setPendingId(null));
                    },
                },
            ],
        );
    }, [invalidateManagementQueries, onChanged, request.id]);

    const handleOpenComments = useCallback((): void => {
        if (post) {
            onOpenComments(post);
            return;
        }
        appAlert.alert('Replies unavailable', 'Open this request from the group feed to view public replies.');
    }, [onOpenComments, post]);

    const handleLoadMoreOffers = useCallback(async (): Promise<void> => {
        if (!offersQuery.hasNextPage || offersQuery.isFetchingNextPage || offersQuery.isRefetching) return;
        await offersQuery.fetchNextPage();
    }, [offersQuery]);

    const handleLoadMoreReplies = useCallback(async (): Promise<void> => {
        if (!repliesQuery.hasNextPage || repliesQuery.isFetchingNextPage || repliesQuery.isRefetching) return;
        await repliesQuery.fetchNextPage();
    }, [repliesQuery]);

    const offersPagination = useGuardedEndReached(handleLoadMoreOffers);
    const repliesPagination = useGuardedEndReached(handleLoadMoreReplies);

    const listHeader = useMemo(() => (
        <View style={styles.manageHeader}>
            <SupportRequestCard
                request={request}
                pending={pendingId === request.id}
                onOpenComments={handleOpenComments}
                onClose={handleCloseRequest}
            />
            <SegmentedControl
                items={[
                    { key: 'offers', label: 'Offers' },
                    { key: 'replies', label: 'Replies' },
                ]}
                activeKey={activeManageTab}
                onChange={(key) => setActiveManageTab(key as SupportManageTab)}
                layer="page"
                tone="primary"
                style={styles.manageTabs}
            />
            {activeManageTab === 'offers' ? (
                <SegmentedControl
                    items={OFFER_STATUS_FILTERS}
                    activeKey={offerStatusFilter}
                    onChange={(key) => setOfferStatusFilter(key as api.SupportOfferStatusFilter)}
                    layer="section"
                    tone="secondary"
                    style={styles.manageTabs}
                />
            ) : post ? (
                <TouchableOpacity style={styles.discussionButton} onPress={handleOpenComments}>
                    <Text style={styles.discussionButtonText}>View full discussion</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    ), [activeManageTab, handleCloseRequest, handleOpenComments, offerStatusFilter, pendingId, post, request]);

    const renderOffer = useCallback(({ item }: { item: api.SupportOffer }): React.ReactElement => (
        <SupportOfferRow
            offer={item}
            requestStatus={request.status}
            pending={pendingId === item.id}
            onAccept={handleAcceptOffer}
            onDecline={handleDeclineOffer}
        />
    ), [handleAcceptOffer, handleDeclineOffer, pendingId, request.status]);

    const renderReply = useCallback(({ item }: { item: api.SupportReply }): React.ReactElement => (
        <SupportReplyRow reply={item} />
    ), []);

    const offerEmptyText = offerStatusFilter === 'pending' ? 'No pending offers.' : 'No accepted offers.';
    const offersInitialLoading = offersQuery.isLoading && offers.length === 0;
    const repliesInitialLoading = repliesQuery.isLoading && replies.length === 0;

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScreenHeader title="Support request" onBack={onBack} />
            {activeManageTab === 'offers' ? (
                <FlatList<api.SupportOffer>
                    key={`offers-${offerStatusFilter}`}
                    data={offers}
                    keyExtractor={(item) => item.id}
                    renderItem={renderOffer}
                    contentContainerStyle={styles.manageListContent}
                    ListHeaderComponent={listHeader}
                    ListEmptyComponent={offersInitialLoading ? <ActivityIndicator style={styles.manageEmptyLoader} color={Colors.primary} /> : <EmptyState title={offerEmptyText} />}
                    ListFooterComponent={offersQuery.isFetchingNextPage ? <ActivityIndicator style={styles.footerLoader} color={Colors.primary} /> : null}
                    ItemSeparatorComponent={ManageListSeparator}
                    onEndReached={offersPagination.onEndReached}
                    onEndReachedThreshold={0.4}
                    onMomentumScrollBegin={offersPagination.onMomentumScrollBegin}
                    onScrollBeginDrag={offersPagination.onScrollBeginDrag}
                />
            ) : (
                <FlatList<api.SupportReply>
                    key="replies"
                    data={replies}
                    keyExtractor={(item) => item.id}
                    renderItem={renderReply}
                    contentContainerStyle={styles.manageListContent}
                    ListHeaderComponent={listHeader}
                    ListEmptyComponent={repliesInitialLoading ? <ActivityIndicator style={styles.manageEmptyLoader} color={Colors.primary} /> : <EmptyState title="No replies yet." />}
                    ListFooterComponent={repliesQuery.isFetchingNextPage ? <ActivityIndicator style={styles.footerLoader} color={Colors.primary} /> : null}
                    ItemSeparatorComponent={ManageListSeparator}
                    onEndReached={repliesPagination.onEndReached}
                    onEndReachedThreshold={0.4}
                    onMomentumScrollBegin={repliesPagination.onMomentumScrollBegin}
                    onScrollBeginDrag={repliesPagination.onScrollBeginDrag}
                />
            )}
        </SafeAreaView>
    );
}

function ManageListSeparator(): React.ReactElement {
    return <View style={styles.manageListSeparator} />;
}

function SupportReplyRow({ reply }: { reply: api.SupportReply }): React.ReactElement {
    return (
        <View style={styles.replyRow}>
            <Avatar username={reply.username} avatarUrl={reply.avatar_url ?? undefined} size={AvatarSizes.tiny} />
            <View style={styles.replyBody}>
                <Text style={styles.replyAuthor}>{reply.username}</Text>
                <Text style={styles.aboutBody}>{reply.body}</Text>
                <Text style={styles.metaText}>{formatReadableTimestamp(reply.created_at)}</Text>
            </View>
        </View>
    );
}

function SupportOfferRow({
    offer,
    requestStatus,
    pending,
    onAccept,
    onDecline,
}: {
    offer: api.SupportOffer;
    requestStatus: api.SupportRequest['status'];
    pending: boolean;
    onAccept: (offer: api.SupportOffer) => Promise<void>;
    onDecline: (offer: api.SupportOffer) => Promise<void>;
}): React.ReactElement {
    const canAct = offer.status === 'pending' && requestStatus === 'open';

    return (
        <View style={styles.offerRow}>
            <Avatar username={offer.username} avatarUrl={offer.avatar_url ?? undefined} size={AvatarSizes.comment} />
            <View style={styles.offerBody}>
                <Text style={styles.offerName}>{offer.username}</Text>
                <Text style={styles.metaText}>{getSupportTypeLabel(offer.offer_type)} - {getOfferStatusLabel(offer.status)}</Text>
                {offer.message ? <Text style={styles.aboutBody}>{offer.message}</Text> : null}
            </View>
            {canAct ? (
                <View style={styles.offerActions}>
                    <TouchableOpacity
                        style={[styles.offerPrimaryButton, pending && styles.disabled]}
                        onPress={() => { void onAccept(offer); }}
                        disabled={pending}
                    >
                        <Text style={styles.offerPrimaryButtonText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.offerSecondaryButton, pending && styles.disabled]}
                        onPress={() => { void onDecline(offer); }}
                        disabled={pending}
                    >
                        <Text style={styles.offerSecondaryButtonText}>Decline</Text>
                    </TouchableOpacity>
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
    manageListContent: {
        padding: Spacing.md,
        paddingBottom: Spacing.xl,
    },
    manageHeader: {
        gap: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    manageTabs: {
        marginBottom: 0,
    },
    discussionButton: {
        minHeight: ControlSizes.chipMinHeight,
        alignSelf: 'flex-start',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
        paddingHorizontal: Spacing.md,
    },
    discussionButtonText: {
        ...TextStyles.chip,
        color: Colors.text.primary,
        fontWeight: '700',
    },
    manageListSeparator: {
        height: Spacing.sm,
    },
    manageEmptyLoader: {
        paddingVertical: Spacing.xl,
    },
    footerLoader: {
        paddingVertical: Spacing.lg,
    },
    replyRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.surface,
        padding: Spacing.sm,
    },
    replyBody: {
        flex: 1,
        gap: 2,
    },
    replyAuthor: {
        ...TextStyles.bodyEmphasis,
        fontSize: TextStyles.bodyEmphasis.fontSize,
    },
    offerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.surface,
        padding: Spacing.md,
    },
    offerBody: {
        flex: 1,
        minWidth: 0,
        gap: Spacing.xs,
    },
    offerName: {
        ...TextStyles.bodyEmphasis,
    },
    offerActions: {
        gap: Spacing.xs,
    },
    offerPrimaryButton: {
        minHeight: ControlSizes.chipMinHeight,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.pill,
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.sm,
    },
    offerPrimaryButtonText: {
        ...TextStyles.badge,
        color: Colors.textOn.primary,
    },
    offerSecondaryButton: {
        minHeight: ControlSizes.chipMinHeight,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.border.default,
        paddingHorizontal: Spacing.sm,
    },
    offerSecondaryButtonText: {
        ...TextStyles.badge,
        color: Colors.text.secondary,
    },
    aboutBody: {
        ...TextStyles.postBody,
    },
    metaText: {
        ...TextStyles.caption,
    },
    disabled: {
        opacity: 0.5,
    },
});
