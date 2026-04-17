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

type SubView = 'profile' | 'following' | 'followers' | 'settings';

interface ProfileTabScreenProps {
    isActive: boolean;
    onFollowChange: (userId: string, following: boolean) => void;
    refreshFollowingIds: () => Promise<void>;
    onOpenUserProfile: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
}

export function ProfileTabScreen({ isActive, onFollowChange, refreshFollowingIds, onOpenUserProfile }: ProfileTabScreenProps) {
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

    const [following, setFollowing] = useState<api.FollowUser[]>([]);
    const [followers, setFollowers] = useState<api.FollowUser[]>([]);
    const [unfollowing, setUnfollowing] = useState<Set<string>>(new Set());

    const loadFollowing = useCallback(async () => {
        try {
            const following = await api.getFollowing();
            setFollowing(following ?? []);
        } catch {}
    }, []);

    const loadFollowers = useCallback(async () => {
        try {
            const followers = await api.getFollowers();
            setFollowers(followers ?? []);
        } catch {}
    }, []);

    const loadFollowSummary = useCallback(async () => {
        await Promise.all([loadFollowing(), loadFollowers()]);
    }, [loadFollowing, loadFollowers]);

    useEffect(() => {
        if (isActive) {
            loadFollowSummary();
        }
    }, [isActive, loadFollowSummary]);

    const mark = (setter: (v: string) => void) => (v: string) => {
        setter(v);
        setDirty(true);
    };

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
            setLocalAvatarUrl(`${avatar_url}?t=${Date.now()}`);
            refreshUser().catch(() => {});
        } catch (e: unknown) {
            Alert.alert('Upload failed', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setUploadingAvatar(false);
        }
    };

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

    const handleUnfollow = async (u: api.FollowUser) => {
        setUnfollowing(prev => new Set(prev).add(u.user_id));
        setFollowing(prev => prev.filter(f => f.user_id !== u.user_id));
        onFollowChange(u.user_id, false);
        try {
            await api.unfollowUser(u.user_id);
            await loadFollowing();
        } catch (e: unknown) {
            setFollowing(prev => [u, ...prev]);
            onFollowChange(u.user_id, true);
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setUnfollowing(prev => { const s = new Set(prev); s.delete(u.user_id); return s; });
        }
    };

    const handleLogout = async () => {
        try { await logout(); } catch {}
    };

    if (!user) return null;

    if (subView === 'settings') {
        return <SettingsScreen onBack={() => setSubView('profile')} onLogout={handleLogout} />;
    }

    if (subView === 'following') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.subHeader}>
                    <TouchableOpacity onPress={() => setSubView('profile')} style={styles.subHeaderSide}>
                        <Text style={styles.backIcon}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.subHeaderTitle}>Following</Text>
                    <View style={styles.subHeaderSide} />
                </View>
                <FlatList
                    data={following}
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
                                onPress={() => handleUnfollow(item)}
                                disabled={unfollowing.has(item.user_id)}
                            >
                                <Text style={styles.unfollowBtnText}>Unfollow</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    ListEmptyComponent={
                        <Text style={styles.listEmpty}>Not following anyone yet.</Text>
                    }
                />
            </SafeAreaView>
        );
    }

    if (subView === 'followers') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.subHeader}>
                    <TouchableOpacity onPress={() => setSubView('profile')} style={styles.subHeaderSide}>
                        <Text style={styles.backIcon}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.subHeaderTitle}>Followers</Text>
                    <View style={styles.subHeaderSide} />
                </View>
                <FlatList
                    data={followers}
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
                        </View>
                    )}
                    ListEmptyComponent={
                        <Text style={styles.listEmpty}>No followers yet.</Text>
                    }
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.topBar}>
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
                        <TouchableOpacity style={styles.statItem} onPress={() => setSubView('following')}>
                            <Text style={styles.statCount}>{following.length}</Text>
                            <Text style={styles.statLabel}>Following</Text>
                        </TouchableOpacity>
                        <View style={styles.statDivider} />
                        <TouchableOpacity style={styles.statItem} onPress={() => setSubView('followers')}>
                            <Text style={styles.statCount}>{followers.length}</Text>
                            <Text style={styles.statLabel}>Followers</Text>
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
    topBarTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: '500',
        color: Colors.light.textPrimary,
    },
    settingsBtn: { padding: 4 },
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
    unfollowBtn: {
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderRadius: Radii.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
    },
    unfollowBtnText: { fontSize: Typography.sizes.sm, fontWeight: '500', color: Colors.light.textSecondary },

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
