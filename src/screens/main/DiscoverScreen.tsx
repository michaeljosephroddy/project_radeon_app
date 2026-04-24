import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { Avatar } from '../../components/Avatar';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { PlusFeatureSheet } from '../../components/ui/PlusFeatureSheet';
import { SearchBar } from '../../components/ui/SearchBar';
import { TextField } from '../../components/ui/TextField';
import * as api from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { useDiscover } from '../../hooks/queries/useDiscover';
import { useLazyActivation } from '../../hooks/useLazyActivation';
import { getRecoveryMilestone } from '../../utils/date';
import { formatUsername } from '../../utils/identity';
import { Colors, Typography, Spacing, Radii, getAvatarColors } from '../../utils/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CARD_GAP = Spacing.md;
const CARD_WIDTH = (SCREEN_WIDTH - Spacing.md * 2 - CARD_GAP) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.34;

const FILTER_UPGRADE_ITEMS: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; description: string }> = [
    { icon: 'person-outline', label: 'Advanced matching', description: 'Filter by gender and age preferences.' },
    { icon: 'location-outline', label: 'Distance control', description: 'Limit results by how close people are to you.' },
    { icon: 'trophy-outline', label: 'Recovery milestones', description: 'Browse by sobriety stage with SoberSpace Plus.' },
];

const GENDER_OPTIONS = ['Any', 'Women', 'Men', 'Non-binary'] as const;
const SOBRIETY_OPTIONS = ['Any', '30+ days', '90+ days', '1+ year', '5+ years'] as const;

type GenderOption = typeof GENDER_OPTIONS[number];
type SobrietyOption = typeof SOBRIETY_OPTIONS[number];

interface DiscoverFiltersState {
    gender: GenderOption;
    ageMin: string;
    ageMax: string;
    distanceKm: number;
    sobriety: SobrietyOption;
}

interface DiscoverScreenProps {
    isActive: boolean;
    onOpenUserProfile: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
}

function PlusButtonBadge() {
    return (
        <View style={styles.buttonPlusBadge}>
            <Text style={styles.buttonPlusBadgeText}>Plus</Text>
        </View>
    );
}

function FilterChip({
    label,
    selected,
    onPress,
}: {
    label: string;
    selected: boolean;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            style={[styles.filterChip, selected && styles.filterChipActive]}
            onPress={onPress}
            activeOpacity={0.85}
        >
            <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>{label}</Text>
        </TouchableOpacity>
    );
}

function hasPlusAccess(user: api.User | null): boolean {
    if (!user) return false;
    if (user.is_plus) return true;
    return user.subscription_tier === 'plus';
}

function getDistanceLabel(distanceKm: number): string {
    if (distanceKm === 0) return 'Anywhere';
    return `${distanceKm} km`;
}

function getFiltersSummary(filters: DiscoverFiltersState): string {
    const parts = [
        filters.gender !== 'Any' ? filters.gender : null,
        filters.ageMin || filters.ageMax ? `Age ${filters.ageMin || '18'}-${filters.ageMax || '99'}` : null,
        getDistanceLabel(filters.distanceKm),
        filters.sobriety !== 'Any' ? filters.sobriety : null,
    ].filter(Boolean);

    return parts.join(' · ') || 'Gender · Age · Distance · Sobriety';
}

interface DiscoverCardProps {
    user: api.User;
    isFriended: boolean;
    onPress: () => void;
    onFriend: () => void;
}

function DiscoverCard({ user, isFriended, onPress, onFriend }: DiscoverCardProps) {
    const avatarColors = getAvatarColors(user.username);
    const milestone = getRecoveryMilestone(user.sober_since);

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92}>
            {user.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: avatarColors.bg }]} />
            )}

            {!user.avatar_url && (
                <View style={styles.cardInitials}>
                    <Text style={styles.cardInitialsText}>
                        {user.username.slice(0, 2).toUpperCase()}
                    </Text>
                </View>
            )}

            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.72)']}
                style={styles.cardScrim}
            />

            {user.friendship_status !== 'self' ? (
                <TouchableOpacity
                    style={[styles.cardAddBtn, isFriended && styles.cardAddBtnDone]}
                    onPress={(e) => { e.stopPropagation(); if (!isFriended) onFriend(); }}
                    disabled={isFriended}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                    <Ionicons
                        name={isFriended ? 'checkmark' : 'person-add-outline'}
                        size={14}
                        color="#fff"
                    />
                </TouchableOpacity>
            ) : null}

            <View style={styles.cardFooter}>
                {milestone ? (
                    <View style={styles.cardMilestonePill}>
                        <Ionicons name="trophy-outline" size={10} color={Colors.primary} />
                        <Text style={styles.cardMilestoneText}>{milestone.currentLabel}</Text>
                    </View>
                ) : null}
                <Text style={styles.cardName} numberOfLines={1}>
                    {formatUsername(user.username)}
                </Text>
            </View>
        </TouchableOpacity>
    );
}

