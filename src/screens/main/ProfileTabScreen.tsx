import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, ScrollView, FlatList, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Avatar } from '../../components/Avatar';
import { SettingsScreen } from './SettingsScreen';
import * as api from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';
import { formatUsername } from '../../utils/identity';

type SubView = 'profile' | 'friends' | 'requests' | 'settings';

interface ProfileTabScreenProps {
    isActive: boolean;
    onFriendshipChange: (userId: string, status: 'none' | 'incoming' | 'outgoing' | 'friends') => void;
    refreshFriendshipState: () => Promise<void>;
    onOpenUserProfile: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
    onBack?: () => void;
}

// Renders the current user's profile tab plus friends, requests, and settings subviews.
export function ProfileTabScreen({ isActive, onFriendshipChange, refreshFriendshipState, onOpenUserProfile, onBack }: ProfileTabScreenProps) {
    const { user, refreshUser, logout } = useAuth();
    const [subView, setSubView] = useState<SubView>('profile');

    const [username, setUsername]     = useState(user?.username ?? '');
    const [city, setCity]             = useState(user?.city ?? '');
    const [country, setCountry]       = useState(user?.country ?? '');
    const [soberSince, setSoberSince] = useState(user?.sober_since ?? '');
    const [saving, setSaving]           = useState(false);
    const [dirty, setDirty]             = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [localAvatarUrl, setLocalAvatarUrl]   = useState(user?.avatar_url);

    const [friends, setFriends] = useState<api.FriendUser[]>([]);
    const [incomingRequests, setIncomingRequests] = useState<api.FriendUser[]>([]);
    const [outgoingRequests, setOutgoingRequests] = useState<api.FriendUser[]>([]);
    const [pendingActionIds, setPendingActionIds] = useState<Set<string>>(new Set());

    // Loads the accepted friends for the current account.
    const loadFriends = useCallback(async () => {
        try {
            const nextFriends = await api.getFriends();
            setFriends(nextFriends ?? []);
        } catch {}
    }, []);

    // Loads both incoming and outgoing pending friend requests.
    const loadRequests = useCallback(async () => {
        try {
            const [incoming, outgoing] = await Promise.all([
                api.getIncomingFriendRequests(),
                api.getOutgoingFriendRequests(),
            ]);
            setIncomingRequests(incoming ?? []);
            setOutgoingRequests(outgoing ?? []);
        } catch {}
    }, []);

    // Reloads the friend summary that feeds the profile stats.
    const loadFriendSummary = useCallback(async () => {
        await Promise.all([loadFriends(), loadRequests()]);
    }, [loadFriends, loadRequests]);

    useEffect(() => {
        if (isActive) {
            loadFriendSummary();
        }
    }, [isActive, loadFriendSummary]);

    // Marks the profile form as dirty when a field changes.
    const mark = (setter: (v: string) => void) => (v: string) => {
        setter(v);
        // Track whether profile fields diverged from the last saved snapshot so the
        // save CTA only appears when there is something to persist.
        setDirty(true);
    };

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

    // Persists the editable profile fields back to the API.
    const handleSave = async () => {
        setSaving(true);
        try {
            await api.updateMe({
                username: username.trim(),
                city: city.trim() || undefined,
                country: country.trim() || undefined,
                sober_since: soberSince.trim() || undefined,
            });
            await refreshUser();
            setDirty(false);
        } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setSaving(false);
        }
    };

    // Optimistically removes an accepted friend.
    const handleRemoveFriend = async (u: api.FriendUser) => {
        setPendingActionIds(prev => new Set(prev).add(u.user_id));
        setFriends(prev => prev.filter(f => f.user_id !== u.user_id));
        onFriendshipChange(u.user_id, 'none');
        try {
            await api.removeFriend(u.user_id);
            await loadFriends();
        } catch (e: unknown) {
            setFriends(prev => [u, ...prev]);
            onFriendshipChange(u.user_id, 'friends');
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setPendingActionIds(prev => { const s = new Set(prev); s.delete(u.user_id); return s; });
        }
    };

    const handleAcceptRequest = async (u: api.FriendUser) => {
        setPendingActionIds(prev => new Set(prev).add(u.user_id));
        setIncomingRequests(prev => prev.filter(req => req.user_id !== u.user_id));
        setFriends(prev => [u, ...prev]);
        onFriendshipChange(u.user_id, 'friends');
        try {
            await api.updateFriendRequest(u.user_id, 'accept');
            await Promise.all([loadFriends(), loadRequests(), refreshFriendshipState()]);
        } catch (e: unknown) {
            setIncomingRequests(prev => [u, ...prev]);
            setFriends(prev => prev.filter(friend => friend.user_id !== u.user_id));
            onFriendshipChange(u.user_id, 'incoming');
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setPendingActionIds(prev => { const s = new Set(prev); s.delete(u.user_id); return s; });
        }
    };

    const handleDeclineRequest = async (u: api.FriendUser) => {
        setPendingActionIds(prev => new Set(prev).add(u.user_id));
        setIncomingRequests(prev => prev.filter(req => req.user_id !== u.user_id));
        onFriendshipChange(u.user_id, 'none');
        try {
            await api.updateFriendRequest(u.user_id, 'decline');
            await Promise.all([loadRequests(), refreshFriendshipState()]);
        } catch (e: unknown) {
            setIncomingRequests(prev => [u, ...prev]);
            onFriendshipChange(u.user_id, 'incoming');
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setPendingActionIds(prev => { const s = new Set(prev); s.delete(u.user_id); return s; });
        }
    };

    const handleCancelRequest = async (u: api.FriendUser) => {
        setPendingActionIds(prev => new Set(prev).add(u.user_id));
        setOutgoingRequests(prev => prev.filter(req => req.user_id !== u.user_id));
        onFriendshipChange(u.user_id, 'none');
        try {
            await api.cancelFriendRequest(u.user_id);
            await Promise.all([loadRequests(), refreshFriendshipState()]);
        } catch (e: unknown) {
            setOutgoingRequests(prev => [u, ...prev]);
            onFriendshipChange(u.user_id, 'outgoing');
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setPendingActionIds(prev => { const s = new Set(prev); s.delete(u.user_id); return s; });
        }
    };

    // Signs the current user out from the profile area.
    const handleLogout = async () => {
        try { await logout(); } catch {}
    };

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
                <ScrollView contentContainerStyle={styles.listContent}>
                    <Text style={styles.requestSectionTitle}>Incoming</Text>
                    {incomingRequests.length > 0 ? incomingRequests.map(item => (
                        <View key={`incoming-${item.user_id}`} style={styles.row}>
                            <TouchableOpacity onPress={() => onOpenUserProfile({ userId: item.user_id, username: item.username, avatarUrl: item.avatar_url })}>
                                <Avatar username={item.username} avatarUrl={item.avatar_url} size={48} fontSize={16} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.rowInfo} onPress={() => onOpenUserProfile({ userId: item.user_id, username: item.username, avatarUrl: item.avatar_url })}>
                                <Text style={styles.rowName}>{formatUsername(item.username)}</Text>
                                {item.city && <Text style={styles.rowCity}>{item.city}</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.requestActionPrimary} onPress={() => handleAcceptRequest(item)} disabled={pendingActionIds.has(item.user_id)}>
                                <Text style={styles.requestActionPrimaryText}>Accept</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.requestActionSecondary} onPress={() => handleDeclineRequest(item)} disabled={pendingActionIds.has(item.user_id)}>
                                <Text style={styles.requestActionSecondaryText}>Decline</Text>
                            </TouchableOpacity>
                        </View>
                    )) : (
                        <Text style={styles.listEmpty}>No incoming requests.</Text>
                    )}

                    <Text style={styles.requestSectionTitle}>Sent</Text>
                    {outgoingRequests.length > 0 ? outgoingRequests.map(item => (
                        <View key={`outgoing-${item.user_id}`} style={styles.row}>
                            <TouchableOpacity onPress={() => onOpenUserProfile({ userId: item.user_id, username: item.username, avatarUrl: item.avatar_url })}>
                                <Avatar username={item.username} avatarUrl={item.avatar_url} size={48} fontSize={16} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.rowInfo} onPress={() => onOpenUserProfile({ userId: item.user_id, username: item.username, avatarUrl: item.avatar_url })}>
                                <Text style={styles.rowName}>{formatUsername(item.username)}</Text>
                                {item.city && <Text style={styles.rowCity}>{item.city}</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.requestActionSecondary} onPress={() => handleCancelRequest(item)} disabled={pendingActionIds.has(item.user_id)}>
                                <Text style={styles.requestActionSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    )) : (
                        <Text style={styles.listEmpty}>No outgoing requests.</Text>
                    )}
                </ScrollView>
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
                                username={username || user.username}
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
                        <Text style={styles.avatarName}>{formatUsername(username || user.username)}</Text>
                        {city ? <Text style={styles.avatarSub}>{city}{country ? `, ${country}` : ''}</Text> : null}
                    </View>

                    <View style={styles.statsRow}>
                        <TouchableOpacity style={styles.statItem} onPress={() => setSubView('friends')}>
                            <Text style={styles.statCount}>{friends.length}</Text>
                            <Text style={styles.statLabel}>Friends</Text>
                        </TouchableOpacity>
                        <View style={styles.statDivider} />
                        <TouchableOpacity style={styles.statItem} onPress={() => setSubView('requests')}>
                            <Text style={styles.statCount}>{incomingRequests.length + outgoingRequests.length}</Text>
                            <Text style={styles.statLabel}>Requests</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.sectionLabel}>USERNAME</Text>
                    <View style={styles.fieldGroup}>
                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Username</Text>
                            <TextInput style={styles.fieldInput} value={username} onChangeText={mark(setUsername)} placeholder="username" placeholderTextColor={Colors.light.textTertiary} autoCapitalize="none" autoCorrect={false} />
                        </View>
                    </View>

                    <Text style={styles.sectionLabel}>LOCATION</Text>
                    <View style={styles.fieldGroup}>
                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>City</Text>
                            <TextInput style={styles.fieldInput} value={city} onChangeText={mark(setCity)} placeholder="City" placeholderTextColor={Colors.light.textTertiary} />
                        </View>
                        <View style={styles.fieldDivider} />
                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Country</Text>
                            <TextInput style={styles.fieldInput} value={country} onChangeText={mark(setCountry)} placeholder="Country" placeholderTextColor={Colors.light.textTertiary} />
                        </View>
                    </View>

                    <Text style={styles.sectionLabel}>SOBRIETY</Text>
                    <View style={styles.fieldGroup}>
                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Sober since</Text>
                            <TextInput style={styles.fieldInput} value={soberSince} onChangeText={mark(setSoberSince)} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.light.textTertiary} />
                        </View>
                    </View>

                    {dirty && (
                        <TouchableOpacity
                            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving
                                ? <ActivityIndicator size="small" color={Colors.textOn.primary} />
                                : <Text style={styles.saveBtnText}>Save changes</Text>
                            }
                        </TouchableOpacity>
                    )}
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
    requestSectionTitle: {
        fontSize: Typography.sizes.xs,
        fontWeight: '600',
        color: Colors.light.textTertiary,
        letterSpacing: 0.5,
        marginTop: Spacing.md,
        marginBottom: Spacing.sm,
        paddingHorizontal: Spacing.md,
    },
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
    fieldRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 13, gap: Spacing.sm },
    fieldDivider: { height: 0.5, backgroundColor: Colors.light.border, marginLeft: Spacing.md },
    fieldLabel: { width: 90, fontSize: Typography.sizes.sm, color: Colors.light.textTertiary },
    fieldInput: { flex: 1, fontSize: Typography.sizes.base, color: Colors.light.textPrimary, textAlign: 'right', padding: 0 },

    saveBtn: {
        backgroundColor: Colors.primary,
        borderRadius: Radii.md,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: Spacing.lg,
    },
    saveBtnText: { fontSize: Typography.sizes.base, fontWeight: '600', color: Colors.textOn.primary },
});
