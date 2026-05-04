import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as api from '../../../api/client';
import { Avatar } from '../../../components/Avatar';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { ScrollToTopButton } from '../../../components/ui/ScrollToTopButton';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import {
    useGroupAdminInbox,
    useGroupJoinRequests,
    useGroupReports,
    useReviewGroupReportMutation,
    useReviewGroupJoinRequestMutation,
} from '../../../hooks/queries/useGroups';
import { useScrollToTopButton } from '../../../hooks/useScrollToTopButton';
import { screenStandards } from '../../../styles/screenStandards';
import { Colors, ContentInsets, ControlSizes, Radius, Spacing, TextStyles, Typography } from '../../../theme';
import { formatReadableTimestamp } from '../../../utils/date';
import { formatUsername } from '../../../utils/identity';
import { GroupAdminThreadScreen } from './GroupAdminThreadScreen';

interface GroupAdminScreenProps {
    group: api.Group;
    onBack: () => void;
    initialTab?: AdminTab;
    initialThreadId?: string;
}

type AdminTab = 'requests' | 'inbox' | 'reports';

export function GroupAdminScreen({
    group,
    onBack,
    initialTab,
    initialThreadId,
}: GroupAdminScreenProps): React.ReactElement {
    const [activeTab, setActiveTab] = useState<AdminTab>(initialTab ?? 'requests');
    const [openThreadId, setOpenThreadId] = useState<string | null>(initialThreadId ?? null);

    useEffect(() => {
        if (!initialTab) return;
        setActiveTab(initialTab);
    }, [initialTab]);

    useEffect(() => {
        if (!initialThreadId) return;
        setActiveTab('inbox');
        setOpenThreadId(initialThreadId);
    }, [initialThreadId]);

    if (openThreadId) {
        return (
            <GroupAdminThreadScreen
                group={group}
                threadId={openThreadId}
                onBack={() => setOpenThreadId(null)}
            />
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScreenHeader title="Group admin" onBack={onBack} />
            <View style={styles.header}>
                <Text style={styles.title}>{group.name}</Text>
                <Text style={styles.subtitle}>{group.pending_request_count} pending requests</Text>
            </View>
            <View style={screenStandards.fixedTabsWrap}>
                <SegmentedControl
                    items={[
                        { key: 'requests', label: 'Requests' },
                        { key: 'inbox', label: 'Inbox' },
                        { key: 'reports', label: 'Reports' },
                    ]}
                    activeKey={activeTab}
                    onChange={(key) => setActiveTab(key as AdminTab)}
                    style={screenStandards.fixedTabsControl}
                />
            </View>
            {activeTab === 'requests' ? (
                <JoinRequestsPanel group={group} />
            ) : activeTab === 'inbox' ? (
                <AdminInboxPanel group={group} onOpenThread={setOpenThreadId} />
            ) : (
                <ReportsPanel group={group} />
            )}
        </SafeAreaView>
    );
}

function JoinRequestsPanel({ group }: { group: api.Group }): React.ReactElement {
    const requestsQuery = useGroupJoinRequests(group.id, group.can_manage_members);
    const reviewMutation = useReviewGroupJoinRequestMutation(group.id);
    const requests = requestsQuery.data?.items ?? [];

    const review = (requestId: string, approve: boolean): void => {
        reviewMutation.mutate({ requestId, approve }, {
            onError: (error: unknown) => {
                Alert.alert('Could not review request', error instanceof Error ? error.message : 'Please try again.');
            },
        });
    };

    if (requestsQuery.isLoading) {
        return <ActivityIndicator color={Colors.primary} style={styles.loader} />;
    }

    return (
        <FlatList
            data={requests}
            keyExtractor={(item) => item.id}
            contentContainerStyle={requests.length ? styles.listContent : styles.emptyContent}
            ListEmptyComponent={<EmptyState title="No pending requests" compact />}
            renderItem={({ item }) => (
                <View style={styles.card}>
                    <View style={styles.row}>
                        <Avatar username={item.username} avatarUrl={item.avatar_url ?? undefined} size={40} fontSize={13} />
                        <View style={styles.rowCopy}>
                            <Text style={styles.name}>{item.username}</Text>
                            <Text style={styles.meta}>{formatReadableTimestamp(item.created_at)}</Text>
                        </View>
                    </View>
                    {item.message ? <Text style={styles.body}>{item.message}</Text> : null}
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.acceptButton} onPress={() => review(item.id, true)}>
                            <Ionicons name="checkmark" size={16} color={Colors.textOn.primary} />
                            <Text style={styles.primaryButtonText}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.rejectButton} onPress={() => review(item.id, false)}>
                            <Ionicons name="close" size={16} color={Colors.danger} />
                            <Text style={styles.rejectText}>Reject</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        />
    );
}

function AdminInboxPanel({
    group,
    onOpenThread,
}: {
    group: api.Group;
    onOpenThread: (threadId: string) => void;
}): React.ReactElement {
    const listRef = useRef<FlatList<api.GroupAdminThread> | null>(null);
    const scrollToTop = useScrollToTopButton({ threshold: 520 });
    const inboxQuery = useGroupAdminInbox(group.id, 20, group.can_moderate_content);
    const threads = useMemo(
        () => (inboxQuery.data?.pages ?? []).flatMap(page => page.items ?? []),
        [inboxQuery.data?.pages],
    );

    if (inboxQuery.isLoading) {
        return <ActivityIndicator color={Colors.primary} style={styles.loader} />;
    }

    return (
        <View style={styles.listSurface}>
            <FlatList
                ref={listRef}
                data={threads}
                keyExtractor={(item) => item.id}
                contentContainerStyle={threads.length ? styles.inboxListContent : styles.emptyContent}
                ListEmptyComponent={<EmptyState title="No admin messages" compact />}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.inboxItem} onPress={() => onOpenThread(item.id)}>
                        <Avatar username={item.username} avatarUrl={item.avatar_url ?? undefined} size={44} fontSize={14} />
                        <View style={styles.inboxMeta}>
                            <Text style={styles.inboxName} numberOfLines={1}>{formatUsername(item.username)}</Text>
                            {item.last_message || item.subject ? (
                                <Text
                                    style={[
                                        styles.inboxPreview,
                                        (item.unread_count ?? 0) > 0 && styles.inboxPreviewUnread,
                                    ]}
                                    numberOfLines={1}
                                >
                                    {item.last_message ?? item.subject}
                                </Text>
                            ) : null}
                        </View>
                        <View style={styles.inboxTrailing}>
                            <Text style={styles.inboxTime}>{timeLabel(item.last_message_at ?? item.updated_at)}</Text>
                            {(item.unread_count ?? 0) > 0 ? (
                                <View style={styles.unreadBadge}>
                                    <Text style={styles.unreadBadgeText}>{unreadCountLabel(item.unread_count ?? 0)}</Text>
                                </View>
                            ) : null}
                        </View>
                    </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={styles.inboxSeparator} />}
                onEndReachedThreshold={0.4}
                onEndReached={() => {
                    if (inboxQuery.hasNextPage && !inboxQuery.isFetchingNextPage) {
                        inboxQuery.fetchNextPage();
                    }
                }}
                onScroll={scrollToTop.onScroll}
                scrollEventThrottle={16}
                ListFooterComponent={inboxQuery.isFetchingNextPage ? (
                    <ActivityIndicator color={Colors.primary} />
                ) : null}
            />
            {scrollToTop.isVisible ? (
                <ScrollToTopButton onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} />
            ) : null}
        </View>
    );
}