interface SearchResultRowProps {
    user: api.User;
    isFriended: boolean;
    onOpenUserProfile: (p: { userId: string; username: string; avatarUrl?: string }) => void;
    onFriend: (id: string) => void;
}

function SearchResultRow({ user, isFriended, onOpenUserProfile, onFriend }: SearchResultRowProps) {
    const milestone = getRecoveryMilestone(user.sober_since);
    const locationLabel = user.city
        ? `${user.city}${user.country ? `, ${user.country}` : ''}`
        : user.country ?? null;

    return (
        <TouchableOpacity
            style={styles.resultRow}
            onPress={() => onOpenUserProfile({ userId: user.id, username: user.username, avatarUrl: user.avatar_url })}
            activeOpacity={0.7}
        >
            <Avatar username={user.username} avatarUrl={user.avatar_url} size={44} fontSize={16} />
            <View style={styles.resultInfo}>
                <Text style={styles.resultName}>{formatUsername(user.username)}</Text>
                {(locationLabel || milestone) ? (
                    <Text style={styles.resultMeta} numberOfLines={1}>
                        {[milestone?.currentLabel, locationLabel].filter(Boolean).join(' · ')}
                    </Text>
                ) : null}
            </View>
            {user.friendship_status !== 'self' ? (
                <TouchableOpacity
                    style={[styles.resultFriendBtn, isFriended && styles.resultFriendBtnDone]}
                    onPress={() => { if (!isFriended) onFriend(user.id); }}
                    disabled={isFriended}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons
                        name={isFriended ? 'checkmark' : 'person-add-outline'}
                        size={16}
                        color={isFriended ? Colors.textOn.primary : Colors.primary}
                    />
                </TouchableOpacity>
            ) : null}
        </TouchableOpacity>
    );
}

function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);
    return debounced;
}

