import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, ScrollView, FlatList, ActivityIndicator, Alert, Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Avatar } from '../../components/Avatar';
import { SettingsScreen } from './SettingsScreen';
import * as api from '../../api/client';
import { useGuardedEndReached } from '../../hooks/useGuardedEndReached';
import { useInterests } from '../../hooks/queries/useInterests';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';
import { formatUsername } from '../../utils/identity';
import { formatRecoveryDuration, formatSobrietyDate, getRecoveryMilestone } from '../../utils/date';

type SubView = 'profile' | 'friends' | 'requests' | 'settings';
type RequestsSubView = 'incoming' | 'outgoing';
type EditableSection = 'bio' | 'location' | 'interests' | 'sobriety' | null;
const MAX_BIO_LENGTH = 160;
const MAX_INTERESTS = 5;

interface ProfileTabScreenProps {
    isActive: boolean;
    onOpenUserProfile: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
    onBack?: () => void;
}

// Renders the current user's profile tab plus friends, requests, and settings subviews.
export function ProfileTabScreen({ isActive, onOpenUserProfile, onBack }: ProfileTabScreenProps) {
    const { user, refreshUser, logout } = useAuth();
    const [subView, setSubView] = useState<SubView>('profile');
    const [requestsSubView, setRequestsSubView] = useState<RequestsSubView>('incoming');

    const [city, setCity]             = useState(user?.city ?? '');
    const [country, setCountry]       = useState(user?.country ?? '');
    const [bio, setBio]               = useState(user?.bio ?? '');
    const [selectedInterests, setSelectedInterests] = useState<string[]>(user?.interests ?? []);
    const [soberSince, setSoberSince] = useState(user?.sober_since ?? '');
    const [showSoberSincePicker, setShowSoberSincePicker] = useState(false);
    const [editingSection, setEditingSection] = useState<EditableSection>(null);
    const [savingSection, setSavingSection] = useState<EditableSection>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [localAvatarUrl, setLocalAvatarUrl]   = useState(user?.avatar_url);

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
    const availableInterests = interestsQuery.data ?? [];
    const formattedSobrietyDate = formatSobrietyDate(soberSince);
    const recoveryMilestone = getRecoveryMilestone(soberSince);
    const sobrietyFieldValue = formattedSobrietyDate || soberSince || 'Not set';
    const bioCharactersRemaining = MAX_BIO_LENGTH - bio.length;
    const allInterestOptions = Array.from(new Set([...availableInterests, ...selectedInterests])).sort((a, b) => a.localeCompare(b));
    const soberSincePickerValue = soberSince ? new Date(`${soberSince}T12:00:00Z`) : new Date();
    const savedLocation = user?.city ? `${user.city}${user.country ? `, ${user.country}` : ''}` : 'Add your location';
    const savedBio = user?.bio?.trim() ? user.bio : 'Add a short bio';

    useEffect(() => {
        if (!user) return;
        setCity(user.city ?? '');
        setCountry(user.country ?? '');
        setBio(user.bio ?? '');
        setSelectedInterests(user.interests ?? []);
        setSoberSince(user.sober_since ?? '');
        setEditingSection(null);
        setSavingSection(null);
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

    const handleStartEditSection = (section: Exclude<EditableSection, null>) => {
        if (!user) return;
        setEditingSection(section);
        if (section === 'bio') setBio(user.bio ?? '');
        if (section === 'location') {
            setCity(user.city ?? '');
            setCountry(user.country ?? '');
        }
        if (section === 'interests') setSelectedInterests(user.interests ?? []);
        if (section === 'sobriety') {
            setSoberSince(user.sober_since ?? '');
            setShowSoberSincePicker(Platform.OS === 'ios');
        } else {
            setShowSoberSincePicker(false);
        }
    };

    const handleCancelEditSection = () => {
        if (!user) return;
        setBio(user.bio ?? '');
        setCity(user.city ?? '');
        setCountry(user.country ?? '');
        setSelectedInterests(user.interests ?? []);
        setSoberSince(user.sober_since ?? '');
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

    const handleSaveInterests = async () => {
        await saveSection('interests', { interests: selectedInterests });
    };

    const handleSaveSobriety = async () => {
        await saveSection('sobriety', { sober_since: soberSince || '' });
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
        return <SettingsScreen onBack={() => setSubView('profile')} onLogout={handleLogout} />;
    }

    if (subView === 'friends') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.subHeader}>
                    <TouchableOpacity onPress={() => setSubView('profile')} style={styles.subHeaderSide}>
                        <Text style={styles.backIcon}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.subHeaderTitle}>Friends</Text>
                    <View style={styles.subHeaderSide} />
                </View>
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
                                <Avatar username={item.username} avatarUrl={item.avatar_url} size={48} fontSize={16} />
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
            <SafeAreaView style={styles.container}>
                <View style={styles.subHeader}>
                    <TouchableOpacity onPress={() => setSubView('profile')} style={styles.subHeaderSide}>
                        <Text style={styles.backIcon}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.subHeaderTitle}>Requests</Text>
                    <View style={styles.subHeaderSide} />
                </View>
                <View style={styles.requestTabs}>
                    <TouchableOpacity
                        style={[styles.requestTab, requestsSubView === 'incoming' && styles.requestTabActive]}
                        onPress={() => setRequestsSubView('incoming')}
                    >
                        <Text style={[styles.requestTabText, requestsSubView === 'incoming' && styles.requestTabTextActive]}>Incoming</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.requestTab, requestsSubView === 'outgoing' && styles.requestTabActive]}
                        onPress={() => setRequestsSubView('outgoing')}
                    >
                        <Text style={[styles.requestTabText, requestsSubView === 'outgoing' && styles.requestTabTextActive]}>Sent</Text>
                    </TouchableOpacity>
                </View>
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
                                    <Avatar username={item.username} avatarUrl={item.avatar_url} size={48} fontSize={16} />
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
        <SafeAreaView style={styles.container}>
            <View style={styles.topBar}>
                {onBack ? (
                    <TouchableOpacity onPress={onBack} style={styles.topBarSide}>
                        <Text style={styles.backIcon}>←</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.topBarSide} />
                )}
                <Text style={styles.topBarTitle}>Profile</Text>
                <TouchableOpacity onPress={() => setSubView('settings')} style={styles.settingsBtn}>
                    <Text style={styles.settingsIcon}>⚙</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <View style={styles.mainContent}>
                    <View style={styles.avatarSection}>
                        <TouchableOpacity onPress={handlePickAvatar} disabled={uploadingAvatar} style={styles.avatarWrap}>
                            <Avatar
                                username={user.username}
                                avatarUrl={localAvatarUrl}
                                size={80}
                                fontSize={28}
                            />
                            <View style={styles.avatarEditBadge}>
                                {uploadingAvatar
                                    ? <ActivityIndicator size="small" color={Colors.textOn.primary} />
                                    : <Text style={styles.avatarEditIcon}>✎</Text>
                                }
                            </View>
                        </TouchableOpacity>
                        <Text style={styles.avatarName}>{formatUsername(user.username)}</Text>
                        {user.city ? <Text style={styles.avatarSub}>{user.city}{user.country ? `, ${user.country}` : ''}</Text> : null}
                    </View>

                    <View style={styles.statsRow}>
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

                    <Text style={styles.sectionLabel}>BIO</Text>
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
                                <TextInput
                                    style={styles.bioInput}
                                    value={bio}
                                    onChangeText={setBio}
                                    placeholder="A little about you, what you enjoy, or the kind of people you'd like to meet."
                                    placeholderTextColor={Colors.light.textTertiary}
                                    multiline
                                    maxLength={MAX_BIO_LENGTH}
                                    textAlignVertical="top"
                                />
                                <View style={styles.sectionActions}>
                                    <TouchableOpacity style={styles.sectionSecondaryButton} onPress={handleCancelEditSection}>
                                        <Text style={styles.sectionSecondaryButtonText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.sectionPrimaryButton, savingSection === 'bio' && styles.saveBtnDisabled]}
                                        onPress={handleSaveBio}
                                        disabled={savingSection === 'bio' || bio.length > MAX_BIO_LENGTH}
                                    >
                                        {savingSection === 'bio'
                                            ? <ActivityIndicator size="small" color={Colors.textOn.primary} />
                                            : <Text style={styles.sectionPrimaryButtonText}>Save</Text>}
                                    </TouchableOpacity>
                                </View>
                            </>
                        ) : (
                            <Text style={[styles.sectionValueText, !user.bio && styles.sectionValuePlaceholder]}>{savedBio}</Text>
                        )}
                    </View>

                    <Text style={styles.sectionLabel}>LOCATION</Text>
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
                                <View style={styles.fieldRow}>
                                    <Text style={styles.fieldLabel}>City</Text>
                                    <TextInput style={styles.fieldInput} value={city} onChangeText={setCity} placeholder="City" placeholderTextColor={Colors.light.textTertiary} />
                                </View>
                                <View style={styles.fieldDivider} />
                                <View style={styles.fieldRow}>
                                    <Text style={styles.fieldLabel}>Country</Text>
                                    <TextInput style={styles.fieldInput} value={country} onChangeText={setCountry} placeholder="Country" placeholderTextColor={Colors.light.textTertiary} />
                                </View>
                                <View style={styles.sectionActions}>
                                    <TouchableOpacity style={styles.sectionSecondaryButton} onPress={handleCancelEditSection}>
                                        <Text style={styles.sectionSecondaryButtonText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.sectionPrimaryButton, savingSection === 'location' && styles.saveBtnDisabled]}
                                        onPress={handleSaveLocation}
                                        disabled={savingSection === 'location'}
                                    >
                                        {savingSection === 'location'
                                            ? <ActivityIndicator size="small" color={Colors.textOn.primary} />
                                            : <Text style={styles.sectionPrimaryButtonText}>Save</Text>}
                                    </TouchableOpacity>
                                </View>
                            </>
                        ) : (
                            <Text style={[styles.sectionValueText, !user.city && styles.sectionValuePlaceholder]}>{savedLocation}</Text>
                        )}
                    </View>

                    <Text style={styles.sectionLabel}>INTERESTS</Text>
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
                                    <TouchableOpacity
                                        style={[styles.sectionPrimaryButton, savingSection === 'interests' && styles.saveBtnDisabled]}
                                        onPress={handleSaveInterests}
                                        disabled={savingSection === 'interests'}
                                    >
                                        {savingSection === 'interests'
                                            ? <ActivityIndicator size="small" color={Colors.textOn.primary} />
                                            : <Text style={styles.sectionPrimaryButtonText}>Save</Text>}
                                    </TouchableOpacity>
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

                    <Text style={styles.sectionLabel}>SOBRIETY</Text>
                    <View style={styles.fieldGroup}>
                        {formattedSobrietyDate && recoveryMilestone && (
                            <>
                                <View style={styles.sobrietySummary}>
                                    <View style={styles.sobrietySummaryHeader}>
                                        <Text style={styles.sobrietySummaryTitle}>Sober since {formattedSobrietyDate}</Text>
                                        <View style={styles.milestoneBadge}>
                                            <Text style={styles.milestoneBadgeText}>{recoveryMilestone.currentLabel}</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.sobrietySummaryValue}>
                                        {formatRecoveryDuration(recoveryMilestone.daysSober)}
                                    </Text>
                                    <Text style={styles.sobrietySummaryHint}>
                                        {recoveryMilestone.nextLabel && recoveryMilestone.daysToNext
                                            ? `${recoveryMilestone.daysToNext} days to ${recoveryMilestone.nextLabel}`
                                            : 'Longest milestone badge unlocked'}
                                    </Text>
                                </View>
                                <View style={styles.fieldDivider} />
                            </>
                        )}
                        <View style={styles.sectionCardHeader}>
                            <Text style={styles.sectionCardTitle}>Sober since</Text>
                            {editingSection === 'sobriety' ? null : (
                                <TouchableOpacity onPress={() => handleStartEditSection('sobriety')}>
                                    <Text style={styles.sectionActionText}>Edit</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Date</Text>
                            <TouchableOpacity
                                style={styles.dateFieldButton}
                                onPress={() => {
                                    if (editingSection === 'sobriety') setShowSoberSincePicker(true);
                                }}
                                disabled={editingSection !== 'sobriety'}
                            >
                                <Text style={[styles.dateFieldText, !soberSince && styles.dateFieldPlaceholder]}>
                                    {sobrietyFieldValue}
                                </Text>
                            </TouchableOpacity>
                        </View>
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
                                    <TouchableOpacity
                                        style={[styles.sectionPrimaryButton, savingSection === 'sobriety' && styles.saveBtnDisabled]}
                                        onPress={handleSaveSobriety}
                                        disabled={savingSection === 'sobriety'}
                                    >
                                        {savingSection === 'sobriety'
                                            ? <ActivityIndicator size="small" color={Colors.textOn.primary} />
                                            : <Text style={styles.sectionPrimaryButtonText}>Save</Text>}
                                    </TouchableOpacity>
                                </View>
                            </>
                        ) : null}
                    </View>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.light.background },
    scroll: { flex: 1 },

    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: Colors.light.border,
    },
    topBarSide: { width: 40 },
    topBarTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: '500',
        color: Colors.light.textPrimary,
    },
    settingsBtn: { padding: 4, width: 40, alignItems: 'flex-end' },
    settingsIcon: { fontSize: 20, color: Colors.light.textTertiary },

    subHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: Colors.light.border,
    },
    subHeaderSide: { width: 40 },
    subHeaderTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: '500',
        color: Colors.light.textPrimary,
    },
    backIcon: { fontSize: 20, color: Colors.primary },

    listContent: { paddingVertical: Spacing.sm },
    listEmpty: {
        fontSize: Typography.sizes.base,
        color: Colors.light.textTertiary,
        textAlign: 'center',
        marginTop: 60,
    },
    listEmptyInline: {
        fontSize: Typography.sizes.base,
        color: Colors.light.textTertiary,
        textAlign: 'center',
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.md,
    },
    footerLoader: { paddingVertical: Spacing.md },
    requestTabs: {
        flexDirection: 'row',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.md,
    },
    requestTab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: Radii.full,
        borderWidth: 1,
        borderColor: Colors.light.border,
        backgroundColor: Colors.light.backgroundSecondary,
    },
    requestTabActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    requestTabText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.light.textSecondary,
    },
    requestTabTextActive: {
        color: Colors.textOn.primary,
    },

    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        gap: Spacing.md,
    },
    rowInfo: { flex: 1, gap: 2 },
    rowName: { fontSize: Typography.sizes.base, fontWeight: '500', color: Colors.light.textPrimary },
    rowCity: { fontSize: Typography.sizes.sm, color: Colors.light.textTertiary },
    unfollowBtn: {
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderRadius: Radii.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
    },
    unfollowBtnText: { fontSize: Typography.sizes.sm, fontWeight: '500', color: Colors.light.textSecondary },
    requestActionPrimary: {
        backgroundColor: Colors.primary,
        borderRadius: Radii.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
    },
    requestActionPrimaryText: { fontSize: Typography.sizes.sm, fontWeight: '600', color: Colors.textOn.primary },
    requestActionSecondary: {
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderRadius: Radii.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
    },
    requestActionSecondaryText: { fontSize: Typography.sizes.sm, fontWeight: '500', color: Colors.light.textSecondary },

    content: { flexGrow: 1, padding: Spacing.md, paddingBottom: Spacing.md },
    mainContent: { gap: 0 },

    avatarSection: { alignItems: 'center', paddingVertical: Spacing.md, marginBottom: Spacing.sm, gap: 4 },
    avatarWrap: { position: 'relative' },
    avatarEditBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: Colors.light.background,
    },
    avatarEditIcon: { fontSize: 12, color: Colors.light.textPrimary },
    avatarName: { fontSize: Typography.sizes.lg, fontWeight: '600', color: Colors.light.textPrimary, marginTop: Spacing.sm },
    avatarSub: { fontSize: Typography.sizes.sm, color: Colors.light.textTertiary },

    statsRow: {
        flexDirection: 'row',
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.md,
        marginBottom: Spacing.md,
        overflow: 'hidden',
    },
    statItem: { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 2 },
    statCount: { fontSize: Typography.sizes.lg, fontWeight: '700', color: Colors.light.textPrimary },
    statLabel: { fontSize: Typography.sizes.xs, color: Colors.light.textTertiary, letterSpacing: 0.4 },
    statDivider: { width: 0.5, backgroundColor: Colors.light.border, marginVertical: 12 },

    sectionLabel: {
        fontSize: Typography.sizes.xs,
        fontWeight: '500',
        color: Colors.light.textTertiary,
        letterSpacing: 0.7,
        marginBottom: Spacing.sm,
        marginTop: Spacing.md,
    },
    fieldGroup: { backgroundColor: Colors.light.backgroundSecondary, borderRadius: Radii.md, overflow: 'hidden' },
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
        color: Colors.light.textPrimary,
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
        color: Colors.light.textPrimary,
    },
    sectionValuePlaceholder: {
        color: Colors.light.textTertiary,
    },
    fieldRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 13, gap: Spacing.sm },
    fieldDivider: { height: 0.5, backgroundColor: Colors.light.border, marginLeft: Spacing.md },
    fieldLabel: { width: 90, fontSize: Typography.sizes.sm, color: Colors.light.textTertiary },
    fieldInput: { flex: 1, fontSize: Typography.sizes.base, color: Colors.light.textPrimary, textAlign: 'right', padding: 0 },
    dateFieldButton: {
        flex: 1,
        alignItems: 'flex-end',
    },
    dateFieldText: {
        fontSize: Typography.sizes.base,
        color: Colors.light.textPrimary,
        textAlign: 'right',
    },
    dateFieldPlaceholder: {
        color: Colors.light.textTertiary,
    },
    inlineDatePickerWrap: {
        borderTopWidth: 0.5,
        borderTopColor: Colors.light.border,
        paddingHorizontal: Spacing.sm,
        paddingBottom: Spacing.sm,
    },
    bioCounter: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
    },
    bioCounterOver: {
        color: Colors.danger,
    },
    bioInput: {
        minHeight: 96,
        marginHorizontal: Spacing.md,
        marginBottom: Spacing.md,
        borderRadius: Radii.md,
        borderWidth: 1,
        borderColor: Colors.light.border,
        backgroundColor: Colors.light.background,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        fontSize: Typography.sizes.base,
        lineHeight: 20,
        color: Colors.light.textPrimary,
    },
    interestsCount: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
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
        borderRadius: Radii.full,
        borderWidth: 1,
        borderColor: Colors.light.border,
        backgroundColor: Colors.light.background,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
    },
    interestChipActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    interestChipText: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textSecondary,
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
        borderColor: Colors.light.border,
        borderRadius: Radii.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        backgroundColor: Colors.light.background,
    },
    sectionSecondaryButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.light.textSecondary,
    },
    sectionPrimaryButton: {
        borderRadius: Radii.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        backgroundColor: Colors.primary,
        minWidth: 82,
        alignItems: 'center',
    },
    sectionPrimaryButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.textOn.primary,
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
        color: Colors.light.textPrimary,
    },
    sobrietySummaryValue: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.light.textSecondary,
    },
    sobrietySummaryHint: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
    },
    milestoneBadge: {
        backgroundColor: Colors.primary,
        borderRadius: Radii.full,
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