function ReportsPanel({ group }: { group: api.Group }): React.ReactElement {
    const listRef = useRef<FlatList<api.GroupReport> | null>(null);
    const scrollToTop = useScrollToTopButton({ threshold: 520 });
    const reportsQuery = useGroupReports(group.id, 20, group.can_moderate_content);
    const reviewMutation = useReviewGroupReportMutation(group.id);
    const [reportScope, setReportScope] = useState<'active' | 'history'>('active');
    const allReports = useMemo(() => (
        (reportsQuery.data?.pages ?? [])
            .flatMap(page => page.items ?? [])
    ),
        [reportsQuery.data?.pages],
    );
    const reports = useMemo(() => {
        if (reportScope === 'active') {
            return allReports.filter((report) => report.status === 'open' || report.status === 'reviewing');
        }
        return allReports.filter((report) => report.status === 'resolved' || report.status === 'dismissed');
    }, [allReports, reportScope]);

    const review = (
        reportId: string,
        status: Extract<api.GroupReport['status'], 'reviewing' | 'resolved' | 'dismissed'>,
    ): void => {
        reviewMutation.mutate({ reportId, status }, {
            onError: (error: unknown) => {
                Alert.alert('Could not update report', error instanceof Error ? error.message : 'Please try again.');
            },
        });
    };

    if (reportsQuery.isLoading) {
        return <ActivityIndicator color={Colors.primary} style={styles.loader} />;
    }

    return (
        <View style={styles.listSurface}>
            <View style={screenStandards.fixedTabsWrap}>
                <SegmentedControl
                    items={[
                        { key: 'active', label: 'Active' },
                        { key: 'history', label: 'History' },
                    ]}
                    activeKey={reportScope}
                    onChange={(key) => setReportScope(key as 'active' | 'history')}
                    style={screenStandards.fixedTabsControl}
                />
            </View>
            <FlatList
                ref={listRef}
                data={reports}
                keyExtractor={(item) => item.id}
                contentContainerStyle={reports.length ? styles.listContent : styles.emptyContent}
                ListEmptyComponent={<EmptyState title={reportScope === 'active' ? 'No active reports' : 'No report history'} compact />}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <View style={styles.row}>
                            <Avatar username={item.reporter_username ?? 'member'} avatarUrl={item.reporter_avatar_url ?? undefined} size={40} fontSize={13} />
                            <View style={styles.rowCopy}>
                                <Text style={styles.name}>{item.reason}</Text>
                                <Text style={styles.meta}>
                                    {item.target_type} · {formatReportStatus(item.status)} · {formatReadableTimestamp(item.created_at)}
                                </Text>
                            </View>
                            <View style={[
                                styles.reportStatusBadge,
                                item.status === 'open' ? styles.reportStatusOpen : item.status === 'reviewing' ? styles.reportStatusReviewing : item.status === 'resolved' ? styles.reportStatusResolved : styles.reportStatusDismissed,
                            ]}>
                                <Text style={[
                                    styles.reportStatusText,
                                    item.status === 'open' ? styles.reportStatusTextOpen : item.status === 'reviewing' ? styles.reportStatusTextReviewing : item.status === 'resolved' ? styles.reportStatusTextResolved : styles.reportStatusTextDismissed,
                                ]}>
                                    {formatReportStatus(item.status)}
                                </Text>
                            </View>
                        </View>
                        {item.details ? <Text style={styles.body}>{item.details}</Text> : null}
                        <View style={styles.actionRow}>
                            {item.status === 'open' ? (
                                <TouchableOpacity style={styles.resolveButton} onPress={() => review(item.id, 'reviewing')}>
                                    <Ionicons name="eye-outline" size={16} color={Colors.primary} />
                                    <Text style={styles.resolveText}>Start Review</Text>
                                </TouchableOpacity>
                            ) : null}
                            {item.status === 'reviewing' ? (
                                <TouchableOpacity style={styles.acceptButton} onPress={() => review(item.id, 'resolved')}>
                                    <Ionicons name="checkmark-done" size={16} color={Colors.textOn.primary} />
                                    <Text style={styles.primaryButtonText}>Resolve</Text>
                                </TouchableOpacity>
                            ) : null}
                            {item.status === 'open' || item.status === 'reviewing' ? (
                                <TouchableOpacity style={styles.rejectButton} onPress={() => review(item.id, 'dismissed')}>
                                    <Ionicons name="close" size={16} color={Colors.danger} />
                                    <Text style={styles.rejectText}>Dismiss</Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </View>
                )}
                onEndReachedThreshold={0.4}
                onEndReached={() => {
                    if (reportsQuery.hasNextPage && !reportsQuery.isFetchingNextPage) {
                        reportsQuery.fetchNextPage();
                    }
                }}
                onScroll={scrollToTop.onScroll}
                scrollEventThrottle={16}
                ListFooterComponent={reportsQuery.isFetchingNextPage ? (
                    <ActivityIndicator color={Colors.primary} />
                ) : null}
            />
            {scrollToTop.isVisible ? (
                <ScrollToTopButton onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} />
            ) : null}
        </View>
    );
}

