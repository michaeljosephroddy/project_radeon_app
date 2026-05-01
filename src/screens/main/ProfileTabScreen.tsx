import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View, Text, TouchableOpacity, Image,
    StyleSheet, ScrollView, FlatList, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Avatar } from '../../components/Avatar';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { SobrietyCounter } from '../../components/SobrietyCounter';
import type { CommentThreadTarget } from '../../components/CommentsModal';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { TextField } from '../../components/ui/TextField';
import { SettingsScreen } from './SettingsScreen';
import { HiddenContentScreen } from './HiddenContentScreen';
import { ProfileContentTabs, ProfileContentTabKey } from '../../components/profile/ProfileContentTabs';
import { ProfileEmptyTabState } from '../../components/profile/ProfileEmptyTabState';
import { ProfilePostCard } from '../../components/profile/ProfilePostCard';
import * as api from '../../api/client';
import { useGuardedEndReached } from '../../hooks/useGuardedEndReached';
import { useInterests } from '../../hooks/queries/useInterests';
import { useUserPosts } from '../../hooks/queries/useUserPosts';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { formatUsername } from '../../utils/identity';
import { formatBirthDateValue, GENDER_SEGMENTS, getGenderLabel } from '../../utils/profileIdentity';
import { formatSobrietyDate } from '../../utils/date';
import { screenStandards } from '../../styles/screenStandards';
import { dedupeById } from '../../utils/list';

type SubView = 'profile' | 'edit-profile' | 'friends' | 'requests' | 'settings' | 'hidden-content';
type RequestsSubView = 'incoming' | 'outgoing';
type EditableSection = 'bio' | 'location' | 'identity' | 'interests' | 'sobriety' | null;
type EditableGender = api.UserGender | '';
const MAX_BIO_LENGTH = 160;
const MAX_INTERESTS = 5;

interface ProfileTabScreenProps {
    isActive: boolean;
    onOpenUserProfile: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
    onOpenComments: (thread: CommentThreadTarget, focusComposer: boolean, onCommentCreated?: (comment: api.Comment) => void) => void;
    onBack?: () => void;
}

