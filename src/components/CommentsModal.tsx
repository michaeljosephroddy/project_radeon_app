import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
    View, Text, FlatList, TextInput, TouchableOpacity,
    StyleSheet, ActivityIndicator, Keyboard, Alert, BackHandler,
    Dimensions,
} from 'react-native';
import { KeyboardProvider, KeyboardAvoidingView, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Reanimated, {
    useSharedValue, useAnimatedStyle, withTiming, runOnJS, Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from './Avatar';
import { ScreenHeader } from './ui/ScreenHeader';
import * as api from '../api/client';
import { Colors, Header, Typography, Spacing, Radii } from '../utils/theme';
import { formatUsername } from '../utils/identity';
import { formatReadableTimestamp } from '../utils/date';
import { composerStandards } from '../styles/composerStandards';

const INITIAL_VISIBLE = 20;
const PAGE_VISIBLE = 20;
const SCREEN_HEIGHT = Dimensions.get('screen').height;

interface ActiveMentionState {
    query: string;
    tokenStart: number;
    tokenEnd: number;
}

export interface CommentsModalProps {
    post: api.Post;
    currentUser: api.User;
    focusComposer: boolean;
    onClose: () => void;
    onPressUser: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
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

function pruneSelectedMentions(
    value: string,
    store: Record<string, string>,
): Record<string, string> {
    const handles = new Set(extractMentionHandles(value));
    return Object.fromEntries(
        Object.entries(store).filter(([username]) => handles.has(username))
    );
}

function buildOptimisticComment(params: {
    postId: string;
    body: string;
    user: api.User;
    selectedMentionUserIds: Record<string, string>;
}): api.Comment {
    const mentionEntries = Object.entries(params.selectedMentionUserIds)
        .filter(([username]) => params.body.toLowerCase().includes(`@${username}`))
        .map(([username, userId]) => ({ user_id: userId, username }));
    return {
        id: `optimistic-${params.postId}-${Date.now()}`,
        user_id: params.user.id,
        username: params.user.username,
        avatar_url: params.user.avatar_url,
        body: params.body,
        created_at: new Date().toISOString(),
        mentions: mentionEntries,
    };
}

function renderCommentBody(
    comment: api.Comment,
    onPressUser: (profile: { userId: string; username: string; avatarUrl?: string }) => void,
): React.ReactNode {
    const mentionByUsername = new Map(
        (comment.mentions ?? []).map(m => [m.username.toLowerCase(), m])
    );
    const parts: Array<{ key: string; text: string; mention?: api.CommentMention }> = [];
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
        )
    );
}

const CommentItem = React.memo(function CommentItem({
    comment,
    onPressUser,
}: {
    comment: api.Comment;
    onPressUser: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
}) {
    return (
        <View style={styles.commentRow}>
            <Avatar username={comment.username} avatarUrl={comment.avatar_url} size={28} fontSize={11} />
            <View style={styles.commentBodyWrap}>
                <View style={styles.commentBubble}>
                    <View style={styles.commentHeader}>
                        <Text style={styles.commentAuthor}>{formatUsername(comment.username)}</Text>
                        <Text style={styles.commentMeta}>{formatReadableTimestamp(comment.created_at)}</Text>
                    </View>
                    <Text style={styles.commentBody}>
                        {renderCommentBody(comment, onPressUser)}
                    </Text>
                </View>
            </View>
        </View>
    );
});

// Wraps the composer row and smoothly removes the bottom safe-area padding as
// the keyboard rises (the keyboard already covers the home-indicator area).
function ComposerPadding({ basePadding, children }: { basePadding: number; children: React.ReactNode }) {
    const { height } = useReanimatedKeyboardAnimation();
    const style = useAnimatedStyle(() => ({
        paddingBottom: Math.max(basePadding + height.value, Spacing.sm),
    }));
    return <Reanimated.View style={[composerStandards.row, styles.composer, style]}>{children}</Reanimated.View>;
}

const EMPTY_SUGGESTIONS: api.User[] = [];

export function CommentsModal({
    post,
    currentUser,
    focusComposer,
    onClose,
    onPressUser,
}: CommentsModalProps) {
    const insets = useSafeAreaInsets();
    const inputRef = useRef<TextInput>(null);
    const mentionSearchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const mentionSearchSeqRef = useRef(0);
    const selectedMentionUserIdsRef = useRef<Record<string, string>>({});
    const isLoadingMoreRef = useRef(false);
    const cursorRef = useRef<string | undefined>(undefined);

    // Slide-in animation
    const slideY = useSharedValue(SCREEN_HEIGHT);
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: slideY.value }],
    }));

    useEffect(() => {
        slideY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleClose = useCallback(() => {
        Keyboard.dismiss();
        slideY.value = withTiming(SCREEN_HEIGHT, { duration: 220 }, () => {
            runOnJS(onClose)();
        });
    }, [onClose, slideY]);

    // Android back button
    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            handleClose();
            return true;
        });
        return () => sub.remove();
    }, [handleClose]);

    // Comments data
    const [comments, setComments] = useState<api.Comment[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingInitial, setIsLoadingInitial] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Comment UI state
    const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
    const [draft, setDraft] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [activeMention, setActiveMention] = useState<ActiveMentionState | undefined>(undefined);
    const [activeMentionSuggestions, setActiveMentionSuggestions] = useState<api.User[]>(EMPTY_SUGGESTIONS);
    const [isMentionSearching, setIsMentionSearching] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setIsLoadingInitial(true);
        setComments([]);
        setHasMore(false);
        cursorRef.current = undefined;

        api.getComments(post.id)
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
    }, [post.id]);

    useEffect(() => () => {
        if (mentionSearchTimerRef.current) clearTimeout(mentionSearchTimerRef.current);
    }, []);

    // Auto-focus composer when opened from a notification or explicit request.
    useEffect(() => {
        if (!focusComposer) return;
        const timer = setTimeout(() => inputRef.current?.focus(), 350);
        return () => clearTimeout(timer);
    }, [focusComposer]);

    const visibleComments = useMemo(
        () => comments.slice(0, visibleCount),
        [comments, visibleCount],
    );

    const handleEndReached = useCallback(async () => {
        if (visibleCount < comments.length) {
            setVisibleCount(v => v + PAGE_VISIBLE);
            return;
        }
        if (!hasMore || isLoadingMoreRef.current) return;
        isLoadingMoreRef.current = true;
        setIsLoadingMore(true);
        try {
            const result = await api.getComments(post.id, cursorRef.current);
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
    }, [visibleCount, comments.length, hasMore, post.id]);

    const handleDraftChange = useCallback((value: string) => {
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
            setIsMentionSearching(true);
            try {
                const result = await api.discoverUsers({ query: nextMention.query, page: 1, limit: 5 });
                if (mentionSearchSeqRef.current !== seq) return;
                setActiveMentionSuggestions(result.items ?? EMPTY_SUGGESTIONS);
            } catch {
                if (mentionSearchSeqRef.current !== seq) return;
                setActiveMentionSuggestions(EMPTY_SUGGESTIONS);
            } finally {
                if (mentionSearchSeqRef.current !== seq) return;
                setIsMentionSearching(false);
            }
        }, 180);
    }, []);

    const handleSelectMention = useCallback((selectedUser: api.User) => {
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
    }, [draft, activeMention]);

    const handleSubmit = useCallback(async () => {
        const body = draft.trim();
        if (!body || submitting) return;

        const mentionUserIds = collectMentionUserIds(body, selectedMentionUserIdsRef.current);
        const selectedMentionUserIds = { ...selectedMentionUserIdsRef.current };

        const optimisticComment = buildOptimisticComment({ body, postId: post.id, user: currentUser, selectedMentionUserIds });

        setSubmitting(true);
        setDraft('');
        setActiveMention(undefined);
        setActiveMentionSuggestions(EMPTY_SUGGESTIONS);
        selectedMentionUserIdsRef.current = {};
        Keyboard.dismiss();
        setComments(prev => [...prev, optimisticComment]);
        setVisibleCount(v => v + 1);

        try {
            const newComment = await api.addComment(post.id, body, mentionUserIds);
            setComments(prev => prev.map(c => c.id === optimisticComment.id ? newComment : c));
        } catch (e) {
            setComments(prev => prev.filter(c => c.id !== optimisticComment.id));
            setDraft(body);
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setSubmitting(false);
        }
    }, [draft, submitting, post.id, currentUser]);

    const renderComment = useCallback(
        ({ item }: { item: api.Comment }) => (
            <CommentItem comment={item} onPressUser={onPressUser} />
        ),
        [onPressUser],
    );

    const keyExtractor = useCallback((item: api.Comment) => item.id, []);
    const ItemSeparator = useCallback(() => <View style={styles.separator} />, []);

    const listFooter = isLoadingMore
        ? <ActivityIndicator style={styles.loadingMore} color={Colors.primary} size="small" />
        : null;

    const headerTitle = post.comment_count > 0
        ? `${post.comment_count} Comment${post.comment_count === 1 ? '' : 's'}`
        : 'Comments';

    const topPad = insets.top + Header.paddingVertical;
    const bottomPad = insets.bottom + Spacing.sm;

    return (
        <Reanimated.View style={[styles.container, animatedStyle]}>
            <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
                {/* Header stays outside KAV so it doesn't move with the keyboard */}
                <ScreenHeader
                    title={headerTitle}
                    style={[styles.header, { paddingTop: topPad }]}
                    trailing={(
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="close" size={22} color={Colors.light.textPrimary} />
                        </TouchableOpacity>
                    )}
                />

                {/* List + mention panel + composer rise together with the keyboard */}
                <KeyboardAvoidingView
                    behavior="padding"
                    style={styles.fill}
                >
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
                            placeholder="Write a comment…"
                            placeholderTextColor={Colors.light.textTertiary}
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
            </KeyboardProvider>
        </Reanimated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    fill: {
        flex: 1,
    },
    header: {
        paddingBottom: Spacing.sm,
    },
    closeButton: {
        padding: 4,
    },
    loadingInitial: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    list: {
        padding: Spacing.md,
        flexGrow: 1,
    },
    separator: {
        height: Spacing.sm,
    },
    empty: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
        textAlign: 'center',
        paddingTop: Spacing.xl,
    },
    loadingMore: {
        paddingVertical: Spacing.md,
    },
    mentionPanel: {
        borderTopWidth: 0.5,
        borderTopColor: Colors.light.border,
        borderBottomWidth: 0.5,
        borderBottomColor: Colors.light.border,
        backgroundColor: Colors.light.background,
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
        color: Colors.light.textPrimary,
        fontWeight: '500',
    },
    mentionEmpty: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
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
    },
    commentBodyWrap: {
        flex: 1,
        minWidth: 0,
    },
    commentBubble: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.md,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 8,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
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
        color: Colors.light.textPrimary,
    },
    commentMeta: {
        fontSize: Typography.sizes.xs,
        color: Colors.light.textTertiary,
    },
    commentBody: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textSecondary,
        lineHeight: 18,
    },
    commentMention: {
        color: Colors.primary,
        fontWeight: '600',
    },
});
