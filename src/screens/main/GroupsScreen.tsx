import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as api from '../../api/client';
import { EmptyState } from '../../components/ui/EmptyState';
import { SearchBar } from '../../components/ui/SearchBar';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { TextField } from '../../components/ui/TextField';
import { useCreateGroupMutation, useGroups, useJoinGroupMutation } from '../../hooks/queries/useGroups';
import { Colors, ContentInsets, Radius, Spacing, Typography, getAvatarColors } from '../../theme';

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

const COUNTRY_FILTERS = ['United States', 'United Kingdom', 'Ireland', 'Canada', 'Australia'];

interface FilterChipProps {
    label: string;
    selected: boolean;
    onPress: () => void;
}

function FilterChip({ label, selected, onPress }: FilterChipProps): React.ReactElement {
    return (
        <TouchableOpacity
            style={[styles.filterChip, selected && styles.filterChipSelected]}
            onPress={onPress}
            activeOpacity={0.85}
        >
            <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{label}</Text>
        </TouchableOpacity>
    );
}

interface GroupSearchRowProps {
    activeFilterCount: number;
    onOpenFilters: () => void;
    onQueryChange: (query: string) => void;
    onToggleCreating: () => void;
}

function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);

    return debounced;
}

const GroupSearchRow = React.memo(function GroupSearchRow({
    activeFilterCount,
    onOpenFilters,
    onQueryChange,
    onToggleCreating,
}: GroupSearchRowProps): React.ReactElement {
    const [draftQuery, setDraftQuery] = useState('');
    const debouncedQuery = useDebounce(draftQuery.trim(), 250);

    useEffect(() => {
        onQueryChange(debouncedQuery);
    }, [debouncedQuery, onQueryChange]);

    return (
        <View style={styles.searchRow}>
            <SearchBar
                style={styles.searchBar}
                primaryField={{
                    value: draftQuery,
                    onChangeText: setDraftQuery,
                    placeholder: 'Search groups',
                    returnKeyType: 'search',
                }}
                leading={<Ionicons name="search-outline" size={18} color={Colors.text.muted} />}
                actionLabel="+"
                onActionPress={onToggleCreating}
            />
            <TouchableOpacity style={styles.filterButton} onPress={onOpenFilters} activeOpacity={0.86}>
                <Ionicons name="options-outline" size={20} color={Colors.text.primary} />
                {activeFilterCount ? (
                    <View style={styles.filterBadge}>
                        <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                    </View>
                ) : null}
            </TouchableOpacity>
        </View>
    );
});

