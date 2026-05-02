import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../../api/client';
import { Avatar } from '../../../components/Avatar';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { TextField } from '../../../components/ui/TextField';
import {
    useGroupAdminInbox,
    useGroupJoinRequests,
    useReplyGroupAdminThreadMutation,
    useResolveGroupAdminThreadMutation,
    useReviewGroupJoinRequestMutation,
} from '../../../hooks/queries/useGroups';
import { Colors, Radius, Spacing, Typography } from '../../../theme';
import { formatReadableTimestamp } from '../../../utils/date';

interface GroupAdminScreenProps {
    group: api.Group;
    onBack: () => void;
}

type AdminTab = 'requests' | 'inbox';

export function GroupAdminScreen({ group, onBack }: GroupAdminScreenProps): React.ReactElement {
    const [activeTab, setActiveTab] = useState<AdminTab>('requests');

    return (
        <View style={styles.container}>
            <ScreenHeader title="Group admin" onBack={onBack} />
            <View style={styles.header}>
                <Text style={styles.title}>{group.name}</Text>
                <Text style={styles.subtitle}>{group.pending_request_count} pending requests</Text>
            </View>
            <SegmentedControl
                items={[
                    { key: 'requests', label: 'Requests' },
                    { key: 'inbox', label: 'Inbox' },
                ]}
                activeKey={activeTab}
                onChange={(key) => setActiveTab(key as AdminTab)}
                style={styles.tabs}
            />
            {activeTab === 'requests' ? (
                <JoinRequestsPanel group={group} />
            ) : (
                <AdminInboxPanel group={group} />
            )}
        </View>
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

function AdminInboxPanel({ group }: { group: api.Group }): React.ReactElement {
    const inboxQuery = useGroupAdminInbox(group.id, 20, group.can_moderate_content);
    const replyMutation = useReplyGroupAdminThreadMutation(group.id);
    const resolveMutation = useResolveGroupAdminThreadMutation(group.id);
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const threads = useMemo(
        () => (inboxQuery.data?.pages ?? []).flatMap(page => page.items ?? []),
        [inboxQuery.data?.pages],
    );

    const reply = (threadId: string): void => {
        const body = drafts[threadId]?.trim();
        if (!body) return;
        replyMutation.mutate({ threadId, body }, {
            onSuccess: () => setDrafts((current) => ({ ...current, [threadId]: '' })),
            onError: (error: unknown) => {
                Alert.alert('Could not reply', error instanceof Error ? error.message : 'Please try again.');
            },
        });
    };

    const resolve = (threadId: string): void => {
        resolveMutation.mutate(threadId, {
            onError: (error: unknown) => {
                Alert.alert('Could not resolve thread', error instanceof Error ? error.message : 'Please try again.');
            },
        });
    };

    if (inboxQuery.isLoading) {
        return <ActivityIndicator color={Colors.primary} style={styles.loader} />;
    }

    return (
        <FlatList
            data={threads}
            keyExtractor={(item) => item.id}
            contentContainerStyle={threads.length ? styles.listContent : styles.emptyContent}
            ListEmptyComponent={<EmptyState title="No admin messages" compact />}
            renderItem={({ item }) => (
                <View style={styles.card}>
                    <View style={styles.row}>
                        <Avatar username={item.username} avatarUrl={item.avatar_url ?? undefined} size={40} fontSize={13} />
                        <View style={styles.rowCopy}>
                            <Text style={styles.name}>{item.subject || item.username}</Text>
                            <Text style={styles.meta}>{item.status} · {formatReadableTimestamp(item.updated_at)}</Text>
                        </View>
                    </View>
                    <ScrollView style={styles.messages} nestedScrollEnabled>
                        {(item.messages ?? []).map((message) => (
                            <View key={message.id} style={styles.messageRow}>
                                <Text style={styles.messageAuthor}>{message.username}</Text>
                                <Text style={styles.body}>{message.body}</Text>
                            </View>
                        ))}
                    </ScrollView>
                    <TextField
                        value={drafts[item.id] ?? ''}
                        onChangeText={(value) => setDrafts((current) => ({ ...current, [item.id]: value }))}
                        placeholder="Reply as admin"
                        multiline
                        style={styles.replyInput}
                    />
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={[styles.acceptButton, !(drafts[item.id] ?? '').trim() && styles.disabled]}
                            onPress={() => reply(item.id)}
                            disabled={!(drafts[item.id] ?? '').trim() || replyMutation.isPending}
                        >
                            <Ionicons name="send" size={15} color={Colors.textOn.primary} />
                            <Text style={styles.primaryButtonText}>Reply</Text>
                        </TouchableOpacity>
                        {item.status !== 'resolved' ? (
                            <TouchableOpacity style={styles.resolveButton} onPress={() => resolve(item.id)}>
                                <Ionicons name="checkmark-done" size={16} color={Colors.primary} />
                                <Text style={styles.resolveText}>Resolve</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>
            )}
            onEndReachedThreshold={0.4}
            onEndReached={() => {
                if (inboxQuery.hasNextPage && !inboxQuery.isFetchingNextPage) {
                    inboxQuery.fetchNextPage();
                }
            }}
            ListFooterComponent={inboxQuery.isFetchingNextPage ? (
                <ActivityIndicator color={Colors.primary} />
            ) : null}
        />
    );
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
        fontSize: Typography.sizes.xl,
        fontWeight: '800',
        color: Colors.text.primary,
    },
    subtitle: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
    tabs: {
        marginHorizontal: Spacing.md,
    },
    loader: {
        marginTop: Spacing.xl,
    },
    listContent: {
        padding: Spacing.md,
        gap: Spacing.md,
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
        fontSize: Typography.sizes.base,
        fontWeight: '800',
        color: Colors.text.primary,
    },
    meta: {
        fontSize: Typography.sizes.xs,
        fontWeight: '600',
        color: Colors.text.muted,
    },
    body: {
        fontSize: Typography.sizes.sm,
        lineHeight: 19,
        color: Colors.text.secondary,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    acceptButton: {
        minHeight: 38,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        borderRadius: Radius.pill,
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.md,
    },
    primaryButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '800',
        color: Colors.textOn.primary,
    },
    rejectButton: {
        minHeight: 38,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        borderRadius: Radius.pill,
        backgroundColor: Colors.dangerSubtle,
        paddingHorizontal: Spacing.md,
    },
    rejectText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '800',
        color: Colors.danger,
    },
    resolveButton: {
        minHeight: 38,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        borderRadius: Radius.pill,
        backgroundColor: Colors.primarySubtle,
        paddingHorizontal: Spacing.md,
    },
    resolveText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '800',
        color: Colors.primary,
    },
    messages: {
        maxHeight: 180,
    },
    messageRow: {
        borderTopWidth: 1,
        borderTopColor: Colors.border.subtle,
        paddingVertical: Spacing.sm,
        gap: 2,
    },
    messageAuthor: {
        fontSize: Typography.sizes.xs,
        fontWeight: '800',
        color: Colors.text.primary,
    },
    replyInput: {
        minHeight: 72,
        textAlignVertical: 'top',
    },
    disabled: {
        opacity: 0.5,
    },
});