function timeLabel(dateStr?: string | null): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '';
    const diff = Date.now() - date.getTime();
    const mins = Math.max(0, Math.floor(diff / 60000));
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return 'yesterday';
    return date.toLocaleDateString('default', { weekday: 'short' });
}

function unreadCountLabel(unreadCount: number): string {
    return unreadCount > 99 ? '99+' : String(unreadCount);
}

function formatReportStatus(status: api.GroupReport['status']): string {
    if (status === 'open') return 'Open';
    if (status === 'reviewing') return 'Reviewing';
    if (status === 'resolved') return 'Resolved';
    return 'Dismissed';
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    header: {
        padding: Spacing.md,
        gap: Spacing.xs,
    },
    title: {
        ...TextStyles.sectionTitle,
        fontWeight: '800',
    },
    subtitle: {
        ...TextStyles.secondary,
        fontWeight: '600',
    },
    loader: {
        marginTop: Spacing.xl,
    },
    listContent: {
        padding: Spacing.md,
        gap: Spacing.md,
    },
    inboxListContent: {
        paddingTop: ContentInsets.screenHorizontal,
        paddingBottom: ContentInsets.listBottom,
    },
    listSurface: {
        flex: 1,
    },
    inboxItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: ContentInsets.screenHorizontal,
        paddingVertical: 11,
        backgroundColor: Colors.bg.page,
    },
    inboxSeparator: {
        height: 1,
        backgroundColor: Colors.border.default,
        marginLeft: ContentInsets.screenHorizontal + 44 + 10,
    },
    inboxMeta: {
        flex: 1,
        minWidth: 0,
    },
    inboxName: {
        fontSize: Typography.sizes.md,
        fontWeight: '500',
        color: Colors.text.primary,
    },
    inboxPreview: {
        marginTop: 1,
        fontSize: Typography.sizes.sm,
        color: Colors.text.muted,
    },
    inboxPreviewUnread: {
        color: Colors.text.primary,
        fontWeight: '600',
    },
    inboxTrailing: {
        minWidth: 34,
        alignSelf: 'stretch',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingVertical: 1,
    },
    inboxTime: {
        fontSize: Typography.sizes.xs,
        color: Colors.text.muted,
    },
    unreadBadge: {
        minWidth: 22,
        height: 22,
        paddingHorizontal: Spacing.xs,
        borderRadius: Radius.pill,
        backgroundColor: Colors.danger,
        alignItems: 'center',
        justifyContent: 'center',
    },
    unreadBadgeText: {
        fontSize: Typography.sizes.xs,
        color: Colors.textOn.danger,
        fontWeight: '700',
    },
    emptyContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: Spacing.md,
    },
    card: {
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.surface,
        padding: Spacing.md,
        gap: Spacing.md,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    rowCopy: {
        flex: 1,
        gap: 2,
    },
    name: {
        ...TextStyles.bodyEmphasis,
        fontWeight: '800',
    },
    meta: {
        ...TextStyles.caption,
    },
    body: {
        ...TextStyles.postBody,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    acceptButton: {
        minHeight: ControlSizes.iconButton,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        borderRadius: Radius.pill,
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.md,
    },
    primaryButtonText: {
        ...TextStyles.button,
        fontSize: TextStyles.chip.fontSize,
        fontWeight: '800',
    },
    rejectButton: {
        minHeight: ControlSizes.iconButton,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        borderRadius: Radius.pill,
        backgroundColor: Colors.dangerSubtle,
        paddingHorizontal: Spacing.md,
    },
    rejectText: {
        ...TextStyles.button,
        fontSize: TextStyles.chip.fontSize,
        fontWeight: '800',
        color: Colors.danger,
    },
    resolveButton: {
        minHeight: ControlSizes.iconButton,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        borderRadius: Radius.pill,
        backgroundColor: Colors.primarySubtle,
        paddingHorizontal: Spacing.md,
    },
    resolveText: {
        ...TextStyles.button,
        fontSize: TextStyles.chip.fontSize,
        fontWeight: '800',
        color: Colors.primary,
    },
    reportStatusBadge: {
        borderRadius: Radius.pill,
        borderWidth: 1,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
    },
    reportStatusText: {
        ...TextStyles.badge,
        fontWeight: '800',
    },
    reportStatusOpen: {
        borderColor: Colors.warning,
        backgroundColor: Colors.warningSubtle,
    },
    reportStatusReviewing: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primarySubtle,
    },
    reportStatusResolved: {
        borderColor: Colors.success,
        backgroundColor: Colors.successSubtle,
    },
    reportStatusDismissed: {
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.raised,
    },
    reportStatusTextOpen: {
        color: Colors.warning,
    },
    reportStatusTextReviewing: {
        color: Colors.primary,
    },
    reportStatusTextResolved: {
        color: Colors.success,
    },
    reportStatusTextDismissed: {
        color: Colors.text.secondary,
    },
});
