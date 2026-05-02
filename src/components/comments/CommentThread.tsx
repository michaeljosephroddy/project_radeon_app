import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Keyboard,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { KeyboardAvoidingView, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../Avatar';
import type { CommentMention, User } from '../../api/client';
import { Colors, Spacing, Typography } from '../../theme';
import { formatReadableTimestamp } from '../../utils/date';
import { formatUsername } from '../../utils/identity';
import { composerStandards } from '../../styles/composerStandards';
import { CommentDisplayModel, CommentThreadAdapter, CommentThreadUserProfile } from './commentTypes';

const INITIAL_VISIBLE = 20;
const PAGE_VISIBLE = 20;
const EMPTY_SUGGESTIONS: User[] = [];

interface ActiveMentionState {
    query: string;
    tokenStart: number;
    tokenEnd: number;
}

export interface CommentThreadProps {
    adapter: CommentThreadAdapter;
    currentUser: User;
    initialCommentCount: number;
    focusComposer: boolean;
    onPressUser: (profile: CommentThreadUserProfile) => void;
    onCommentCreated?: (comment: CommentDisplayModel) => void;
}

function isMentionBodyChar(ch: string): boolean {
    return /[a-z0-9._]/i.test(ch);
}

function findActiveMention(value: string): ActiveMentionState | undefined {
    const match = value.match(/(^|\s)@([a-z0-9._]*)$/i);
    if (!match || match.index === undefined) return undefined;
    return {
        query: match[2] ?? '',
        tokenStart: match.index + match[1].length,
        tokenEnd: value.length,
    };
}

function extractMentionHandles(value: string): string[] {
    const matches = value.match(/(^|\s)@([a-z0-9._]+)/gi) ?? [];
    const seen = new Set<string>();
    const handles: string[] = [];
    matches.forEach(match => {
        const handle = match.trim().slice(1).toLowerCase();
        if (seen.has(handle)) return;
        seen.add(handle);
        handles.push(handle);
    });
    return handles;
}

function collectMentionUserIds(value: string, selectedMentionUserIds: Record<string, string>): string[] {
    const ids = new Set<string>();
    extractMentionHandles(value).forEach(handle => {
        const id = selectedMentionUserIds[handle];
        if (id) ids.add(id);
    });
    return Array.from(ids);
}

function pruneSelectedMentions(value: string, store: Record<string, string>): Record<string, string> {
    const handles = new Set(extractMentionHandles(value));
    return Object.fromEntries(
        Object.entries(store).filter(([username]) => handles.has(username)),
    );
}

function buildOptimisticComment(params: {
    threadId: string;
    body: string;
    user: User;
    selectedMentionUserIds: Record<string, string>;
}): CommentDisplayModel {
    const mentionEntries = Object.entries(params.selectedMentionUserIds)
        .filter(([username]) => params.body.toLowerCase().includes(`@${username}`))
        .map(([username, userId]) => ({ user_id: userId, username }));
    return {
        id: `optimistic-${params.threadId}-${Date.now()}`,
        userId: params.user.id,
        username: params.user.username,
        avatarUrl: params.user.avatar_url,
        body: params.body,
        createdAt: new Date().toISOString(),
        mentions: mentionEntries,
    };
}

function renderCommentBody(
    comment: CommentDisplayModel,
    onPressUser: (profile: CommentThreadUserProfile) => void,
): React.ReactNode {
    const mentionByUsername = new Map(
        (comment.mentions ?? []).map(m => [m.username.toLowerCase(), m]),
    );
    const parts: Array<{ key: string; text: string; mention?: CommentMention }> = [];
    let cursor = 0;
    let lastPlainStart = 0;
    let keyIndex = 0;

    while (cursor < comment.body.length) {
        if (
            comment.body[cursor] === '@' &&
            (cursor === 0 || !isMentionBodyChar(comment.body[cursor - 1]))
        ) {
            let next = cursor + 1;
            while (next < comment.body.length && isMentionBodyChar(comment.body[next])) next++;
            if (next > cursor + 1) {
                const username = comment.body.slice(cursor + 1, next).toLowerCase();
                const mention = mentionByUsername.get(username);
                if (mention) {
                    if (lastPlainStart < cursor) {
                        parts.push({ key: `plain-${keyIndex++}`, text: comment.body.slice(lastPlainStart, cursor) });
                    }
                    parts.push({ key: `mention-${keyIndex++}`, text: comment.body.slice(cursor, next), mention });
                    cursor = next;
                    lastPlainStart = next;
                    continue;
                }
            }
        }
        cursor++;
    }

    if (lastPlainStart < comment.body.length) {
        parts.push({ key: `plain-${keyIndex++}`, text: comment.body.slice(lastPlainStart) });
    }

    if (parts.length === 0) return comment.body;

    return parts.map(part =>
        part.mention ? (
            <Text
                key={part.key}
                style={styles.commentMention}
                onPress={() => onPressUser({
                    userId: part.mention!.user_id,
                    username: part.mention!.username,
                })}
            >
                {part.text}
            </Text>
        ) : (
            <Text key={part.key}>{part.text}</Text>
        ),
    );
}

const CommentItem = React.memo(function CommentItem({
    comment,
    onPressUser,
}: {
    comment: CommentDisplayModel;
    onPressUser: (profile: CommentThreadUserProfile) => void;
}) {
    return (
        <View style={styles.commentRow}>
            <Avatar username={comment.username} avatarUrl={comment.avatarUrl} size={28} fontSize={11} />
            <View style={styles.commentBodyWrap}>
                <View style={styles.commentBubble}>
                    <View style={styles.commentHeader}>
                        <Text style={styles.commentAuthor}>{formatUsername(comment.username)}</Text>
                        <Text style={styles.commentMeta}>{formatReadableTimestamp(comment.createdAt)}</Text>
                    </View>
                    <Text style={styles.commentBody}>
                        {renderCommentBody(comment, onPressUser)}
                    </Text>
                </View>
            </View>
        </View>
    );
});

function ComposerPadding({ basePadding, children }: { basePadding: number; children: React.ReactNode }): React.ReactElement {
    const { height } = useReanimatedKeyboardAnimation();
    const style = useAnimatedStyle(() => ({
        paddingBottom: Math.max(basePadding + height.value, Spacing.sm),
    }));
    return <Reanimated.View style={[composerStandards.row, styles.composer, style]}>{children}</Reanimated.View>;
}

export function CommentThread({
    adapter,
    currentUser,
    initialCommentCount,
    focusComposer,
    onPressUser,
    onCommentCreated,
}: CommentThreadProps): React.ReactElement {
    const insets = useSafeAreaInsets();
    const inputRef = useRef<TextInput>(null);
    const mentionSearchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const mentionSearchSeqRef = useRef(0);
    const selectedMentionUserIdsRef = useRef<Record<string, string>>({});
    const isLoadingMoreRef = useRef(false);
    const cursorRef = useRef<string | undefined>(undefined);

    const [comments, setComments] = useState<CommentDisplayModel[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingInitial, setIsLoadingInitial] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [commentCount, setCommentCount] = useState(initialCommentCount);
    const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
    const [draft, setDraft] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [activeMention, setActiveMention] = useState<ActiveMentionState | undefined>(undefined);
    const [activeMentionSuggestions, setActiveMentionSuggestions] = useState<User[]>(EMPTY_SUGGESTIONS);
    const [isMentionSearching, setIsMentionSearching] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setIsLoadingInitial(true);
        setComments([]);
        setHasMore(false);
        setCommentCount(initialCommentCount);
        cursorRef.current = undefined;

        adapter.loadComments()
            .then(result => {
                if (cancelled) return;
                setComments(result.items ?? []);
                cursorRef.current = result.next_cursor ?? undefined;
                setHasMore(result.has_more);
            })
            .catch(() => {
                if (!cancelled) Alert.alert('Error', 'Could not load comments.');
            })
            .finally(() => {
                if (!cancelled) setIsLoadingInitial(false);
            });

        return () => { cancelled = true; };
    }, [adapter, initialCommentCount]);

    useEffect(() => () => {
        if (mentionSearchTimerRef.current) clearTimeout(mentionSearchTimerRef.current);
    }, []);

    useEffect(() => {
        if (!focusComposer) return;
        const timer = setTimeout(() => inputRef.current?.focus(), 350);
        return () => clearTimeout(timer);
    }, [focusComposer]);

    const visibleComments = useMemo(
        () => comments.slice(0, visibleCount),
        [comments, visibleCount],
    );

    const handleEndReached = useCallback(async (): Promise<void> => {
        if (visibleCount < comments.length) {
            setVisibleCount(v => v + PAGE_VISIBLE);
            return;
        }
        if (!hasMore || isLoadingMoreRef.current) return;
        isLoadingMoreRef.current = true;
        setIsLoadingMore(true);
        try {
            const result = await adapter.loadComments(cursorRef.current);
            cursorRef.current = result.next_cursor ?? undefined;
            setHasMore(result.has_more);
            setComments(prev => {
                const existingIds = new Set(prev.map(c => c.id));
                const newItems = (result.items ?? []).filter(c => !existingIds.has(c.id));
                return [...prev, ...newItems];
            });
            setVisibleCount(v => v + PAGE_VISIBLE);
        } finally {
            isLoadingMoreRef.current = false;
            setIsLoadingMore(false);
        }
    }, [adapter, comments.length, hasMore, visibleCount]);

    const handleDraftChange = useCallback((value: string): void => {
        setDraft(value);
        selectedMentionUserIdsRef.current = pruneSelectedMentions(value, selectedMentionUserIdsRef.current);

        const nextMention = findActiveMention(value);
        setActiveMention(nextMention);

        if (mentionSearchTimerRef.current) clearTimeout(mentionSearchTimerRef.current);

        if (!nextMention || !nextMention.query.trim()) {
            setActiveMentionSuggestions(EMPTY_SUGGESTIONS);
            setIsMentionSearching(false);
            return;
        }

        mentionSearchTimerRef.current = setTimeout(async () => {
            const seq = ++mentionSearchSeqRef.current;
            if (!adapter.searchMentionUsers) {
                setActiveMentionSuggestions(EMPTY_SUGGESTIONS);
                setIsMentionSearching(false);
                return;
            }
            setIsMentionSearching(true);
            try {
                const result = await adapter.searchMentionUsers(nextMention.query);
                if (mentionSearchSeqRef.current !== seq) return;
                setActiveMentionSuggestions(result);
            } catch {
                if (mentionSearchSeqRef.current !== seq) return;
                setActiveMentionSuggestions(EMPTY_SUGGESTIONS);
            } finally {
                if (mentionSearchSeqRef.current !== seq) return;
                setIsMentionSearching(false);
            }
        }, 180);
    }, [adapter]);

    const handleSelectMention = useCallback((selectedUser: User): void => {
        if (!activeMention) return;
        const nextValue = `${draft.slice(0, activeMention.tokenStart)}@${selectedUser.username} ${draft.slice(activeMention.tokenEnd)}`;
        setDraft(nextValue);
        selectedMentionUserIdsRef.current = {
            ...selectedMentionUserIdsRef.current,
            [selectedUser.username.toLowerCase()]: selectedUser.id,
        };
        setActiveMention(undefined);
        setActiveMentionSuggestions(EMPTY_SUGGESTIONS);
        setIsMentionSearching(false);
    }, [activeMention, draft]);

    const handleSubmit = useCallback(async (): Promise<void> => {
        const body = draft.trim();
        if (!body || submitting) return;

        const mentionUserIds = collectMentionUserIds(body, selectedMentionUserIdsRef.current);
        const selectedMentionUserIds = { ...selectedMentionUserIdsRef.current };
        const optimisticComment = buildOptimisticComment({
            body,
            threadId: currentUser.id,
            user: currentUser,
            selectedMentionUserIds,
        });

        setSubmitting(true);
        setDraft('');
        setActiveMention(undefined);
        setActiveMentionSuggestions(EMPTY_SUGGESTIONS);
        selectedMentionUserIdsRef.current = {};
        Keyboard.dismiss();
        setComments(prev => [...prev, optimisticComment]);
        setCommentCount(prev => prev + 1);
        setVisibleCount(v => v + 1);

        try {
            const newComment = await adapter.createComment(body, mentionUserIds);
            setComments(prev => prev.map(c => c.id === optimisticComment.id ? newComment : c));
            onCommentCreated?.(newComment);
        } catch (e) {
            setComments(prev => prev.filter(c => c.id !== optimisticComment.id));
            setCommentCount(prev => Math.max(0, prev - 1));
            setDraft(body);
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setSubmitting(false);
        }
    }, [adapter, currentUser, draft, onCommentCreated, submitting]);

    const renderComment = useCallback(
        ({ item }: { item: CommentDisplayModel }) => (
            <CommentItem comment={item} onPressUser={onPressUser} />
        ),
        [onPressUser],
    );

    const keyExtractor = useCallback((item: CommentDisplayModel) => item.id, []);
    const ItemSeparator = useCallback(() => <View style={styles.separator} />, []);

    const listFooter = isLoadingMore
        ? <ActivityIndicator style={styles.loadingMore} color={Colors.primary} size="small" />
        : null;
    const bottomPad = insets.bottom + Spacing.sm;

    return (
        <KeyboardAvoidingView behavior="padding" style={styles.fill}>
            {isLoadingInitial ? (
                <View style={styles.loadingInitial}>
                    <ActivityIndicator color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={visibleComments}
                    keyExtractor={keyExtractor}
                    renderItem={renderComment}
                    ItemSeparatorComponent={ItemSeparator}
                    contentContainerStyle={styles.list}
                    onEndReached={handleEndReached}
                    onEndReachedThreshold={0.4}
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={
                        <Text style={styles.empty}>No comments yet. Be the first!</Text>
                    }
                    ListFooterComponent={listFooter}
                />
            )}

            {!!activeMention?.query.trim() && (
                <View style={styles.mentionPanel}>
                    {isMentionSearching ? (
                        <ActivityIndicator size="small" color={Colors.primary} style={styles.mentionLoader} />
                    ) : activeMentionSuggestions.length > 0 ? (
                        activeMentionSuggestions.map(u => (
                            <TouchableOpacity
                                key={u.id}
                                style={styles.mentionRow}
                                onPress={() => handleSelectMention(u)}
                            >
                                <Avatar username={u.username} avatarUrl={u.avatar_url} size={26} fontSize={10} />
                                <Text style={styles.mentionRowText}>{formatUsername(u.username)}</Text>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <Text style={styles.mentionEmpty}>No matches for @{activeMention.query}</Text>
                    )}
                </View>
            )}

            <ComposerPadding basePadding={bottomPad}>
                <Avatar
                    username={currentUser.username}
                    avatarUrl={currentUser.avatar_url}
                    size={30}
                    fontSize={12}
                />
                <TextInput
                    ref={inputRef}
                    style={[composerStandards.input, styles.composerInput]}
                    placeholder="Write a comment..."
                    placeholderTextColor={Colors.text.muted}
                    value={draft}
                    onChangeText={handleDraftChange}
                    editable={!submitting}
                    multiline
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={1000}
                    textAlignVertical="top"
                />
                <TouchableOpacity
                    style={[
                        composerStandards.sendButton,
                        (!draft.trim() || submitting) && composerStandards.sendButtonDisabled,
                        (!draft.trim() || submitting) && styles.sendButtonDisabled,
                    ]}
                    onPress={handleSubmit}
                    disabled={!draft.trim() || submitting}
                >
                    {submitting
                        ? <ActivityIndicator size="small" color={Colors.textOn.primary} />
                        : <Ionicons name="send" size={16} color={Colors.textOn.primary} />
                    }
                </TouchableOpacity>
            </ComposerPadding>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    fill: {
        flex: 1,
    },
    loadingInitial: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    list: {
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.md,
        flexGrow: 1,
    },
    separator: {
        height: 1,
        backgroundColor: Colors.border.default,
        marginLeft: Spacing.md + 28 + Spacing.sm,
    },
    empty: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.muted,
        textAlign: 'center',
        paddingTop: Spacing.xl,
    },
    loadingMore: {
        paddingVertical: Spacing.md,
    },
    mentionPanel: {
        borderTopWidth: 0.5,
        borderTopColor: Colors.border.default,
        borderBottomWidth: 0.5,
        borderBottomColor: Colors.border.default,
        backgroundColor: Colors.bg.page,
        paddingVertical: 4,
    },
    mentionLoader: {
        paddingVertical: 10,
    },
    mentionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: 8,
    },
    mentionRowText: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.primary,
        fontWeight: '500',
    },
    mentionEmpty: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.muted,
        paddingHorizontal: Spacing.md,
        paddingVertical: 8,
    },
    composer: {
        paddingHorizontal: Spacing.md,
    },
    composerInput: {
        maxHeight: 100,
    },
    sendButtonDisabled: {
        opacity: 0.4,
    },
    commentRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    commentBodyWrap: {
        flex: 1,
        minWidth: 0,
    },
    commentBubble: {
        backgroundColor: Colors.bg.page,
    },
    commentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    commentAuthor: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.text.primary,
    },
    commentMeta: {
        fontSize: Typography.sizes.xs,
        color: Colors.text.muted,
    },
    commentBody: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.secondary,
        lineHeight: 18,
    },
    commentMention: {
        color: Colors.primary,
        fontWeight: '600',
    },
});