export function GroupsScreen({ isActive, onOpenGroup }: GroupsScreenProps): React.ReactElement {
    const [query, setQuery] = useState('');
    const [scope, setScope] = useState<GroupScope>('discover');
    const [activeChip, setActiveChip] = useState<GroupFilterChip | null>(null);
    const [draftChip, setDraftChip] = useState<GroupFilterChip | null>(null);
    const [country, setCountry] = useState('');
    const [draftCountry, setDraftCountry] = useState('');
    const [filterOpen, setFilterOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDescription, setNewGroupDescription] = useState('');
    const [newGroupVisibility, setNewGroupVisibility] = useState<api.GroupVisibility>('public');
    const joinMutation = useJoinGroupMutation();
    const createGroupMutation = useCreateGroupMutation();
    const activeFilterCount = (activeChip ? 1 : 0) + (country ? 1 : 0);

    const openFilters = useCallback((): void => {
        setDraftChip(activeChip);
        setDraftCountry(country);
        setFilterOpen(true);
    }, [activeChip, country]);

    const handleSearchChange = useCallback((nextQuery: string): void => {
        setQuery(nextQuery);
    }, []);

    const handleToggleCreating = useCallback((): void => {
        setCreating(current => !current);
    }, []);

    const applyFilters = (): void => {
        setActiveChip(draftChip);
        setCountry(draftCountry);
        setFilterOpen(false);
    };

    const resetFilters = (): void => {
        setDraftChip(null);
        setActiveChip(null);
        setDraftCountry('');
        setCountry('');
        setFilterOpen(false);
    };

    const groupsQuery = useGroups({
        q: query || undefined,
        member_scope: scope,
        tag: activeChip?.tag,
        recovery_pathway: activeChip?.recoveryPathway,
        country: country || undefined,
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
                        <GroupSearchRow
                            activeFilterCount={activeFilterCount}
                            onOpenFilters={openFilters}
                            onQueryChange={handleSearchChange}
                            onToggleCreating={handleToggleCreating}
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
            <Modal
                visible={filterOpen}
                animationType="slide"
                transparent={false}
                presentationStyle="pageSheet"
                onRequestClose={() => setFilterOpen(false)}
            >
                <SafeAreaView style={styles.filterScreen} edges={['top', 'bottom']}>
                    <View style={styles.filterHeader}>
                        <TouchableOpacity style={styles.filterHeaderButton} onPress={() => setFilterOpen(false)}>
                            <Ionicons name="close" size={22} color={Colors.text.primary} />
                        </TouchableOpacity>
                        <Text style={styles.filterTitle}>Group filters</Text>
                        <TouchableOpacity style={styles.filterHeaderButton} onPress={resetFilters}>
                            <Text style={styles.resetText}>Reset</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView
                        style={styles.filterScroll}
                        contentContainerStyle={styles.filterContent}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.filterSection}>
                            <Text style={styles.filterSectionLabel}>Focus</Text>
                            <View style={styles.filterOptions}>
                                {FILTER_CHIPS.map((item) => {
                                    const isSelected = draftChip?.label === item.label;
                                    return (
                                        <FilterChip
                                            key={item.label}
                                            label={item.label}
                                            selected={isSelected}
                                            onPress={() => setDraftChip(isSelected ? null : item)}
                                        />
                                    );
                                })}
                            </View>
                        </View>
                        <View style={styles.filterSection}>
                            <Text style={styles.filterSectionLabel}>Country</Text>
                            <View style={styles.filterOptions}>
                                <FilterChip
                                    label="All countries"
                                    selected={!draftCountry}
                                    onPress={() => setDraftCountry('')}
                                />
                                {COUNTRY_FILTERS.map((item) => (
                                    <FilterChip
                                        key={item}
                                        label={item}
                                        selected={draftCountry === item}
                                        onPress={() => setDraftCountry(draftCountry === item ? '' : item)}
                                    />
                                ))}
                            </View>
                        </View>
                    </ScrollView>
                    <View style={styles.filterFooter}>
                        <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
                            <Text style={styles.applyButtonText}>Apply filters</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </Modal>
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
    const location = [group.city, group.country].filter(Boolean).join(', ');

    return (
        <TouchableOpacity style={styles.card} activeOpacity={0.86} onPress={onOpen}>
            <View style={styles.cardMain}>
                <View style={[styles.groupMark, { backgroundColor: colors.bg }]}>
                    <Text style={[styles.groupMarkText, { color: colors.text }]}>
                        {group.name.slice(0, 2).toUpperCase()}
                    </Text>
                </View>
                <View style={styles.cardCopy}>
                    <View style={styles.cardHeaderRow}>
                        <View style={styles.cardTitleBlock}>
                            <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
                            <View style={styles.badgeRow}>
                                <VisibilityPill visibility={group.visibility} />
                            </View>
                        </View>
                        <GroupStatusAction
                            group={group}
                            isMember={isMember}
                            canRequest={canRequest}
                            isJoining={isJoining}
                            onJoin={onJoin}
                        />
                    </View>
                    {group.description ? (
                        <Text style={styles.description} numberOfLines={2}>{group.description}</Text>
                    ) : null}
                    <View style={styles.metaRow}>
                        <Text style={styles.metaText}>{group.member_count} members</Text>
                        <Text style={styles.metaDot}>•</Text>
                        <Text style={styles.metaText}>{group.post_count} posts</Text>
                        {location ? (
                            <>
                                <Text style={styles.metaDot}>•</Text>
                                <Text style={[styles.metaText, styles.locationMeta]} numberOfLines={1}>
                                    {location}
                                </Text>
                            </>
                        ) : null}
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
}

interface GroupStatusActionProps {
    group: api.Group;
    isMember: boolean;
    canRequest: boolean;
    isJoining: boolean;
    onJoin: () => void;
}

function GroupStatusAction({
    group,
    isMember,
    canRequest,
    isJoining,
    onJoin,
}: GroupStatusActionProps): React.ReactElement {
    if (isMember) {
        return (
            <View style={styles.memberPill}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                <Text style={styles.memberPillText}>Joined</Text>
            </View>
        );
    }

    if (group.has_pending_request) {
        return (
            <View style={styles.pendingPill}>
                <Text style={styles.pendingPillText}>Pending</Text>
            </View>
        );
    }

    return (
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
        paddingBottom: ContentInsets.listBottom,
    },
    headerContent: {
        paddingHorizontal: ContentInsets.screenHorizontal,
        paddingTop: ContentInsets.screenHorizontal,
        paddingBottom: Spacing.md,
        gap: Spacing.md,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    searchBar: {
        flex: 1,
    },
    filterButton: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.raised,
    },
    filterBadge: {
        position: 'absolute',
        top: 7,
        right: 7,
        minWidth: 17,
        height: 17,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.pill,
        backgroundColor: Colors.primary,
        paddingHorizontal: 4,
    },
    filterBadgeText: {
        fontSize: 10,
        lineHeight: 12,
        fontWeight: '800',
        color: Colors.textOn.primary,
    },
    createPanel: {
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.raised,
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
        borderWidth: 1,
        borderColor: Colors.border.default,
        paddingHorizontal: Spacing.md,
        backgroundColor: Colors.bg.surface,
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
    filterScreen: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    filterHeader: {
        minHeight: 58,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.subtle,
        paddingHorizontal: Spacing.md,
    },
    filterHeaderButton: {
        minWidth: 54,
        minHeight: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: '800',
        color: Colors.text.primary,
    },
    resetText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '800',
        color: Colors.primary,
    },
    filterScroll: {
        flex: 1,
    },
    filterContent: {
        padding: Spacing.md,
        paddingBottom: Spacing.xl,
        gap: Spacing.lg,
    },
    filterSection: {
        gap: Spacing.sm,
    },
    filterSectionLabel: {
        fontSize: Typography.sizes.sm,
        fontWeight: '800',
        color: Colors.text.primary,
    },
    filterOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    filterChip: {
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.raised,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
    },
    filterChipSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary,
    },
    filterChipText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
    filterChipTextSelected: {
        color: Colors.textOn.primary,
    },
    filterFooter: {
        borderTopWidth: 1,
        borderTopColor: Colors.border.subtle,
        padding: Spacing.md,
    },
    applyButton: {
        minHeight: 46,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.pill,
        backgroundColor: Colors.primary,
    },
    applyButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '800',
        color: Colors.textOn.primary,
    },
    card: {
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.default,
        backgroundColor: Colors.bg.page,
        padding: Spacing.md,
    },
    cardMain: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    groupMark: {
        width: 44,
        height: 44,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    groupMarkText: {
        fontSize: Typography.sizes.base,
        fontWeight: '800',
    },
    cardCopy: {
        flex: 1,
        minWidth: 0,
        gap: Spacing.xs,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
    },
    cardTitleBlock: {
        flex: 1,
        minWidth: 0,
        gap: 5,
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    groupName: {
        fontSize: Typography.sizes.md,
        fontWeight: '500',
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
        flexWrap: 'wrap',
        gap: Spacing.xs,
    },
    metaText: {
        fontSize: Typography.sizes.xs,
        color: Colors.text.muted,
    },
    locationMeta: {
        flexShrink: 1,
        minWidth: 0,
        maxWidth: '100%',
    },
    metaDot: {
        fontSize: Typography.sizes.xs,
        color: Colors.text.muted,
    },
    joinButton: {
        minHeight: 32,
        minWidth: 70,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        backgroundColor: Colors.primary,
    },
    joinButtonDisabled: {
        opacity: 0.5,
    },
    joinButtonText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.textOn.primary,
    },
    memberPill: {
        minHeight: 32,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        backgroundColor: Colors.successSubtle,
    },
    memberPillText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    pendingPill: {
        minHeight: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        backgroundColor: Colors.warningSubtle,
    },
    pendingPillText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.warning,
    },
    visibilityPill: {
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        backgroundColor: Colors.primarySubtle,
    },
    visibilityPillText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.primary,
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
