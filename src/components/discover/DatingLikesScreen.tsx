import React, { useCallback } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../Avatar';
import { DiscoverEmptyState } from './DiscoverEmptyState';
import * as api from '../../api/client';
import { getRecoveryMilestone } from '../../utils/date';
import { formatUsername } from '../../utils/identity';
import { Colors, Radius, Spacing, TextStyles, Typography } from '../../theme';

interface DatingLikesScreenProps {
    likes: api.User[];
    loading: boolean;
    fetchingNext: boolean;
    hasNextPage: boolean;
    pendingActionIds: Set<string>;
    onBack: () => void;
    onLike: (user: api.User) => void;
    onPass: (user: api.User) => void;
    onOpenProfile: (user: api.User) => void;
    onLoadMore: () => void;
}

export function DatingLikesScreen({
    likes,
    loading,
    fetchingNext,
    hasNextPage,
    pendingActionIds,
    onBack,
    onLike,
    onPass,
    onOpenProfile,
    onLoadMore,
}: DatingLikesScreenProps) {
    const handleEndReached = useCallback((): void => {
        if (hasNextPage && !fetchingNext) {
            onLoadMore();
        }
    }, [fetchingNext, hasNextPage, onLoadMore]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={onBack}
                    activeOpacity={0.84}
                    accessibilityRole="button"
                    accessibilityLabel="Back to Dating"
                >
                    <Ionicons name="chevron-back" size={22} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.title}>Liked you</Text>
                <View style={styles.headerSpacer} />
            </View>

            {loading && likes.length === 0 ? (
                <View style={styles.center}>
                    <ActivityIndicator color={Colors.primary} size="large" />
                </View>
            ) : likes.length === 0 ? (
                <DiscoverEmptyState
                    title="No likes right now"
                    description="When someone likes you in Dating, they will appear here."
                />
            ) : (
                <FlatList
                    data={likes}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => (
                        <DatingLikeRow
                            user={item}
                            pending={pendingActionIds.has(item.id)}
                            onLike={() => onLike(item)}
                            onPass={() => onPass(item)}
                            onOpenProfile={() => onOpenProfile(item)}
                        />
                    )}
                    onEndReached={handleEndReached}
                    onEndReachedThreshold={0.35}
                    ListFooterComponent={fetchingNext ? (
                        <ActivityIndicator color={Colors.primary} style={styles.footerLoader} />
                    ) : null}
                />
            )}
        </View>
    );
}

function DatingLikeRow({
    user,
    pending,
    onLike,
    onPass,
    onOpenProfile,
}: {
    user: api.User;
    pending: boolean;
    onLike: () => void;
    onPass: () => void;
    onOpenProfile: () => void;
}) {
    const milestone = getRecoveryMilestone(user.sober_since);
    const locationLabel = user.city
        ? `${user.city}${user.country ? `, ${user.country}` : ''}`
        : user.country ?? null;
    const metaLabel = [milestone?.currentLabel, locationLabel].filter(Boolean).join(' · ');
    const interestPreview = user.interests.slice(0, 3).join(' · ');

    return (
        <View style={styles.row}>
            <TouchableOpacity style={styles.profileArea} onPress={onOpenProfile} activeOpacity={0.86}>
                <Avatar username={user.username} avatarUrl={user.avatar_url} size={58} fontSize={20} />
                <View style={styles.profileText}>
                    <Text style={styles.username} numberOfLines={1}>{formatUsername(user.username)}</Text>
                    {metaLabel ? <Text style={styles.meta} numberOfLines={1}>{metaLabel}</Text> : null}
                    {user.bio ? (
                        <Text style={styles.bio} numberOfLines={2}>{user.bio}</Text>
                    ) : interestPreview ? (
                        <Text style={styles.bio} numberOfLines={1}>{interestPreview}</Text>
                    ) : null}
                </View>
            </TouchableOpacity>

            <View style={styles.actions}>
                <TouchableOpacity
                    style={[styles.actionButton, styles.passButton]}
                    onPress={onPass}
                    disabled={pending}
                    activeOpacity={0.84}
                    accessibilityLabel={`Pass on ${formatUsername(user.username)}`}
                >
                    <Text style={[styles.actionText, styles.passText]}>Pass</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionButton, styles.likeButton]}
                    onPress={onLike}
                    disabled={pending}
                    activeOpacity={0.84}
                    accessibilityLabel={`Like back ${formatUsername(user.username)}`}
                >
                    <Text style={[styles.actionText, styles.likeText]}>Like back</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    header: {
        minHeight: 46,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: 2,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.subtle,
    },
    backButton: {
        width: 34,
        height: 34,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg.surface,
        borderWidth: 1,
        borderColor: Colors.border.default,
    },
    title: {
        fontSize: Typography.sizes.lg,
        fontWeight: '800',
        color: Colors.text.primary,
    },
    headerSpacer: {
        width: 34,
        height: 34,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.md,
        gap: Spacing.sm,
    },
    row: {
        gap: Spacing.sm,
        padding: Spacing.sm,
        borderRadius: Radius.lg,
        backgroundColor: Colors.bg.surface,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    profileArea: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    profileText: {
        flex: 1,
        minWidth: 0,
        gap: 2,
    },
    username: {
        fontSize: Typography.sizes.md,
        fontWeight: '800',
        color: Colors.text.primary,
    },
    meta: {
        ...TextStyles.secondary,
        color: Colors.text.secondary,
    },
    bio: {
        ...TextStyles.secondary,
        color: Colors.text.muted,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    actionButton: {
        flex: 1,
        minHeight: 42,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    passButton: {
        borderColor: Colors.danger,
        backgroundColor: Colors.dangerSubtle,
    },
    likeButton: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary,
    },
    actionText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '800',
    },
    passText: {
        color: Colors.danger,
    },
    likeText: {
        color: Colors.textOn.primary,
    },
    footerLoader: {
        paddingVertical: Spacing.md,
    },
});