// Renders the current user's profile tab plus friends, requests, and settings subviews.
export function ProfileTabScreen({ isActive, onOpenUserProfile, onOpenComments, onBack }: ProfileTabScreenProps) {
    const { user, refreshUser, logout } = useAuth();
    const [subView, setSubView] = useState<SubView>('profile');
    const [requestsSubView, setRequestsSubView] = useState<RequestsSubView>('incoming');
    const [activeContentTab, setActiveContentTab] = useState<ProfileContentTabKey>('posts');

    const [city, setCity]             = useState(user?.city ?? '');
    const [country, setCountry]       = useState(user?.country ?? '');
    const [gender, setGender]         = useState<EditableGender>(user?.gender ?? '');
    const [bio, setBio]               = useState(user?.bio ?? '');
    const [birthDate, setBirthDate]   = useState(user?.birth_date ?? '');
    const [selectedInterests, setSelectedInterests] = useState<string[]>(user?.interests ?? []);
    const [soberSince, setSoberSince] = useState(user?.sober_since ?? '');
    const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
    const [showSoberSincePicker, setShowSoberSincePicker] = useState(false);
    const [editingSection, setEditingSection] = useState<EditableSection>(null);
    const [savingSection, setSavingSection] = useState<EditableSection>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [uploadingBanner, setUploadingBanner] = useState(false);
    const [localAvatarUrl, setLocalAvatarUrl]   = useState(user?.avatar_url);
    const [localBannerUrl, setLocalBannerUrl]   = useState(user?.banner_url ?? undefined);

    const [friends, setFriends] = useState<api.FriendUser[]>([]);
    const [incomingRequests, setIncomingRequests] = useState<api.FriendUser[]>([]);
    const [outgoingRequests, setOutgoingRequests] = useState<api.FriendUser[]>([]);
    const friendsCursorRef = useRef<string | undefined>(undefined);
    const incomingCursorRef = useRef<string | undefined>(undefined);
    const outgoingCursorRef = useRef<string | undefined>(undefined);
    const [friendsHasMore, setFriendsHasMore] = useState(false);
    const [incomingHasMore, setIncomingHasMore] = useState(false);
    const [outgoingHasMore, setOutgoingHasMore] = useState(false);
    const [loadingMoreFriends, setLoadingMoreFriends] = useState(false);
    const [loadingMoreIncoming, setLoadingMoreIncoming] = useState(false);
    const [loadingMoreOutgoing, setLoadingMoreOutgoing] = useState(false);
    const [pendingActionIds, setPendingActionIds] = useState<Set<string>>(new Set());
    const interestsQuery = useInterests(isActive);
    const userPostsQuery = useUserPosts(user?.id ?? '', 20, isActive && subView === 'profile' && Boolean(user?.id));
    const availableInterests = interestsQuery.data ?? [];
    const ownPosts = useMemo(
        () => dedupeById((userPostsQuery.data?.pages ?? []).flatMap(page => page.items ?? [])),
        [userPostsQuery.data?.pages]
    );
    const activeContentItems = activeContentTab === 'posts' ? ownPosts : [];
    const formattedSobrietyDate = formatSobrietyDate(soberSince);
    const sobrietyFieldValue = formattedSobrietyDate || soberSince || 'Not set';
    const bioCharactersRemaining = MAX_BIO_LENGTH - bio.length;
    const allInterestOptions = Array.from(new Set([...availableInterests, ...selectedInterests])).sort((a, b) => a.localeCompare(b));
    const birthDatePickerValue = birthDate ? new Date(`${birthDate}T12:00:00Z`) : new Date('1990-01-01T12:00:00Z');
    const soberSincePickerValue = soberSince ? new Date(`${soberSince}T12:00:00Z`) : new Date();
    const savedLocation = user?.city ? `${user.city}${user.country ? `, ${user.country}` : ''}` : 'Add your location';
    const savedGender = getGenderLabel(user?.gender);
    const savedBirthDate = formatBirthDateValue(user?.birth_date);
    const savedBio = user?.bio?.trim() ? user.bio : 'Add a short bio';
    const currentCityDisplay = (() => {
        if (!user?.current_city || !user.location_updated_at) return null;
        const updatedAt = new Date(user.location_updated_at).getTime();
        const fresh = Date.now() - updatedAt < 24 * 60 * 60 * 1000;
        if (!fresh) return null;
        if (user.current_city === user.city) return null;
        return user.current_city;
    })();

    useEffect(() => {
        if (!user) return;
        setCity(user.city ?? '');
        setCountry(user.country ?? '');
        setGender(user.gender ?? '');
        setBio(user.bio ?? '');
        setBirthDate(user.birth_date ?? '');
        setSelectedInterests(user.interests ?? []);
        setSoberSince(user.sober_since ?? '');
        setEditingSection(null);
        setSavingSection(null);
        setShowBirthDatePicker(false);
        setShowSoberSincePicker(false);
    }, [user]);

    // Loads one page of accepted friends for the current account.
    const loadFriends = useCallback(async (cursor?: string, replace = true) => {
        try {
            const nextFriends = await api.getFriends(cursor, 25);
            setFriends(current => replace ? (nextFriends.items ?? []) : [...current, ...(nextFriends.items ?? [])]);
            friendsCursorRef.current = nextFriends.next_cursor ?? undefined;
            setFriendsHasMore(nextFriends.has_more);
        } catch {}
    }, []);

    // Keeps incoming and outgoing request paging independent so each tab can
    // load deeper without pulling the other list along with it.
    const loadIncomingRequests = useCallback(async (cursor?: string, replace = true) => {
        try {
            const incoming = await api.getIncomingFriendRequests(cursor, 25);
            setIncomingRequests(current => replace ? (incoming.items ?? []) : [...current, ...(incoming.items ?? [])]);
            incomingCursorRef.current = incoming.next_cursor ?? undefined;
            setIncomingHasMore(incoming.has_more);
        } catch {}
    }, []);

    const loadOutgoingRequests = useCallback(async (cursor?: string, replace = true) => {
        try {
            const outgoing = await api.getOutgoingFriendRequests(cursor, 25);
            setOutgoingRequests(current => replace ? (outgoing.items ?? []) : [...current, ...(outgoing.items ?? [])]);
            outgoingCursorRef.current = outgoing.next_cursor ?? undefined;
            setOutgoingHasMore(outgoing.has_more);
        } catch {}
    }, []);

    // Refreshes the first page of all relationship lists so the profile counts
    // and detail subviews stay aligned after mutations.
    const loadFriendSummary = useCallback(async () => {
        await Promise.all([
            loadFriends(undefined, true),
            loadIncomingRequests(undefined, true),
            loadOutgoingRequests(undefined, true),
        ]);
    }, [loadFriends, loadIncomingRequests, loadOutgoingRequests]);

    useEffect(() => {
        if (isActive) {
            refreshUser().catch(() => {});
            loadFriendSummary();
        }
    }, [isActive, loadFriendSummary, refreshUser]);

    // Opens the media picker and uploads a replacement avatar.
    const handlePickAvatar = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            Alert.alert('Permission required', 'Allow access to your photo library to upload an avatar.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (result.canceled) return;
        setUploadingAvatar(true);
        try {
            const { avatar_url } = await api.uploadAvatar(result.assets[0].uri);
            // Bust any cached image URL immediately after upload so the new avatar
            // shows up without waiting for the CDN/browser cache to expire.
            setLocalAvatarUrl(`${avatar_url}?t=${Date.now()}`);
            refreshUser().catch(() => {});
        } catch (e: unknown) {
            Alert.alert('Upload failed', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handlePickBanner = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            Alert.alert('Permission required', 'Allow access to your photo library to upload a banner.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [3, 1],
            quality: 0.8,
        });
        if (result.canceled) return;
        const localUri = result.assets[0].uri;
        const previousBannerUrl = localBannerUrl;
        setLocalBannerUrl(localUri);
        setUploadingBanner(true);
        try {
            await api.uploadBanner(localUri);
            refreshUser().catch(() => {});
        } catch (e: unknown) {
            setLocalBannerUrl(previousBannerUrl);
            Alert.alert('Upload failed', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setUploadingBanner(false);
        }
    };

    const saveSection = async (section: Exclude<EditableSection, null>, payload: api.UpdateMeInput) => {
        setSavingSection(section);
        try {
            await api.updateMe(payload);
            await refreshUser();
        } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setSavingSection(null);
        }
    };

    const handleToggleInterest = (interest: string) => {
        const isSelected = selectedInterests.includes(interest);
        if (!isSelected && selectedInterests.length >= MAX_INTERESTS) {
            Alert.alert('Interest limit', `Pick up to ${MAX_INTERESTS} interests.`);
            return;
        }

        setSelectedInterests(current => {
            const next = isSelected
                ? current.filter(item => item !== interest)
                : [...current, interest].sort((a, b) => a.localeCompare(b));
            return next;
        });
    };

    const handleSoberSinceChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowSoberSincePicker(false);
            if (event.type === 'dismissed' || !selectedDate) return;
        }

        if (!selectedDate) return;

        const nextDate = [
            selectedDate.getFullYear(),
            String(selectedDate.getMonth() + 1).padStart(2, '0'),
            String(selectedDate.getDate()).padStart(2, '0'),
        ].join('-');

        setSoberSince(nextDate);
    };

    const handleBirthDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowBirthDatePicker(false);
            if (event.type === 'dismissed' || !selectedDate) return;
        }

        if (!selectedDate) return;

        const nextDate = [
            selectedDate.getFullYear(),
            String(selectedDate.getMonth() + 1).padStart(2, '0'),
            String(selectedDate.getDate()).padStart(2, '0'),
        ].join('-');

        setBirthDate(nextDate);
    };

    const handleStartEditSection = (section: Exclude<EditableSection, null>) => {
        if (!user) return;
        setEditingSection(section);
        if (section === 'bio') setBio(user.bio ?? '');
        if (section === 'location') {
            setCity(user.city ?? '');
            setCountry(user.country ?? '');
        }
        if (section === 'identity') {
            setGender(user.gender ?? '');
            setBirthDate(user.birth_date ?? '');
            setShowBirthDatePicker(Platform.OS === 'ios');
        }
        if (section === 'interests') setSelectedInterests(user.interests ?? []);
        if (section === 'sobriety') {
            setSoberSince(user.sober_since ?? '');
            setShowSoberSincePicker(Platform.OS === 'ios');
        } else {
            setShowSoberSincePicker(false);
        }
        if (section !== 'identity') {
            setShowBirthDatePicker(false);
        }
    };

    const handleCancelEditSection = () => {
        if (!user) return;
        setBio(user.bio ?? '');
        setCity(user.city ?? '');
        setCountry(user.country ?? '');
        setGender(user.gender ?? '');
        setBirthDate(user.birth_date ?? '');
        setSelectedInterests(user.interests ?? []);
        setSoberSince(user.sober_since ?? '');
        setShowBirthDatePicker(false);
        setShowSoberSincePicker(false);
        setEditingSection(null);
    };

    const handleSaveBio = async () => {
        if (bio.length > MAX_BIO_LENGTH) {
            Alert.alert('Bio too long', `Keep your bio under ${MAX_BIO_LENGTH} characters.`);
            return;
        }
        await saveSection('bio', { bio: bio.trim() || null });
    };

    const handleSaveLocation = async () => {
        await saveSection('location', {
            city: city.trim() || undefined,
            country: country.trim() || undefined,
        });
    };

    const handleSaveIdentity = async () => {
        await saveSection('identity', {
            gender,
            birth_date: birthDate || '',
        });
    };

    const handleSaveInterests = async () => {
        await saveSection('interests', { interests: selectedInterests });
    };

    const handleSaveSobriety = async () => {
        await saveSection('sobriety', { sober_since: soberSince || '' });
    };

    const handleOpenPostComments = (post: api.Post): void => {
        onOpenComments({
            itemId: post.id,
            itemKind: 'post',
            commentCount: post.comment_count,
        }, false);
    };

    // Optimistically removes an accepted friend.
    const handleRemoveFriend = async (u: api.FriendUser) => {
        setPendingActionIds(prev => new Set(prev).add(u.user_id));
        setFriends(prev => prev.filter(f => f.user_id !== u.user_id));
        try {
            await api.removeFriend(u.user_id);
            await Promise.all([loadFriends(undefined, true), refreshUser()]);
        } catch (e: unknown) {
            setFriends(prev => [u, ...prev]);
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setPendingActionIds(prev => { const s = new Set(prev); s.delete(u.user_id); return s; });
        }
    };

    const handleAcceptRequest = async (u: api.FriendUser) => {
        setPendingActionIds(prev => new Set(prev).add(u.user_id));
        setIncomingRequests(prev => prev.filter(req => req.user_id !== u.user_id));
        setFriends(prev => [u, ...prev]);
        try {
            await api.updateFriendRequest(u.user_id, 'accept');
            await Promise.all([loadFriends(undefined, true), loadIncomingRequests(undefined, true), loadOutgoingRequests(undefined, true), refreshUser()]);
        } catch (e: unknown) {
            setIncomingRequests(prev => [u, ...prev]);
            setFriends(prev => prev.filter(friend => friend.user_id !== u.user_id));
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setPendingActionIds(prev => { const s = new Set(prev); s.delete(u.user_id); return s; });
        }
    };

    const handleDeclineRequest = async (u: api.FriendUser) => {
        setPendingActionIds(prev => new Set(prev).add(u.user_id));
        setIncomingRequests(prev => prev.filter(req => req.user_id !== u.user_id));
        try {
            await api.updateFriendRequest(u.user_id, 'decline');
            await Promise.all([loadIncomingRequests(undefined, true), loadOutgoingRequests(undefined, true), refreshUser()]);
        } catch (e: unknown) {
            setIncomingRequests(prev => [u, ...prev]);
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setPendingActionIds(prev => { const s = new Set(prev); s.delete(u.user_id); return s; });
        }
    };

    const handleCancelRequest = async (u: api.FriendUser) => {
        setPendingActionIds(prev => new Set(prev).add(u.user_id));
        setOutgoingRequests(prev => prev.filter(req => req.user_id !== u.user_id));
        try {
            await api.cancelFriendRequest(u.user_id);
            await Promise.all([loadIncomingRequests(undefined, true), loadOutgoingRequests(undefined, true), refreshUser()]);
        } catch (e: unknown) {
            setOutgoingRequests(prev => [u, ...prev]);
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setPendingActionIds(prev => { const s = new Set(prev); s.delete(u.user_id); return s; });
        }
    };

    // Signs the current user out from the profile area.
    const handleLogout = async () => {
        try { await logout(); } catch {}
    };

    // Friends and requests are paged separately because these detail views can
    // grow much larger than the summary counts shown on the profile home.
    const handleLoadMoreFriends = async () => {
        if (loadingMoreFriends || !friendsHasMore) return;
        setLoadingMoreFriends(true);
        try {
            await loadFriends(friendsCursorRef.current, false);
        } finally {
            setLoadingMoreFriends(false);
        }
    };

    const handleLoadMoreRequests = async () => {
        if (requestsSubView === 'incoming') {
            if (loadingMoreIncoming || !incomingHasMore) return;
            setLoadingMoreIncoming(true);
            try {
                await loadIncomingRequests(incomingCursorRef.current, false);
            } finally {
                setLoadingMoreIncoming(false);
            }
            return;
        }

        if (loadingMoreOutgoing || !outgoingHasMore) return;
        setLoadingMoreOutgoing(true);
        try {
            await loadOutgoingRequests(outgoingCursorRef.current, false);
        } finally {
            setLoadingMoreOutgoing(false);
        }
    };
    const friendsListPagination = useGuardedEndReached(handleLoadMoreFriends);
    const requestsListPagination = useGuardedEndReached(handleLoadMoreRequests);

    if (!user) return null;

    if (subView === 'settings') {
        return <SettingsScreen onBack={() => setSubView('profile')} onLogout={handleLogout} onOpenHiddenContent={() => setSubView('hidden-content')} />;
    }

    if (subView === 'hidden-content') {
        return <HiddenContentScreen onBack={() => setSubView('settings')} onOpenUserProfile={onOpenUserProfile} />;
    }

    if (subView === 'friends') {
        return (
            <SafeAreaView style={styles.container} edges={['bottom']}>
                <ScreenHeader onBack={() => setSubView('profile')} title="Friends" />
                <FlatList
                    data={friends}
                    keyExtractor={item => item.user_id}
                    onEndReached={friendsListPagination.onEndReached}
                    onEndReachedThreshold={0.4}
                    onMomentumScrollBegin={friendsListPagination.onMomentumScrollBegin}
                    onScrollBeginDrag={friendsListPagination.onScrollBeginDrag}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => (
                        <View style={styles.row}>
                            <TouchableOpacity onPress={() => onOpenUserProfile({ userId: item.user_id, username: item.username, avatarUrl: item.avatar_url })}>
                                <Avatar username={item.username} avatarUrl={item.avatar_url} size={44} fontSize={14} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.rowInfo} onPress={() => onOpenUserProfile({ userId: item.user_id, username: item.username, avatarUrl: item.avatar_url })}>
                                <Text style={styles.rowName}>{formatUsername(item.username)}</Text>
                                {item.city && <Text style={styles.rowCity}>{item.city}</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.unfollowBtn}
                                onPress={() => handleRemoveFriend(item)}
                                disabled={pendingActionIds.has(item.user_id)}
                            >
                                <Text style={styles.unfollowBtnText}>Remove</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    ListEmptyComponent={
                        <Text style={styles.listEmpty}>No friends yet.</Text>
                    }
                    ListFooterComponent={loadingMoreFriends ? <ActivityIndicator style={styles.footerLoader} color={Colors.primary} /> : null}
                />
            </SafeAreaView>
        );
    }

    if (subView === 'requests') {
        return (
            <SafeAreaView style={styles.container} edges={['bottom']}>
                <ScreenHeader onBack={() => setSubView('profile')} title="Requests" />
                <SegmentedControl
                    activeKey={requestsSubView}
                    onChange={(key) => setRequestsSubView(key as RequestsSubView)}
                    tone="primary"
                    style={[screenStandards.tabControl, styles.requestTabs]}
                    items={[
                        {
                            key: 'incoming',
                            label: 'Incoming',
                            badgeLabel: incomingRequests.length > 0 ? String(incomingRequests.length) : undefined,
                        },
                        {
                            key: 'outgoing',
                            label: 'Sent',
                            badgeLabel: outgoingRequests.length > 0 ? String(outgoingRequests.length) : undefined,
                        },
                    ]}
                />
                <FlatList
                    data={requestsSubView === 'incoming' ? incomingRequests : outgoingRequests}
                    key={requestsSubView}
                    keyExtractor={item => `${requestsSubView}-${item.user_id}`}
                    onEndReached={requestsListPagination.onEndReached}
                    onEndReachedThreshold={0.4}
                    onMomentumScrollBegin={requestsListPagination.onMomentumScrollBegin}
                    onScrollBeginDrag={requestsListPagination.onScrollBeginDrag}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => {
                        return (
                            <View style={styles.row}>
                                <TouchableOpacity onPress={() => onOpenUserProfile({ userId: item.user_id, username: item.username, avatarUrl: item.avatar_url })}>
                                    <Avatar username={item.username} avatarUrl={item.avatar_url} size={44} fontSize={14} />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.rowInfo} onPress={() => onOpenUserProfile({ userId: item.user_id, username: item.username, avatarUrl: item.avatar_url })}>
                                    <Text style={styles.rowName}>{formatUsername(item.username)}</Text>
                                    {item.city && <Text style={styles.rowCity}>{item.city}</Text>}
                                </TouchableOpacity>
                                {requestsSubView === 'incoming' ? (
                                    <>
                                        <TouchableOpacity style={styles.requestActionPrimary} onPress={() => handleAcceptRequest(item)} disabled={pendingActionIds.has(item.user_id)}>
                                            <Text style={styles.requestActionPrimaryText}>Accept</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.requestActionSecondary} onPress={() => handleDeclineRequest(item)} disabled={pendingActionIds.has(item.user_id)}>
                                            <Text style={styles.requestActionSecondaryText}>Decline</Text>
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <TouchableOpacity style={styles.requestActionSecondary} onPress={() => handleCancelRequest(item)} disabled={pendingActionIds.has(item.user_id)}>
                                        <Text style={styles.requestActionSecondaryText}>Cancel</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    }}
                    ListEmptyComponent={<Text style={styles.listEmptyInline}>{requestsSubView === 'incoming' ? 'No incoming requests.' : 'No outgoing requests.'}</Text>}
                    ListFooterComponent={((requestsSubView === 'incoming' && loadingMoreIncoming) || (requestsSubView === 'outgoing' && loadingMoreOutgoing)) ? <ActivityIndicator style={styles.footerLoader} color={Colors.primary} /> : null}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScreenHeader
                onBack={subView === 'edit-profile' ? () => {
                    handleCancelEditSection();
                    setSubView('profile');
                } : onBack}
                title={subView === 'edit-profile' ? 'Edit Profile' : 'Profile'}
                trailing={subView === 'profile' ? (
                    <TouchableOpacity onPress={() => setSubView('settings')} style={styles.settingsBtn}>
                        <Text style={styles.settingsIcon}>⚙</Text>
                    </TouchableOpacity>
                ) : null}
            />

            <ScrollView style={styles.scroll} contentContainerStyle={[screenStandards.scrollContent, styles.content]} keyboardShouldPersistTaps="handled">
                {subView === 'profile' ? (
                    <>
                <TouchableOpacity onPress={handlePickBanner} disabled={uploadingBanner} activeOpacity={0.85} style={styles.bannerTouch}>
                    {localBannerUrl
                        ? <Image source={{ uri: localBannerUrl }} style={styles.banner} resizeMode="cover" />
                        : <View style={styles.bannerPlaceholder}>
                            <Ionicons name="image-outline" size={22} color={Colors.text.muted} />
                            <Text style={styles.bannerPlaceholderText}>Add a banner photo</Text>
                          </View>
                    }
                    <View style={styles.bannerCameraBtn}>
                        {uploadingBanner
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <Ionicons name="camera" size={14} color="#fff" />
                        }
                    </View>
                </TouchableOpacity>

                <View style={styles.avatarOverlapRow}>
                    <TouchableOpacity onPress={handlePickAvatar} disabled={uploadingAvatar} style={styles.avatarWrap}>
                        <View style={styles.avatarBorder}>
                            <Avatar username={user.username} avatarUrl={localAvatarUrl} size={110} fontSize={38} />
                        </View>
                        <View style={styles.avatarEditBadge}>
                            {uploadingAvatar
                                ? <ActivityIndicator size="small" color={Colors.textOn.primary} />
                                : <Ionicons name="camera" size={12} color={Colors.textOn.primary} />
                            }
                        </View>
                    </TouchableOpacity>
                </View>

	                <View style={styles.mainContent}>
	                    <Text style={styles.avatarName}>{formatUsername(user.username)}</Text>
	                    {user.city ? <Text style={styles.avatarSub}>{user.city}{user.country ? `, ${user.country}` : ''}</Text> : null}
	                    {user.bio ? <Text style={styles.profileBioText}>{user.bio}</Text> : null}
	                    {user.interests.length > 0 ? (
	                        <View style={styles.profileSummaryInterests}>
	                            {user.interests.slice(0, MAX_INTERESTS).map((interest) => (
	                                <View key={interest} style={styles.profileSummaryInterestChip}>
	                                    <Text style={styles.profileSummaryInterestChipText}>{interest}</Text>
	                                </View>
	                            ))}
	                        </View>
	                    ) : null}
	                    <SobrietyCounter soberSince={user.sober_since} compact style={styles.profileSummarySobriety} />

	                    <View style={styles.statsRow}>
	                        <View style={styles.statItem}>
	                            <Text style={styles.statCount}>{ownPosts.length}</Text>
                            <Text style={styles.statLabel}>Posts</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <TouchableOpacity style={styles.statItem} onPress={() => setSubView('friends')}>
                            <Text style={styles.statCount}>{user.friend_count}</Text>
                            <Text style={styles.statLabel}>Friends</Text>
                        </TouchableOpacity>
                        <View style={styles.statDivider} />
                        <TouchableOpacity style={styles.statItem} onPress={() => setSubView('requests')}>
                            <Text style={styles.statCount}>{user.incoming_friend_request_count + user.outgoing_friend_request_count}</Text>
	                            <Text style={styles.statLabel}>Requests</Text>
	                        </TouchableOpacity>
	                    </View>

	                    <View style={styles.profileActionRow}>
	                        <TouchableOpacity style={styles.profileEditButton} onPress={() => setSubView('edit-profile')}>
	                            <Text style={styles.profileEditButtonText}>Edit Profile</Text>
	                        </TouchableOpacity>
	                    </View>

	                    <View style={styles.profileContentTabsWrap}>
	                        <ProfileContentTabs activeTab={activeContentTab} onChange={setActiveContentTab} />
	                    </View>
                    {userPostsQuery.isLoading && activeContentTab === 'posts' ? (
                        <ActivityIndicator color={Colors.primary} style={styles.profilePostsLoader} />
                    ) : activeContentItems.length > 0 ? (
                        <View style={styles.profilePostList}>
                            {activeContentItems.map((item) => (
                                <ProfilePostCard
                                    key={item.id}
                                    post={item}
                                    onPressComments={handleOpenPostComments}
                                />
                            ))}
                        </View>
	                    ) : (
	                        <ProfileEmptyTabState tab={activeContentTab} username={formatUsername(user.username)} />
	                    )}
	                </View>
                    </>
                ) : null}

                {subView === 'edit-profile' ? (
                <View style={styles.mainContent}>
                    <View style={screenStandards.sectionLabelBlock}>
                        <SectionLabel>BIO</SectionLabel>
                    </View>
                    <View style={styles.fieldGroup}>
                        <View style={styles.sectionCardHeader}>
                            <Text style={styles.sectionCardTitle}>Short bio</Text>
                            {editingSection === 'bio' ? (
                                <Text style={[styles.bioCounter, bioCharactersRemaining < 0 && styles.bioCounterOver]}>
                                    {bio.length}/{MAX_BIO_LENGTH}
                                </Text>
                            ) : (
                                <TouchableOpacity onPress={() => handleStartEditSection('bio')}>
                                    <Text style={styles.sectionActionText}>Edit</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        {editingSection === 'bio' ? (
                            <>
                                <TextField
                                    style={styles.bioInput}
                                    value={bio}
                                    onChangeText={setBio}
                                    placeholder="A little about you, what you enjoy, or the kind of people you'd like to meet."
                                    placeholderTextColor={Colors.text.muted}
                                    multiline
                                    maxLength={MAX_BIO_LENGTH}
                                    textAlignVertical="top"
                                />
                                <View style={styles.sectionActions}>
                                    <TouchableOpacity style={styles.sectionSecondaryButton} onPress={handleCancelEditSection}>
                                        <Text style={styles.sectionSecondaryButtonText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <PrimaryButton
                                        label="Save"
                                        onPress={handleSaveBio}
                                        loading={savingSection === 'bio'}
                                        disabled={savingSection === 'bio' || bio.length > MAX_BIO_LENGTH}
                                        style={styles.sectionPrimaryButton}
                                    />
                                </View>
                            </>
                        ) : (
                            <Text style={[styles.sectionValueText, !user.bio && styles.sectionValuePlaceholder]}>{savedBio}</Text>
                        )}
                    </View>

                    <View style={screenStandards.sectionLabelBlock}>
                        <SectionLabel>LOCATION</SectionLabel>
                    </View>
                    <View style={styles.fieldGroup}>
                        <View style={styles.sectionCardHeader}>
                            <Text style={styles.sectionCardTitle}>Location</Text>
                            {editingSection === 'location' ? null : (
                                <TouchableOpacity onPress={() => handleStartEditSection('location')}>
                                    <Text style={styles.sectionActionText}>Edit</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        {editingSection === 'location' ? (
                            <>
                                <View style={styles.fieldEditor}>
                                    <Text style={styles.editFieldLabel}>City</Text>
                                    <TextField
                                        style={styles.editFieldInput}
                                        value={city}
                                        onChangeText={setCity}
                                        placeholder="City"
                                        placeholderTextColor={Colors.text.muted}
                                        autoCapitalize="words"
                                    />
                                </View>
                                <View style={styles.fieldEditor}>
                                    <Text style={styles.editFieldLabel}>Country</Text>
                                    <TextField
                                        style={styles.editFieldInput}
                                        value={country}
                                        onChangeText={setCountry}
                                        placeholder="Country"
                                        placeholderTextColor={Colors.text.muted}
                                        autoCapitalize="words"
                                    />
                                </View>
                                <View style={styles.sectionActions}>
                                    <TouchableOpacity style={styles.sectionSecondaryButton} onPress={handleCancelEditSection}>
                                        <Text style={styles.sectionSecondaryButtonText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <PrimaryButton
                                        label="Save"
                                        onPress={handleSaveLocation}
                                        loading={savingSection === 'location'}
                                        disabled={savingSection === 'location'}
                                        style={styles.sectionPrimaryButton}
                                    />
                                </View>
                            </>
                        ) : (
                            <>
                                <Text style={[styles.sectionValueText, !user.city && styles.sectionValuePlaceholder]}>{savedLocation}</Text>
                                {currentCityDisplay && (
                                    <Text style={styles.currentCityText}>Currently in {currentCityDisplay}</Text>
                                )}
                            </>
                        )}
                    </View>

                    <View style={screenStandards.sectionLabelBlock}>
                        <SectionLabel>INTERESTS</SectionLabel>
                    </View>
                    <View style={styles.fieldGroup}>
                        <View style={styles.sectionCardHeader}>
                            <Text style={styles.sectionCardTitle}>Interests</Text>
                            {editingSection === 'interests' ? (
                                <Text style={styles.interestsCount}>{selectedInterests.length}/{MAX_INTERESTS}</Text>
                            ) : (
                                <TouchableOpacity onPress={() => handleStartEditSection('interests')}>
                                    <Text style={styles.sectionActionText}>Edit</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        {editingSection === 'interests' ? (
                            <>
                                <View style={styles.interestsWrap}>
                                    {allInterestOptions.map((interest) => {
                                        const isSelected = selectedInterests.includes(interest);
                                        return (
                                            <TouchableOpacity
                                                key={interest}
                                                style={[styles.interestChip, isSelected && styles.interestChipActive]}
                                                onPress={() => handleToggleInterest(interest)}
                                            >
                                                <Text style={[styles.interestChipText, isSelected && styles.interestChipTextActive]}>
                                                    {interest}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                                <View style={styles.sectionActions}>
                                    <TouchableOpacity style={styles.sectionSecondaryButton} onPress={handleCancelEditSection}>
                                        <Text style={styles.sectionSecondaryButtonText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <PrimaryButton
                                        label="Save"
                                        onPress={handleSaveInterests}
                                        loading={savingSection === 'interests'}
                                        disabled={savingSection === 'interests'}
                                        style={styles.sectionPrimaryButton}
                                    />
                                </View>
                            </>
                        ) : user.interests.length > 0 ? (
                            <View style={styles.interestsWrap}>
                                {user.interests.map((interest) => (
                                    <View key={interest} style={styles.interestChip}>
                                        <Text style={styles.interestChipText}>{interest}</Text>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <Text style={[styles.sectionValueText, styles.sectionValuePlaceholder]}>Pick a few interests to help people get to know you.</Text>
                        )}
                    </View>

                    <View style={screenStandards.sectionLabelBlock}>
                        <SectionLabel>IDENTITY</SectionLabel>
                    </View>
                    <View style={styles.fieldGroup}>
                        <View style={styles.sectionCardHeader}>
                            <Text style={styles.sectionCardTitle}>Identity</Text>
                            {editingSection === 'identity' ? null : (
                                <TouchableOpacity onPress={() => handleStartEditSection('identity')}>
                                    <Text style={styles.sectionActionText}>Edit</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        {editingSection === 'identity' ? (
                            <>
                                <Text style={styles.editFieldLabel}>Gender</Text>
                                <SegmentedControl
                                    activeKey={gender || 'none'}
                                    onChange={(key) => setGender(key as EditableGender)}
                                    tone="secondary"
                                    style={styles.identitySegments}
                                    items={GENDER_SEGMENTS.map((item) => ({
                                        key: item.key,
                                        label: item.label,
                                    }))}
                                />
                                <View style={styles.identityInlineActions}>
                                    <TouchableOpacity onPress={() => setGender('')}>
                                        <Text style={styles.identityInlineActionText}>Clear gender</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.fieldEditor}>
                                    <Text style={styles.editFieldLabel}>Birth date</Text>
                                    <TouchableOpacity
                                        onPress={() => setShowBirthDatePicker(true)}
                                        style={styles.identityValueButton}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[styles.sectionValueText, !birthDate && styles.sectionValuePlaceholder]}>
                                            {formatBirthDateValue(birthDate)}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.identityInlineActions}>
                                    <TouchableOpacity onPress={() => setBirthDate('')}>
                                        <Text style={styles.identityInlineActionText}>Clear birth date</Text>
                                    </TouchableOpacity>
                                </View>
                                {Platform.OS === 'ios' ? (
                                    <View style={styles.inlineDatePickerWrap}>
                                        <DateTimePicker
                                            value={birthDatePickerValue}
                                            mode="date"
                                            display="spinner"
                                            maximumDate={new Date()}
                                            onChange={handleBirthDateChange}
                                        />
                                    </View>
                                ) : showBirthDatePicker ? (
                                    <DateTimePicker
                                        value={birthDatePickerValue}
                                        mode="date"
                                        display="default"
                                        maximumDate={new Date()}
                                        onChange={handleBirthDateChange}
                                    />
                                ) : null}
                                <View style={styles.sectionActions}>
                                    <TouchableOpacity style={styles.sectionSecondaryButton} onPress={handleCancelEditSection}>
                                        <Text style={styles.sectionSecondaryButtonText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <PrimaryButton
                                        label="Save"
                                        onPress={handleSaveIdentity}
                                        loading={savingSection === 'identity'}
                                        disabled={savingSection === 'identity'}
                                        style={styles.sectionPrimaryButton}
                                    />
                                </View>
                            </>
                        ) : (
                            <>
                                <Text style={[styles.sectionValueText, !user?.gender && styles.sectionValuePlaceholder]}>{savedGender}</Text>
                                <Text style={[styles.sectionMetaText, !user?.birth_date && styles.sectionValuePlaceholder]}>{savedBirthDate}</Text>
                            </>
                        )}
                    </View>

                    <View style={screenStandards.sectionLabelBlock}>
                        <SectionLabel>SOBRIETY</SectionLabel>
                    </View>
                    <View style={styles.fieldGroup}>
                        <SobrietyCounter soberSince={soberSince} style={styles.sobrietyCounter} />
                        {soberSince ? <View style={styles.fieldDivider} /> : null}
                        <View style={styles.sectionCardHeader}>
                            <Text style={styles.sectionCardTitle}>Sober since</Text>
                            {editingSection === 'sobriety' ? null : (
                                <TouchableOpacity onPress={() => handleStartEditSection('sobriety')}>
                                    <Text style={styles.sectionActionText}>Edit</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <TouchableOpacity
                            onPress={() => {
                                if (editingSection === 'sobriety') setShowSoberSincePicker(true);
                            }}
                            disabled={editingSection !== 'sobriety'}
                        >
                            <Text style={[styles.sectionValueText, !soberSince && styles.sectionValuePlaceholder]}>
                                {sobrietyFieldValue}
                            </Text>
                        </TouchableOpacity>
                        {editingSection === 'sobriety' ? (
                            <>
                                {Platform.OS === 'ios' ? (
                                    <View style={styles.inlineDatePickerWrap}>
                                        <DateTimePicker
                                            value={soberSincePickerValue}
                                            mode="date"
                                            display="spinner"
                                            maximumDate={new Date()}
                                            onChange={handleSoberSinceChange}
                                        />
                                    </View>
                                ) : showSoberSincePicker ? (
                                    <DateTimePicker
                                        value={soberSincePickerValue}
                                        mode="date"
                                        display="default"
                                        maximumDate={new Date()}
                                        onChange={handleSoberSinceChange}
                                    />
                                ) : null}
                                <View style={styles.sectionActions}>
                                    <TouchableOpacity style={styles.sectionSecondaryButton} onPress={handleCancelEditSection}>
                                        <Text style={styles.sectionSecondaryButtonText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <PrimaryButton
                                        label="Save"
                                        onPress={handleSaveSobriety}
                                        loading={savingSection === 'sobriety'}
                                        disabled={savingSection === 'sobriety'}
                                        style={styles.sectionPrimaryButton}
                                    />
                                </View>
                            </>
                        ) : null}
                    </View>
                </View>
                ) : null}

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.page },
    scroll: { flex: 1 },
    settingsBtn: { padding: 4 },
    settingsIcon: { fontSize: 20, color: Colors.text.muted },

    listContent: { paddingVertical: Spacing.sm },
    listEmpty: {
        fontSize: Typography.sizes.base,
        color: Colors.text.muted,
        textAlign: 'center',
        marginTop: 60,
    },
    listEmptyInline: {
        fontSize: Typography.sizes.base,
        color: Colors.text.muted,
        textAlign: 'center',
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.md,
    },
    footerLoader: { paddingVertical: Spacing.md },
    requestTabs: {
        marginBottom: 0,
    },

    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        gap: Spacing.md,
    },
    rowInfo: { flex: 1, gap: 2 },
    rowName: { fontSize: Typography.sizes.base, fontWeight: '500', color: Colors.text.primary },
    rowCity: { fontSize: Typography.sizes.sm, color: Colors.text.muted },
    unfollowBtn: {
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
    },
    unfollowBtnText: { fontSize: Typography.sizes.sm, fontWeight: '500', color: Colors.text.secondary },
    requestActionPrimary: {
        backgroundColor: Colors.primary,
        borderRadius: Radius.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
    },
    requestActionPrimaryText: { fontSize: Typography.sizes.sm, fontWeight: '600', color: Colors.textOn.primary },
    requestActionSecondary: {
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
    },
    requestActionSecondaryText: { fontSize: Typography.sizes.sm, fontWeight: '500', color: Colors.text.secondary },

    content: { paddingBottom: Spacing.md },
    mainContent: { gap: 0, paddingHorizontal: Spacing.md },

    bannerTouch: {
        marginHorizontal: Spacing.md,
        borderRadius: Radius.lg,
        overflow: 'hidden',
    },
    banner: { height: 140 },
    bannerPlaceholder: {
        height: 140,
        backgroundColor: Colors.bg.surface,
        borderWidth: 0.5,
        borderColor: Colors.border.default,
        borderRadius: Radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        paddingBottom: Spacing.xl,
    },
    bannerPlaceholderText: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.muted,
    },
    bannerCameraBtn: {
        position: 'absolute',
        bottom: Spacing.sm,
        right: Spacing.sm,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarOverlapRow: {
        marginHorizontal: Spacing.md,
        marginTop: -56,
        marginBottom: Spacing.sm,
        alignItems: 'center',
    },
    avatarBorder: {
        width: 118,
        height: 118,
        borderRadius: 59,
        backgroundColor: Colors.bg.page,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarWrap: { position: 'relative' },
    avatarEditBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: Colors.bg.page,
    },
    avatarName: { fontSize: Typography.sizes.lg, fontWeight: '600', color: Colors.text.primary, marginBottom: 2 },
    avatarSub: { fontSize: Typography.sizes.sm, color: Colors.text.muted, marginBottom: Spacing.sm },
    profileBioText: {
        fontSize: Typography.sizes.base,
        color: Colors.text.secondary,
        lineHeight: 20,
        marginBottom: Spacing.sm,
    },
    profileSummaryInterests: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    profileSummaryInterestChip: {
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
    },
    profileSummaryInterestChipText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
    profileSummarySobriety: {
        borderBottomWidth: 0,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.surface,
        marginBottom: Spacing.md,
    },

    statsRow: {
        flexDirection: 'row',
        backgroundColor: Colors.bg.surface,
        borderRadius: Radius.md,
        marginBottom: Spacing.md,
        overflow: 'hidden',
    },
    statItem: { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 2 },
    statCount: { fontSize: Typography.sizes.lg, fontWeight: '700', color: Colors.text.primary },
    statLabel: { fontSize: Typography.sizes.xs, color: Colors.text.muted, letterSpacing: 0.4 },
    statDivider: { width: 0.5, backgroundColor: Colors.border.default, marginVertical: 12 },
    profileContentTabsWrap: {
        marginHorizontal: -Spacing.md,
        marginBottom: Spacing.sm,
    },
    profilePostList: {
        marginHorizontal: -Spacing.md,
        marginBottom: Spacing.md,
    },
    profilePostsLoader: {
        paddingVertical: Spacing.xl,
    },
    profileActionRow: {
        marginBottom: Spacing.md,
    },
    profileEditButton: {
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.sm,
        backgroundColor: Colors.bg.surface,
        alignItems: 'center',
        paddingVertical: 10,
    },
    profileEditButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.text.primary,
    },

    fieldGroup: { backgroundColor: Colors.bg.surface, borderRadius: Radius.md, overflow: 'hidden' },
    sectionCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    sectionCardTitle: {
        fontSize: Typography.sizes.base,
        fontWeight: '600',
        color: Colors.text.primary,
    },
    sectionActionText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.primary,
    },
    sectionValueText: {
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.md,
        fontSize: Typography.sizes.base,
        lineHeight: 20,
        color: Colors.text.primary,
    },
    sectionValuePlaceholder: {
        color: Colors.text.muted,
    },
    sectionMetaText: {
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.md,
        marginTop: -Spacing.sm,
        fontSize: Typography.sizes.sm,
        color: Colors.text.secondary,
    },
    currentCityText: {
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.md,
        fontSize: Typography.sizes.sm,
        color: Colors.text.secondary,
    },
    fieldEditor: {
        gap: Spacing.sm,
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.md,
    },
    fieldDivider: { height: 0.5, backgroundColor: Colors.border.default, marginLeft: Spacing.md },
    editFieldLabel: {
        ...Typography.formLabel,
        color: Colors.text.secondary,
    },
    editFieldInput: {
        fontSize: Typography.sizes.base,
    },
    identitySegments: {
        paddingHorizontal: Spacing.md,
        marginBottom: Spacing.md,
    },
    identityValueButton: {
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.page,
        paddingTop: Spacing.md,
    },
    identityInlineActions: {
        alignItems: 'flex-end',
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    identityInlineActionText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.primary,
    },
    inlineDatePickerWrap: {
        borderTopWidth: 0.5,
        borderTopColor: Colors.border.default,
        paddingHorizontal: Spacing.sm,
        paddingBottom: Spacing.sm,
    },
    bioCounter: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.muted,
    },
    bioCounterOver: {
        color: Colors.danger,
    },
    bioInput: {
        minHeight: 96,
        marginHorizontal: Spacing.md,
        marginBottom: Spacing.md,
        fontSize: Typography.sizes.base,
        lineHeight: 20,
        textAlignVertical: 'top',
    },
    interestsCount: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.muted,
    },
    interestsWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.md,
    },
    interestChip: {
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.page,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
    },
    interestChipActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    interestChipText: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.secondary,
        fontWeight: '500',
    },
    interestChipTextActive: {
        color: Colors.textOn.primary,
        fontWeight: '600',
    },
    sectionActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.md,
    },
    sectionSecondaryButton: {
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        backgroundColor: Colors.bg.page,
    },
    sectionSecondaryButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
    sectionPrimaryButton: {
        minWidth: 82,
    },
    sobrietyCounter: {
        borderRadius: 0,
    },
    sobrietySummary: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        gap: 6,
    },
    sobrietySummaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    sobrietySummaryTitle: {
        flex: 1,
        fontSize: Typography.sizes.base,
        fontWeight: '600',
        color: Colors.text.primary,
    },
    sobrietySummaryValue: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
    sobrietySummaryHint: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.muted,
    },
    milestoneBadge: {
        backgroundColor: Colors.primary,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        paddingVertical: 7,
    },
    milestoneBadgeText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.textOn.primary,
    },
    saveBtnDisabled: {
        opacity: 0.6,
    },
});
