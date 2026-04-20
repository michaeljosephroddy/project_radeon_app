import React, { useCallback, useEffect, useRef } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { Avatar } from '../../../components/Avatar';
import * as api from '../../../api/client';
import { Colors, Typography, Spacing, Radii } from '../../../utils/theme';
import { formatUsername } from '../../../utils/identity';
import { formatReadableTimestamp } from '../../../utils/date';

type MutationKind = 'replace' | 'append' | 'prepend' | 'remove';

export interface MessageMutation {
    kind: MutationKind;
    version: number;
}

interface MessageThreadListProps {
    messages: api.Message[];
    hasMore: boolean;
    loadingOlder: boolean;
    onLoadOlder: () => void;
    onBottomSlackChange?: (slack: number) => void;
    mutation: MessageMutation;
    currentUser?: { id: string; username: string; avatar_url?: string };
    chat: api.Chat;
}

const NEAR_BOTTOM_THRESHOLD = 120;

interface MessageRowProps {
    message: api.Message;
    currentUser?: { id: string; username: string; avatar_url?: string };
    chat: api.Chat;
}

const MessageRow = React.memo(function MessageRow({
    message,
    currentUser,
    chat,
}: MessageRowProps) {
    const isMe = message.sender_id === currentUser?.id;
    const senderLabel = formatUsername(isMe ? (currentUser?.username ?? message.username) : message.username);
    const avatarUrl = getMessageAvatarUrl(message, currentUser, chat);

    return (
        <View style={styles.bubbleRow}>
            <Avatar
                username={isMe ? (currentUser?.username ?? message.username) : message.username}
                avatarUrl={avatarUrl}
                size={26}
                fontSize={10}
            />
            <View style={[styles.bubbleInner, isMe ? styles.bubbleInnerMe : styles.bubbleInnerThem]}>
                <View style={styles.messageHeader}>
                    <Text style={[styles.senderName, isMe && styles.senderNameMe]}>{senderLabel}</Text>
                    <Text style={[styles.messageMeta, isMe && styles.messageMetaMe]}>
                        {formatReadableTimestamp(message.sent_at)}
                    </Text>
                </View>
                <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{message.body}</Text>
            </View>
        </View>
    );
});

