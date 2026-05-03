import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { CreatePostFab } from '../../components/posts/CreatePostFab';
import { EmptyState } from '../../components/ui/EmptyState';
import { SearchBar } from '../../components/ui/SearchBar';
import { ScrollToTopButton } from '../../components/ui/ScrollToTopButton';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { TextField } from '../../components/ui/TextField';
import { useGroups, useJoinGroupMutation } from '../../hooks/queries/useGroups';
import { useScrollToTopButton } from '../../hooks/useScrollToTopButton';
import { screenStandards } from '../../styles/screenStandards';
import { Colors, ContentInsets, ControlSizes, Radius, Spacing, TextStyles, getAvatarColors } from '../../theme';

interface GroupsScreenProps {
    isActive: boolean;
    onOpenGroup: (groupId: string) => void;
    onOpenCreateGroup: () => void;
}

type GroupScope = 'discover' | 'joined';
type GroupTypeFilter = 'all' | 'standard' | 'support';

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

const COMMUNITY_SUPPORT_KEY = 'community_support';

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

export function GroupsScreen({ isActive, onOpenGroup, onOpenCreateGroup }: GroupsScreenProps): React.ReactElement {
    const listRef = useRef<FlatList<api.Group> | null>(null);
    const scrollToTop = useScrollToTopButton({ threshold: 520 });
    const [query, setQuery] = useState('');
    const [scope, setScope] = useState<GroupScope>('discover');
    const [activeChip, setActiveChip] = useState<GroupFilterChip | null>(null);
    const [draftChip, setDraftChip] = useState<GroupFilterChip | null>(null);
    const [country, setCountry] = useState('');
    const [draftCountry, setDraftCountry] = useState('');
    const [city, setCity] = useState('');
    const [draftCity, setDraftCity] = useState('');
    const [visibility, setVisibility] = useState<api.GroupVisibility | null>(null);
    const [draftVisibility, setDraftVisibility] = useState<api.GroupVisibility | null>(null);
    const [groupType, setGroupType] = useState<GroupTypeFilter>('all');
    const [draftGroupType, setDraftGroupType] = useState<GroupTypeFilter>('all');
    const [filterOpen, setFilterOpen] = useState(false);
    const joinMutation = useJoinGroupMutation();
    const activeFilterCount = (activeChip ? 1 : 0) + (country ? 1 : 0) + (city ? 1 : 0) + (visibility ? 1 : 0) + (groupType !== 'all' ? 1 : 0);

    const openFilters = useCallback((): void => {
        setDraftChip(activeChip);
        setDraftCountry(country);
        setDraftCity(city);
        setDraftVisibility(visibility);
        setDraftGroupType(groupType);
        setFilterOpen(true);
    }, [activeChip, city, country, groupType, visibility]);

    const handleSearchChange = useCallback((nextQuery: string): void => {
        setQuery(nextQuery);
    }, []);

    const applyFilters = (): void => {
        setActiveChip(draftChip);
        setCountry(draftCountry.trim());
        setCity(draftCity.trim());
        setVisibility(draftVisibility);
        setGroupType(draftGroupType);
        setFilterOpen(false);
    };

    const resetFilters = (): void => {
        setDraftChip(null);
        setActiveChip(null);
        setDraftCountry('');
        setCountry('');
        setDraftCity('');
        setCity('');
        setDraftVisibility(null);
        setVisibility(null);
        setDraftGroupType('all');
        setGroupType('all');
        setFilterOpen(false);
    };

    const groupsQuery = useGroups({
        q: query || undefined,
        member_scope: scope,
        tag: activeChip?.tag,
        recovery_pathway: activeChip?.recoveryPathway,
        city: city || undefined,
        country: country || undefined,
        visibility: visibility ?? undefined,
        group_type: groupType === 'all' ? undefined : groupType,
        limit: 20,
    }, isActive);

    const groups = useMemo(
        () => (groupsQuery.data?.pages ?? [])
            .flatMap(page => page.items ?? [])
            .sort((a, b) => {
                const aSupport = a.system_key === COMMUNITY_SUPPORT_KEY;
                const bSupport = b.system_key === COMMUNITY_SUPPORT_KEY;
                if (aSupport === bSupport) return 0;
                return aSupport ? -1 : 1;
            }),
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
            <View style={screenStandards.fixedTabsWrap}>
                <SegmentedControl
                    items={[
                        { key: 'discover', label: 'Discover' },
                        { key: 'joined', label: 'Joined' },
                    ]}
                    activeKey={scope}
                    onChange={(next) => setScope(next as GroupScope)}
                    tone="primary"
                    style={screenStandards.fixedTabsControl}
                />
            </View>
            <FlatList
                ref={listRef}
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
                onScroll={scrollToTop.onScroll}
                scrollEventThrottle={16}
            />
            {isActive && scrollToTop.isVisible ? (
                <ScrollToTopButton onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} />
            ) : null}
            <CreatePostFab
                visible={isActive && scope === 'discover'}
                bottom={20}
                label="Group"
                onPress={onOpenCreateGroup}
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
                            <Text style={styles.filterSectionLabel}>Group type</Text>
                            <View style={styles.filterOptions}>
                                <FilterChip
                                    label="All groups"
                                    selected={draftGroupType === 'all'}
                                    onPress={() => setDraftGroupType('all')}
                                />
                                <FilterChip
                                    label="Standard"
                                    selected={draftGroupType === 'standard'}
                                    onPress={() => setDraftGroupType(draftGroupType === 'standard' ? 'all' : 'standard')}
                                />
                                <FilterChip
                                    label="Support"
                                    selected={draftGroupType === 'support'}
                                    onPress={() => setDraftGroupType(draftGroupType === 'support' ? 'all' : 'support')}
                                />
                            </View>
                        </View>
                        <View style={styles.filterSection}>
                            <Text style={styles.filterSectionLabel}>Access</Text>
                            <View style={styles.filterOptions}>
                                <FilterChip
                                    label="Any access"
                                    selected={!draftVisibility}
                                    onPress={() => setDraftVisibility(null)}
                                />
                                {([
                                    { key: 'public', label: 'Public' },
                                    { key: 'approval_required', label: 'Approval' },
                                    { key: 'invite_only', label: 'Invite' },
                                ] as Array<{ key: api.GroupVisibility; label: string }>).map((item) => (
                                    <FilterChip
                                        key={item.key}
                                        label={item.label}
                                        selected={draftVisibility === item.key}
                                        onPress={() => setDraftVisibility(draftVisibility === item.key ? null : item.key)}
                                    />
                                ))}
                            </View>
                        </View>
                        <View style={styles.filterSection}>
                            <Text style={styles.filterSectionLabel}>Location</Text>
                            <TextField
                                value={draftCountry}
                                onChangeText={setDraftCountry}
                                placeholder="Country"
                                returnKeyType="search"
                            />
                            <TextField
                                value={draftCity}
                                onChangeText={setDraftCity}
                                placeholder="City"
                                returnKeyType="search"
                            />
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
    const isCommunitySupport = group.system_key === COMMUNITY_SUPPORT_KEY;
    const isMember = isCommunitySupport || group.viewer_status === 'active';
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
                                {isCommunitySupport ? (
                                    <>
                                        <PinnedGroupPill />
                                        <SystemGroupPill />
                                    </>
                                ) : (
                                    <VisibilityPill visibility={group.visibility} />
                                )}
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
                    {isCommunitySupport ? (
                        <Text style={styles.systemGroupMeta}>Everyone is a member</Text>
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

function SystemGroupPill(): React.ReactElement {
    return (
        <View style={styles.systemPill}>
            <Ionicons name="heart-outline" size={12} color={Colors.info} />
            <Text style={styles.systemPillText}>Support</Text>
        </View>
    );
}

function PinnedGroupPill(): React.ReactElement {
    return (
        <View style={styles.pinnedPill}>
            <Ionicons name="pin" size={12} color={Colors.primary} />
            <Text style={styles.pinnedPillText}>Pinned</Text>
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
        paddingTop: 0,
        paddingBottom: Spacing.xs,
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
        width: ControlSizes.inputMinHeight,
        height: ControlSizes.inputMinHeight,
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
        ...TextStyles.badge,
        fontWeight: '800',
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
        minHeight: ControlSizes.iconButton,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterTitle: {
        ...TextStyles.sectionTitle,
        fontWeight: '800',
    },
    resetText: {
        ...TextStyles.chip,
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
        ...TextStyles.label,
        fontWeight: '800',
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
        minHeight: ControlSizes.iconButton,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    filterChipSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary,
    },
    filterChipText: {
        ...TextStyles.chip,
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
        minHeight: ControlSizes.buttonMinHeight,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.pill,
        backgroundColor: Colors.primary,
    },
    applyButtonText: {
        ...TextStyles.button,
        fontSize: TextStyles.chip.fontSize,
        fontWeight: '800',
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
        ...TextStyles.bodyEmphasis,
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
        gap: Spacing.xs,
    },
    groupName: {
        ...TextStyles.cardTitle,
    },
    description: {
        ...TextStyles.postBody,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: Spacing.xs,
    },
    metaText: {
        ...TextStyles.meta,
    },
    locationMeta: {
        flexShrink: 1,
        minWidth: 0,
        maxWidth: '100%',
    },
    metaDot: {
        ...TextStyles.meta,
    },
    joinButton: {
        minHeight: ControlSizes.chipMinHeight,
        minWidth: 78,
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
        ...TextStyles.button,
        fontSize: TextStyles.chip.fontSize,
    },
    memberPill: {
        minHeight: ControlSizes.chipMinHeight,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        backgroundColor: Colors.successSubtle,
    },
    memberPillText: {
        ...TextStyles.chip,
        color: Colors.text.primary,
        fontWeight: '700',
    },
    pendingPill: {
        minHeight: ControlSizes.chipMinHeight,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        backgroundColor: Colors.warningSubtle,
    },
    pendingPillText: {
        ...TextStyles.chip,
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
        ...TextStyles.caption,
        fontWeight: '700',
        color: Colors.primary,
    },
    systemPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.info,
        backgroundColor: Colors.infoSubtle,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
    },
    systemPillText: {
        ...TextStyles.caption,
        fontWeight: '700',
        color: Colors.info,
    },
    systemGroupMeta: {
        ...TextStyles.caption,
        color: Colors.info,
        fontWeight: '700',
    },
    pinnedPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: Radius.pill,
        backgroundColor: Colors.primarySubtle,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
    },
    pinnedPillText: {
        ...TextStyles.caption,
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
