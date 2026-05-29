import React, { useCallback, useMemo } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../Avatar';
import { DiscoverEmptyState } from './DiscoverEmptyState';
import { ScreenHeader } from '../ui/ScreenHeader';
import * as api from '../../api/client';
import { formatUsername } from '../../utils/identity';
import { Colors, ContentInsets, Radius, Spacing, TextStyles, Typography } from '../../theme';

interface DatingMatchesScreenProps {
    matches: api.DatingMatch[];
    loading: boolean;
    fetchingNext: boolean;
    hasNextPage: boolean;
    unmatchingIds: Set<string>;
    onBack: () => void;
    onOpenChat: (match: api.DatingMatch) => void;
    onOpenProfile: (profile: api.DatingProfile) => void;
    onUnmatch: (match: api.DatingMatch) => void;
    onLoadMore: () => void;
}

export function DatingMatchesScreen({
    matches,
    loading,
    fetchingNext,
    hasNextPage,
    unmatchingIds,
    onBack,
    onOpenChat,
    onOpenProfile,
    onUnmatch,
    onLoadMore,
}: DatingMatchesScreenProps): React.ReactElement {
    const safeMatches = useMemo(
        () => [...(matches ?? [])].sort((first, second) =>
            new Date(second.matched_at).getTime() - new Date(first.matched_at).getTime()),
        [matches],
    );

    const handleEndReached = useCallback((): void => {
        if (hasNextPage && !fetchingNext) {
            onLoadMore();
        }
    }, [fetchingNext, hasNextPage, onLoadMore]);

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScreenHeader title="Matches" onBack={onBack} />

            {loading && safeMatches.length === 0 ? (
                <View style={styles.center}>
                    <ActivityIndicator color={Colors.primary} size="large" />
                </View>
            ) : safeMatches.length === 0 ? (
                <DiscoverEmptyState
                    title="No matches yet"
                    description="When you and someone like each other, your matches will appear here."
                />
            ) : (
                <FlatList
                    data={safeMatches}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => (
                        <DatingMatchRow
                            match={item}
                            unmatching={unmatchingIds.has(item.id)}
                            onOpenChat={() => onOpenChat(item)}
                            onOpenProfile={() => onOpenProfile(item.profile)}
                            onUnmatch={() => onUnmatch(item)}
                        />
                    )}
                    onEndReached={handleEndReached}
                    onEndReachedThreshold={0.35}
                    ListFooterComponent={fetchingNext ? (
                        <ActivityIndicator color={Colors.primary} style={styles.footerLoader} />
                    ) : null}
                />
            )}
        </SafeAreaView>
    );
}

function DatingMatchRow({
    match,
    unmatching,
    onOpenChat,
    onOpenProfile,
    onUnmatch,
}: {
    match: api.DatingMatch;
    unmatching: boolean;
    onOpenChat: () => void;
    onOpenProfile: () => void;
    onUnmatch: () => void;
}): React.ReactElement {
    const profile = match.profile;
    const nameLabel = profile.age ? `${formatUsername(profile.username)}, ${profile.age}` : formatUsername(profile.username);
    const matchedLabel = formatMatchedAt(match.matched_at);

    return (
        <View style={styles.row}>
            <TouchableOpacity
                style={styles.rowMain}
                onPress={onOpenProfile}
                activeOpacity={0.86}
                accessibilityRole="button"
                accessibilityLabel={`View ${formatUsername(profile.username)} profile`}
            >
                <Avatar
                    username={profile.username}
                    avatarUrl={(profile.photos ?? [])[0]?.image_url}
                    size={58}
                    fontSize={20}
                />
                <View style={styles.rowText}>
                    <Text style={styles.rowName} numberOfLines={1}>{nameLabel}</Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>{matchedLabel}</Text>
                </View>
            </TouchableOpacity>
            <View style={styles.rowActions}>
                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={onOpenChat}
                    activeOpacity={0.84}
                    accessibilityRole="button"
                    accessibilityLabel={`Open chat with ${formatUsername(profile.username)}`}
                >
                    <Ionicons name="chatbubble-outline" size={19} color={Colors.text.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.iconButton, styles.unmatchButton]}
                    onPress={onUnmatch}
                    disabled={unmatching}
                    activeOpacity={0.84}
                    accessibilityRole="button"
                    accessibilityLabel={`Unmatch ${formatUsername(profile.username)}`}
                >
                    {unmatching ? (
                        <ActivityIndicator color={Colors.danger} size="small" />
                    ) : (
                        <Ionicons name="close" size={20} color={Colors.danger} />
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

function formatMatchedAt(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'Matched recently';
    }
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.max(1, Math.floor(diffMs / 60000));
    if (minutes < 60) return `Matched ${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Matched ${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Matched ${days}d ago`;
    return 'Matched earlier';
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        paddingTop: 0,
        paddingBottom: ContentInsets.listBottom,
    },
    row: {
        minHeight: 78,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingHorizontal: ContentInsets.screenHorizontal,
        paddingVertical: Spacing.sm,
        backgroundColor: Colors.bg.page,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.emphasis,
    },
    rowMain: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    rowText: {
        flex: 1,
        minWidth: 0,
        gap: 3,
    },
    rowName: {
        fontSize: Typography.sizes.md,
        fontWeight: '800',
        color: Colors.text.primary,
    },
    rowMeta: {
        ...TextStyles.secondary,
        color: Colors.text.secondary,
    },
    rowActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    iconButton: {
        width: 38,
        height: 38,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.border.emphasis,
        backgroundColor: Colors.bg.page,
    },
    unmatchButton: {
        borderColor: Colors.dangerSubtle,
        backgroundColor: Colors.dangerSubtle,
    },
    footerLoader: {
        paddingVertical: Spacing.md,
    },
});