function MessageThreadListComponent({
    messages,
    hasMore,
    loadingOlder,
    onLoadOlder,
    onBottomSlackChange,
    mutation,
    currentUser,
    chat,
}: MessageThreadListProps) {
    const listRef = useRef<FlatList<api.Message>>(null);
    const contentHeightRef = useRef(0);
    const layoutHeightRef = useRef(0);
    const scrollOffsetRef = useRef(0);
    const preserveScrollOffsetRef = useRef<number | null>(null);
    const pendingMutationRef = useRef<MessageMutation>(mutation);
    const shouldAutoScrollRef = useRef(true);
    const bottomSlackRef = useRef(-1);

    useEffect(() => {
        pendingMutationRef.current = mutation;
    }, [mutation]);

    const scrollToBottom = useCallback((animated: boolean) => {
        requestAnimationFrame(() => {
            listRef.current?.scrollToEnd({ animated });
        });
    }, []);

    const handleLoadOlderPress = useCallback(() => {
        preserveScrollOffsetRef.current = scrollOffsetRef.current;
        onLoadOlder();
    }, [onLoadOlder]);

    const updateBottomSlack = useCallback(() => {
        const nextSlack = Math.max(layoutHeightRef.current - contentHeightRef.current, 0);
        if (bottomSlackRef.current === nextSlack) return;
        bottomSlackRef.current = nextSlack;
        onBottomSlackChange?.(nextSlack);
    }, [onBottomSlackChange]);

    const handleContentSizeChange = useCallback((_width: number, height: number) => {
        const previousHeight = contentHeightRef.current;
        contentHeightRef.current = height;
        updateBottomSlack();
        const nextMutation = pendingMutationRef.current;

        if (nextMutation.kind === 'replace') {
            pendingMutationRef.current = { kind: 'remove', version: nextMutation.version };
            scrollToBottom(false);
            return;
        }

        if (nextMutation.kind === 'append') {
            pendingMutationRef.current = { kind: 'remove', version: nextMutation.version };
            if (shouldAutoScrollRef.current) {
                scrollToBottom(previousHeight > 0);
            }
            return;
        }

        if (nextMutation.kind === 'prepend' && preserveScrollOffsetRef.current !== null) {
            const delta = height - previousHeight;
            const nextOffset = Math.max(preserveScrollOffsetRef.current + delta, 0);
            preserveScrollOffsetRef.current = null;
            pendingMutationRef.current = { kind: 'remove', version: nextMutation.version };
            requestAnimationFrame(() => {
                listRef.current?.scrollToOffset({ offset: nextOffset, animated: false });
            });
        }
    }, [scrollToBottom, updateBottomSlack]);

    const handleLayout = useCallback((event: { nativeEvent: { layout: { height: number } } }) => {
        layoutHeightRef.current = event.nativeEvent.layout.height;
        updateBottomSlack();
    }, [updateBottomSlack]);

    const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        scrollOffsetRef.current = contentOffset.y;
        const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
        shouldAutoScrollRef.current = distanceFromBottom <= NEAR_BOTTOM_THRESHOLD;
    }, []);

    return (
        <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={message => message.id}
            initialNumToRender={12}
            maxToRenderPerBatch={8}
            updateCellsBatchingPeriod={60}
            windowSize={8}
            style={styles.threadList}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onScroll={handleScroll}
            onLayout={handleLayout}
            scrollEventThrottle={32}
            onContentSizeChange={handleContentSizeChange}
            ListHeaderComponent={
                hasMore ? (
                    <View style={styles.listHeader}>
                        <TouchableOpacity
                            style={[styles.loadOlderButton, loadingOlder && styles.loadOlderButtonDisabled]}
                            onPress={handleLoadOlderPress}
                            disabled={loadingOlder}
                        >
                            <Text style={styles.loadOlderButtonText}>
                                {loadingOlder ? 'Loading...' : 'Load older messages'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : null
            }
            renderItem={({ item }) => (
                <MessageRow
                    message={item}
                    currentUser={currentUser}
                    chat={chat}
                />
            )}
        />
    );
}

MessageThreadListComponent.displayName = 'MessageThreadList';

export const MessageThreadList = React.memo(MessageThreadListComponent);

function getMessageAvatarUrl(
    message: api.Message,
    currentUser: { id: string; avatar_url?: string } | undefined,
    chat: api.Chat,
): string | undefined {
    if (message.avatar_url) return message.avatar_url;
    if (message.sender_id === currentUser?.id) return currentUser.avatar_url;
    if (!chat.is_group) return chat.avatar_url;
    return undefined;
}

const styles = StyleSheet.create({
    threadList: { flex: 1 },
    list: { padding: Spacing.md, paddingBottom: Spacing.sm, gap: Spacing.sm },
    listHeader: { marginBottom: Spacing.sm },
    bubbleRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
    bubbleInner: { maxWidth: '75%', borderRadius: Radii.md, padding: Spacing.sm },
    bubbleInnerMe: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
    bubbleInnerThem: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderBottomLeftRadius: 4,
    },
    messageHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 2,
    },
    senderName: {
        fontSize: Typography.sizes.xs,
        fontWeight: '500',
        color: Colors.light.textTertiary,
    },
    senderNameMe: { color: 'rgba(255,255,255,0.9)' },
    bubbleText: { fontSize: Typography.sizes.base, color: Colors.light.textPrimary, lineHeight: 18 },
    bubbleTextMe: { color: Colors.textOn.primary },
    messageMeta: {
        fontSize: Typography.sizes.xs,
        color: Colors.light.textTertiary,
    },
    messageMetaMe: { color: 'rgba(255,255,255,0.85)' },
    loadOlderButton: {
        alignSelf: 'center',
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.full,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
        paddingHorizontal: Spacing.md,
        paddingVertical: 8,
    },
    loadOlderButtonDisabled: { opacity: 0.6 },
    loadOlderButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.light.textSecondary,
    },
});