export function DiscoverScreen({ isActive, onOpenUserProfile }: DiscoverScreenProps) {
    const hasActivated = useLazyActivation(isActive);
    const { user } = useAuth();
    const [searchText, setSearchText] = useState('');
    const debouncedQuery = useDebounce(searchText.trim(), 400);
    const isSearching = debouncedQuery.length > 0;
    const [filtersExpanded, setFiltersExpanded] = useState(false);
    const [draftFilters, setDraftFilters] = useState<DiscoverFiltersState>({
        gender: 'Any',
        ageMin: '',
        ageMax: '',
        distanceKm: 50,
        sobriety: 'Any',
    });
    const [appliedFilters, setAppliedFilters] = useState<DiscoverFiltersState>({
        gender: 'Any',
        ageMin: '',
        ageMax: '',
        distanceKm: 50,
        sobriety: 'Any',
    });

    const discoverQuery = useDiscover({
        limit: 20,
        query: isSearching ? debouncedQuery : undefined,
        gender: appliedFilters.gender !== 'Any' ? appliedFilters.gender : undefined,
        ageMin: appliedFilters.ageMin ? Number(appliedFilters.ageMin) : undefined,
        ageMax: appliedFilters.ageMax ? Number(appliedFilters.ageMax) : undefined,
        distanceKm: appliedFilters.distanceKm,
        sobriety: appliedFilters.sobriety !== 'Any' ? appliedFilters.sobriety : undefined,
    }, hasActivated);
    const [friendedIds, setFriendedIds] = useState<Set<string>>(new Set());
    const [upgradeVisible, setUpgradeVisible] = useState(false);

    const users = useMemo(
        () => (discoverQuery.data?.pages ?? [])
            .flatMap(p => p.items ?? [])
            .filter(u => u.friendship_status !== 'self'),
        [discoverQuery.data?.pages],
    );

    const handleFriend = useCallback((id: string) => {
        setFriendedIds(prev => new Set([...prev, id]));
        void api.sendFriendRequest(id);
    }, []);

    const isFriendedFor = useCallback((user: api.User) =>
        friendedIds.has(user.id) ||
        user.friendship_status === 'outgoing' ||
        user.friendship_status === 'friends',
    [friendedIds]);

    const handleEndReached = useCallback(() => {
        if (discoverQuery.hasNextPage && !discoverQuery.isFetchingNextPage) {
            void discoverQuery.fetchNextPage();
        }
    }, [discoverQuery]);

    const handleApplyFilters = useCallback(() => {
        if (hasPlusAccess(user)) {
            setAppliedFilters(draftFilters);
            setFiltersExpanded(false);
            return;
        }

        setUpgradeVisible(true);
    }, [draftFilters, user]);

    if (discoverQuery.isLoading && users.length === 0) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color={Colors.primary} size="large" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <PlusFeatureSheet
                visible={upgradeVisible}
                title="Advanced Filters"
                items={FILTER_UPGRADE_ITEMS}
                onClose={() => setUpgradeVisible(false)}
            />

            <View style={styles.controls}>
                <SearchBar
                    style={styles.searchBar}
                    variant="pill"
                    leading={<Ionicons name="search-outline" size={18} color={Colors.light.textTertiary} />}
                    primaryField={{
                        value: searchText,
                        onChangeText: setSearchText,
                        placeholder: 'Search by username...',
                        autoCapitalize: 'none',
                        autoCorrect: false,
                        returnKeyType: 'search',
                        clearButtonMode: 'while-editing',
                    }}
                />

                {!isSearching ? (
                    <TouchableOpacity style={styles.filterBar} onPress={() => setFiltersExpanded((current) => !current)} activeOpacity={0.85}>
                        <View style={styles.filterBarLeft}>
                            <View style={styles.filterBarIcon}>
                                <Ionicons name="options-outline" size={18} color={Colors.light.textSecondary} />
                            </View>
                            <View style={styles.filterBarCopy}>
                                <Text style={styles.filterBarLabel}>Filters</Text>
                                <Text style={styles.filterBarSub}>Gender · Age · Distance · Sobriety</Text>
                            </View>
                        </View>
                        <View style={styles.filterBarRight}>
                            <Ionicons
                                name={filtersExpanded ? 'chevron-up' : 'chevron-down'}
                                size={16}
                                color={Colors.light.textTertiary}
                            />
                        </View>
                    </TouchableOpacity>
                ) : null}

                {!isSearching && filtersExpanded ? (
                    <View style={styles.filtersPanel}>
                        <View style={styles.filtersSection}>
                            <Text style={styles.filtersSectionTitle}>Gender</Text>
                            <View style={styles.filterChipWrap}>
                                {GENDER_OPTIONS.map((option) => (
                                    <FilterChip
                                        key={option}
                                        label={option}
                                        selected={draftFilters.gender === option}
                                        onPress={() => setDraftFilters((current) => ({ ...current, gender: option }))}
                                    />
                                ))}
                            </View>
                        </View>

                        <View style={styles.filtersSection}>
                            <Text style={styles.filtersSectionTitle}>Age Range</Text>
                            <View style={styles.ageRow}>
                                <View style={styles.ageField}>
                                    <Text style={styles.ageLabel}>Min</Text>
                                    <TextField
                                        value={draftFilters.ageMin}
                                        onChangeText={(value) => setDraftFilters((current) => ({ ...current, ageMin: value.replace(/[^0-9]/g, '') }))}
                                        placeholder="18"
                                        keyboardType="number-pad"
                                    />
                                </View>
                                <View style={styles.ageField}>
                                    <Text style={styles.ageLabel}>Max</Text>
                                    <TextField
                                        value={draftFilters.ageMax}
                                        onChangeText={(value) => setDraftFilters((current) => ({ ...current, ageMax: value.replace(/[^0-9]/g, '') }))}
                                        placeholder="99"
                                        keyboardType="number-pad"
                                    />
                                </View>
                            </View>
                        </View>

                        <View style={styles.filtersSection}>
                            <View style={styles.distanceHeader}>
                                <Text style={styles.filtersSectionTitle}>Distance</Text>
                                <Text style={styles.distanceValue}>{getDistanceLabel(draftFilters.distanceKm)}</Text>
                            </View>
                            <Slider
                                style={styles.distanceSlider}
                                minimumValue={0}
                                maximumValue={200}
                                step={10}
                                minimumTrackTintColor={Colors.primary}
                                maximumTrackTintColor={Colors.light.border}
                                thumbTintColor={Colors.primary}
                                value={draftFilters.distanceKm}
                                onValueChange={(value) => setDraftFilters((current) => ({ ...current, distanceKm: value }))}
                            />
                            <View style={styles.distanceMarks}>
                                <Text style={styles.distanceMarkText}>0</Text>
                                <Text style={styles.distanceMarkText}>100</Text>
                                <Text style={styles.distanceMarkText}>200</Text>
                            </View>
                        </View>

                        <View style={styles.filtersSection}>
                            <Text style={styles.filtersSectionTitle}>Sobriety</Text>
                            <View style={styles.filterChipWrap}>
                                {SOBRIETY_OPTIONS.map((option) => (
                                    <FilterChip
                                        key={option}
                                        label={option}
                                        selected={draftFilters.sobriety === option}
                                        onPress={() => setDraftFilters((current) => ({ ...current, sobriety: option }))}
                                    />
                                ))}
                            </View>
                        </View>

                        <PrimaryButton
                            label="Apply Filters"
                            variant="warning"
                            onPress={handleApplyFilters}
                            leftAdornment={<Ionicons name="star" size={15} color={Colors.textOn.warning} />}
                            rightAdornment={!hasPlusAccess(user) ? <PlusButtonBadge /> : undefined}
                            style={styles.applyFiltersBtn}
                        />
                    </View>
                ) : null}
            </View>

            {isSearching ? (
                <View style={styles.flex}>
                    {discoverQuery.isLoading ? (
                        <View style={styles.center}>
                            <ActivityIndicator color={Colors.primary} />
                        </View>
                    ) : users.length === 0 ? (
                        <View style={styles.center}>
                            <Text style={styles.emptySub}>No users found for "{debouncedQuery}"</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={users}
                            keyExtractor={u => u.id}
                            contentContainerStyle={styles.resultsContent}
                            renderItem={({ item }) => (
                                <SearchResultRow
                                    user={item}
                                    isFriended={isFriendedFor(item)}
                                    onOpenUserProfile={onOpenUserProfile}
                                    onFriend={handleFriend}
                                />
                            )}
                            onEndReached={handleEndReached}
                            onEndReachedThreshold={0.3}
                            ListFooterComponent={discoverQuery.isFetchingNextPage
                                ? <ActivityIndicator color={Colors.primary} style={styles.listFooter} />
                                : null}
                            keyboardShouldPersistTaps="handled"
                        />
                    )}
                </View>
            ) : (
                <>
                    {users.length === 0 && !discoverQuery.isLoading ? (
                        <View style={styles.center}>
                            <Ionicons name="people-outline" size={52} color={Colors.light.textTertiary} />
                            <Text style={styles.emptyTitle}>No one here yet</Text>
                            <Text style={styles.emptySub}>Check back later for new members.</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={users}
                            keyExtractor={u => u.id}
                            numColumns={2}
                            columnWrapperStyle={styles.gridRow}
                            contentContainerStyle={styles.gridContent}
                            renderItem={({ item }) => (
                                <DiscoverCard
                                    user={item}
                                    isFriended={isFriendedFor(item)}
                                    onPress={() => onOpenUserProfile({
                                        userId: item.id,
                                        username: item.username,
                                        avatarUrl: item.avatar_url,
                                    })}
                                    onFriend={() => handleFriend(item.id)}
                                />
                            )}
                            onEndReached={handleEndReached}
                            onEndReachedThreshold={0.4}
                            ListFooterComponent={discoverQuery.isFetchingNextPage
                                ? <ActivityIndicator color={Colors.primary} style={styles.listFooter} />
                                : null}
                        />
                    )}
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    flex: { flex: 1 },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.md,
        backgroundColor: Colors.light.background,
        paddingHorizontal: Spacing.xl,
    },
    emptyTitle: {
        fontSize: Typography.sizes.xl,
        fontWeight: '600',
        color: Colors.light.textPrimary,
    },
    emptySub: {
        fontSize: Typography.sizes.base,
        color: Colors.light.textTertiary,
        textAlign: 'center',
    },

    controls: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.xs,
        paddingBottom: Spacing.md,
        gap: Spacing.sm,
    },

    // Search bar
    searchBar: {
        minHeight: 50,
    },

    // Filter bar
    filterBar: {
        flexDirection: 'row',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        borderRadius: Radii.lg,
        borderWidth: 1,
        borderColor: Colors.light.border,
        backgroundColor: Colors.light.backgroundSecondary,
        minHeight: 66,
    },
    filterBarLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        flex: 1,
    },
    filterBarIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.light.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterBarCopy: {
        flex: 1,
        gap: 2,
    },
    filterBarLabel: {
        fontSize: Typography.sizes.lg,
        fontWeight: '600',
        color: Colors.light.textPrimary,
    },
    filterBarSub: {
        fontSize: Typography.sizes.base,
        color: Colors.light.textTertiary,
    },
    filterBarRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginLeft: Spacing.sm,
    },
    filtersPanel: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.lg,
        borderWidth: 1,
        borderColor: Colors.light.border,
        padding: Spacing.md,
        gap: Spacing.md,
    },
    filtersSection: {
        gap: Spacing.sm,
    },
    filtersSectionTitle: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.light.textPrimary,
    },
    filterChipWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    filterChip: {
        borderRadius: Radii.pill,
        borderWidth: 1,
        borderColor: Colors.light.border,
        backgroundColor: Colors.light.background,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    filterChipActive: {
        borderColor: Colors.primary,
        backgroundColor: 'rgba(127,119,221,0.12)',
    },
    filterChipText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '500',
        color: Colors.light.textSecondary,
    },
    filterChipTextActive: {
        color: Colors.primary,
    },
    ageRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    ageField: {
        flex: 1,
        gap: Spacing.xs,
    },
    ageLabel: {
        fontSize: Typography.sizes.xs,
        fontWeight: '600',
        color: Colors.light.textTertiary,
    },
    distanceHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    distanceValue: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.primary,
    },
    distanceSlider: {
        width: '100%',
        height: 34,
    },
    distanceMarks: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: -2,
    },
    distanceMarkText: {
        fontSize: Typography.sizes.xs,
        color: Colors.light.textTertiary,
    },
    // Grid
    gridContent: {
        paddingHorizontal: Spacing.md,
        paddingTop: 0,
        paddingBottom: Spacing.xl,
        gap: CARD_GAP,
    },
    gridRow: {
        justifyContent: 'space-between',
        gap: CARD_GAP,
    },

    // Discover card
    card: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        borderRadius: Radii.xl,
        overflow: 'hidden',
        backgroundColor: Colors.light.backgroundSecondary,
    },
    cardInitials: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardInitialsText: {
        fontSize: 48,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.6)',
        letterSpacing: 2,
    },
    cardScrim: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: CARD_HEIGHT * 0.55,
    },
    cardFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm,
        paddingTop: Spacing.sm,
        gap: Spacing.xs,
        alignItems: 'center',
    },
    cardMilestonePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: Radii.pill,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    cardMilestoneText: {
        fontSize: Typography.sizes.xs ?? 10,
        fontWeight: '600',
        color: '#fff',
    },
    cardName: {
        fontSize: Typography.sizes.md,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
    },
    cardAddBtn: {
        position: 'absolute',
        top: Spacing.md,
        right: Spacing.md,
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardAddBtnDone: {
        backgroundColor: Colors.success,
    },

    // Search results list
    resultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        gap: Spacing.md,
        borderBottomWidth: 0.5,
        borderBottomColor: Colors.light.borderSecondary,
    },
    resultInfo: {
        flex: 1,
        gap: 2,
    },
    resultName: {
        fontSize: Typography.sizes.md,
        fontWeight: '600',
        color: Colors.light.textPrimary,
    },
    resultMeta: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
    },
    resultFriendBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: Colors.primary,
        backgroundColor: Colors.light.background,
    },
    resultFriendBtnDone: {
        backgroundColor: Colors.success,
        borderColor: Colors.success,
    },
    resultsContent: {
        paddingBottom: Spacing.xl,
    },
    listFooter: {
        paddingVertical: Spacing.lg,
    },
    applyFiltersBtn: {},
    buttonPlusBadge: {
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: Radii.pill,
        paddingHorizontal: Spacing.xs + 2,
        paddingVertical: 3,
    },
    buttonPlusBadgeText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.textOn.warning,
    },
});
