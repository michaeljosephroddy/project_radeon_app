import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../api/client';
import { EmptyState } from '../../components/ui/EmptyState';
import { SearchBar } from '../../components/ui/SearchBar';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { TextField } from '../../components/ui/TextField';
import { useCreateGroupMutation, useGroups, useJoinGroupMutation } from '../../hooks/queries/useGroups';
import { Colors, Radius, Spacing, Typography, getAvatarColors } from '../../theme';

interface GroupsScreenProps {
    isActive: boolean;
    onOpenGroup: (groupId: string) => void;
}

type GroupScope = 'discover' | 'joined';

interface GroupFilterChip {
    label: string;
    tag?: string;
    recoveryPathway?: string;
}

const FILTER_CHIPS: GroupFilterChip[] = [
    { label: 'Alcohol-free', tag: 'alcohol-free' },
    { label: 'Early recovery', recoveryPathway: 'early-recovery' },
    { label: 'SMART', recoveryPathway: 'smart' },
    { label: 'AA', recoveryPathway: 'aa' },
    { label: 'LGBTQ+', tag: 'lgbtq' },
    { label: 'Women', tag: 'women' },
    { label: 'Local', tag: 'local' },
];

function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);

    return debounced;
}

export function GroupsScreen({ isActive, onOpenGroup }: GroupsScreenProps): React.ReactElement {
    const [query, setQuery] = useState('');
    const [scope, setScope] = useState<GroupScope>('discover');
    const [activeChip, setActiveChip] = useState<GroupFilterChip | null>(null);
    const [creating, setCreating] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDescription, setNewGroupDescription] = useState('');
    const [newGroupVisibility, setNewGroupVisibility] = useState<api.GroupVisibility>('public');
    const debouncedQuery = useDebounce(query.trim(), 250);
    const joinMutation = useJoinGroupMutation();
    const createGroupMutation = useCreateGroupMutation();

    const groupsQuery = useGroups({
        q: debouncedQuery || undefined,
        member_scope: scope,
        tag: activeChip?.tag,
        recovery_pathway: activeChip?.recoveryPathway,
        limit: 20,
    }, isActive);

    const groups = useMemo(
        () => (groupsQuery.data?.pages ?? []).flatMap(page => page.items ?? []),
        [groupsQuery.data?.pages],
    );

    const handleJoin = async (group: api.Group): Promise<void> => {
        try {
            const result = await joinMutation.mutateAsync({ groupId: group.id });
            if (result.state === 'pending') {
                Alert.alert('Request sent', 'An admin will review your request.');
            }
        } catch (e: unknown) {
            Alert.alert(
                'Could not join group',
                e instanceof Error ? e.message : 'Something went wrong.',
            );
        }
    };

    const handleCreateGroup = async (): Promise<void> => {
        const name = newGroupName.trim();
        if (name.length < 3) return;
        try {
            const group = await createGroupMutation.mutateAsync({
                name,
                description: newGroupDescription.trim() || null,
                visibility: newGroupVisibility,
                tags: activeChip?.tag ? [activeChip.tag] : [],
                recovery_pathways: activeChip?.recoveryPathway ? [activeChip.recoveryPathway] : [],
            });
            setCreating(false);
            setNewGroupName('');
            setNewGroupDescription('');
            setNewGroupVisibility('public');
            onOpenGroup(group.id);
        } catch (e: unknown) {
            Alert.alert(
                'Could not create group',
                e instanceof Error ? e.message : 'Something went wrong.',
            );
        }
    };

    const renderItem = ({ item }: { item: api.Group }): React.ReactElement => (
        <GroupCard
            group={item}
            isJoining={joinMutation.isPending}
            onJoin={() => handleJoin(item)}
            onOpen={() => onOpenGroup(item.id)}
        />
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={groups}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={(
                    <View style={styles.headerContent}>
                        <SearchBar
                            primaryField={{
                                value: query,
                                onChangeText: setQuery,
                                placeholder: 'Search groups',
                                returnKeyType: 'search',
                            }}
                            leading={<Ionicons name="search-outline" size={18} color={Colors.text.muted} />}
                            actionLabel="+"
                            onActionPress={() => setCreating(current => !current)}
                        />
                        {creating ? (
                            <View style={styles.createPanel}>
                                <Text style={styles.createTitle}>Create group</Text>
                                <TextField
                                    value={newGroupName}
                                    onChangeText={setNewGroupName}
                                    placeholder="Group name"
                                />
                                <TextField
                                    value={newGroupDescription}
                                    onChangeText={setNewGroupDescription}
                                    placeholder="Description"
                                    multiline
                                    style={styles.createDescription}
                                />
                                <SegmentedControl
                                    items={[
                                        { key: 'public', label: 'Public' },
                                        { key: 'approval_required', label: 'Approval' },
                                        { key: 'invite_only', label: 'Invite' },
                                    ]}
                                    activeKey={newGroupVisibility}
                                    onChange={(next) => setNewGroupVisibility(next as api.GroupVisibility)}
                                    style={styles.createVisibility}
                                />
                                <View style={styles.createActions}>
                                    <TouchableOpacity
                                        style={styles.cancelButton}
                                        onPress={() => setCreating(false)}
                                    >
                                        <Text style={styles.cancelButtonText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.createButton,
                                            (newGroupName.trim().length < 3 || createGroupMutation.isPending) && styles.createButtonDisabled,
                                        ]}
                                        onPress={handleCreateGroup}
                                        disabled={newGroupName.trim().length < 3 || createGroupMutation.isPending}
                                    >
                                        {createGroupMutation.isPending ? (
                                            <ActivityIndicator size="small" color={Colors.textOn.primary} />
                                        ) : (
                                            <Text style={styles.createButtonText}>Create</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : null}
                        <SegmentedControl
                            items={[
                                { key: 'discover', label: 'Discover' },
                                { key: 'joined', label: 'Joined' },
                            ]}
                            activeKey={scope}
                            onChange={(next) => setScope(next as GroupScope)}
                        />
                        <FlatList
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            data={FILTER_CHIPS}
                            keyExtractor={item => item.label}
                            contentContainerStyle={styles.chipRow}
                            renderItem={({ item }) => {
                                const isSelected = activeChip?.label === item.label;
                                return (
                                    <TouchableOpacity
                                        style={[styles.chip, isSelected && styles.chipSelected]}
                                        onPress={() => setActiveChip(isSelected ? null : item)}
                                    >
                                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                                            {item.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                )}
                ListEmptyComponent={!groupsQuery.isLoading ? (
                    <EmptyState
                        title={scope === 'joined' ? 'No groups joined yet' : 'No groups found'}
                        description={scope === 'joined'
                            ? 'Discover recovery groups and request to join when one fits.'
                            : 'Try a broader search or remove filters.'}
                    />
                ) : null}
                ListFooterComponent={groupsQuery.isFetchingNextPage ? (
                    <View style={styles.footerLoading}>
                        <ActivityIndicator color={Colors.primary} />
                    </View>
                ) : null}
                refreshControl={(
                    <RefreshControl
                        refreshing={groupsQuery.isRefetching}
                        onRefresh={() => groupsQuery.refetch()}
                        tintColor={Colors.primary}
                    />
                )}
                onEndReachedThreshold={0.4}
                onEndReached={() => {
                    if (groupsQuery.hasNextPage && !groupsQuery.isFetchingNextPage) {
                        groupsQuery.fetchNextPage();
                    }
                }}
            />
            {groupsQuery.isLoading ? (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator color={Colors.primary} />
                </View>
            ) : null}
        </View>
    );
}

interface GroupCardProps {
    group: api.Group;
    isJoining: boolean;
    onJoin: () => void;
    onOpen: () => void;
}

function GroupCard({ group, isJoining, onJoin, onOpen }: GroupCardProps): React.ReactElement {
    const colors = getAvatarColors(group.name);
    const isMember = group.viewer_status === 'active';
    const canRequest = !isMember && !group.has_pending_request;

    return (
        <TouchableOpacity style={styles.card} activeOpacity={0.86} onPress={onOpen}>
            <View style={styles.cardMain}>
                <View style={[styles.groupMark, { backgroundColor: colors.bg }]}>
                    <Text style={[styles.groupMarkText, { color: colors.text }]}>
                        {group.name.slice(0, 2).toUpperCase()}
                    </Text>
                </View>
                <View style={styles.cardCopy}>
                    <View style={styles.cardTitleRow}>
                        <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
                        <VisibilityPill visibility={group.visibility} />
                    </View>
                    {group.description ? (
                        <Text style={styles.description} numberOfLines={2}>{group.description}</Text>
                    ) : null}
                    <View style={styles.metaRow}>
                        <Text style={styles.metaText}>{group.member_count} members</Text>
                        <Text style={styles.metaDot}>•</Text>
                        <Text style={styles.metaText}>{group.post_count} posts</Text>
                        {group.city ? (
                            <>
                                <Text style={styles.metaDot}>•</Text>
                                <Text style={styles.metaText} numberOfLines={1}>{group.city}</Text>
                            </>
                        ) : null}
                    </View>
                </View>
            </View>
            <View style={styles.cardActions}>
                {isMember ? (
                    <View style={styles.memberPill}>
                        <Ionicons name="checkmark-circle" size={15} color={Colors.success} />
                        <Text style={styles.memberPillText}>Joined</Text>
                    </View>
                ) : group.has_pending_request ? (
                    <View style={styles.pendingPill}>
                        <Text style={styles.pendingPillText}>Pending</Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={[styles.joinButton, !canRequest && styles.joinButtonDisabled]}
                        onPress={(event) => {
                            event.stopPropagation();
                            onJoin();
                        }}
                        disabled={!canRequest || isJoining}
                    >
                        <Text style={styles.joinButtonText}>
                            {group.visibility === 'approval_required' ? 'Request' : 'Join'}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </TouchableOpacity>
    );
}

function VisibilityPill({ visibility }: { visibility: api.GroupVisibility }): React.ReactElement {
    const label = visibility === 'approval_required'
        ? 'Approval'
        : visibility === 'invite_only'
            ? 'Invite'
            : visibility === 'private_hidden'
                ? 'Private'
                : 'Public';

    return (
        <View style={styles.visibilityPill}>
            <Text style={styles.visibilityPillText}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    listContent: {
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.xl,
        gap: Spacing.md,
    },
    headerContent: {
        paddingTop: Spacing.sm,
        gap: Spacing.md,
    },
    chipRow: {
        gap: Spacing.sm,
        paddingRight: Spacing.md,
    },
    createPanel: {
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.surface,
        padding: Spacing.md,
        gap: Spacing.sm,
    },
    createTitle: {
        fontSize: Typography.sizes.base,
        fontWeight: '800',
        color: Colors.text.primary,
    },
    createDescription: {
        minHeight: 74,
        textAlignVertical: 'top',
    },
    createVisibility: {
        marginBottom: 0,
    },
    createActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: Spacing.sm,
    },
    cancelButton: {
        minHeight: 38,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        backgroundColor: Colors.bg.page,
    },
    cancelButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.text.secondary,
    },
    createButton: {
        minHeight: 38,
        minWidth: 86,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        backgroundColor: Colors.primary,
    },
    createButtonDisabled: {
        opacity: 0.5,
    },
    createButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '800',
        color: Colors.textOn.primary,
    },
    chip: {
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        paddingVertical: 9,
    },
    chipSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primarySubtle,
    },
    chipText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
    chipTextSelected: {
        color: Colors.primary,
    },
    card: {
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.surface,
        padding: Spacing.md,
        gap: Spacing.md,
    },
    cardMain: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    groupMark: {
        width: 48,
        height: 48,
        borderRadius: Radius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    groupMarkText: {
        fontSize: Typography.sizes.base,
        fontWeight: '800',
    },
    cardCopy: {
        flex: 1,
        gap: Spacing.xs,
    },
    cardTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    groupName: {
        flex: 1,
        fontSize: Typography.sizes.md,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    description: {
        fontSize: Typography.sizes.sm,
        lineHeight: 19,
        color: Colors.text.secondary,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    metaText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '600',
        color: Colors.text.muted,
    },
    metaDot: {
        fontSize: Typography.sizes.xs,
        color: Colors.text.muted,
    },
    cardActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    joinButton: {
        minHeight: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.lg,
        backgroundColor: Colors.primary,
    },
    joinButtonDisabled: {
        opacity: 0.5,
    },
    joinButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.textOn.primary,
    },
    memberPill: {
        minHeight: 34,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        backgroundColor: Colors.successSubtle,
    },
    memberPillText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    pendingPill: {
        minHeight: 34,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        backgroundColor: Colors.warningSubtle,
    },
    pendingPillText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.warning,
    },
    visibilityPill: {
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        backgroundColor: Colors.bg.page,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    visibilityPillText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.text.secondary,
    },
    footerLoading: {
        paddingVertical: Spacing.lg,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg.page,
    },
});
