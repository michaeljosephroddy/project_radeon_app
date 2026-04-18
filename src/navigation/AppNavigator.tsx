import React, { useCallback, useRef, useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FeedScreen } from '../screens/main/FeedScreen';
import { DiscoverScreen } from '../screens/main/DiscoverScreen';
import { SupportScreen } from '../screens/main/SupportScreen';
import { MeetupsScreen } from '../screens/main/MeetupsScreen';
import { ChatsScreen } from '../screens/main/ChatsScreen';
import { ProfileTabScreen } from '../screens/main/ProfileTabScreen';
import { ChatScreen } from '../screens/main/ChatScreen';
import { UserProfileScreen } from '../screens/main/UserProfileScreen';
import { Avatar } from '../components/Avatar';
import { Colors, Typography, Spacing } from '../utils/theme';
import { useAuth } from '../hooks/useAuth';
import * as api from '../api/client';
import type { Chat } from '../api/client';

interface OpenUserProfile {
    userId: string;
    username: string;
    avatarUrl?: string;
}

type Tab = 'community' | 'discover' | 'support' | 'meetups' | 'chats';

const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'community', label: 'community', icon: 'newspaper-outline', iconActive: 'newspaper' },
    { key: 'discover',  label: 'discover',  icon: 'grid-outline', iconActive: 'grid' },
    { key: 'support',   label: 'support',   icon: 'heart-outline', iconActive: 'heart' },
    { key: 'meetups',   label: 'meetups',   icon: 'calendar-outline', iconActive: 'calendar' },
    { key: 'chats',     label: 'chats',     icon: 'chatbubble-outline', iconActive: 'chatbubble' },
];

export function AppNavigator() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('community');
    const [openChat, setOpenChat] = useState<Chat | null>(null);
    const [openUserProfile, setOpenUserProfile] = useState<OpenUserProfile | null>(null);
    const [ownProfileOpen, setOwnProfileOpen] = useState(false);
    const [chatsRefreshKey, setChatsRefreshKey] = useState(0);
    const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
    const followingRequestIdRef = useRef(0);
    const insets = useSafeAreaInsets();

    const inChat = openChat !== null;
    const inUserProfile = openUserProfile !== null;
    const inOwnProfile = ownProfileOpen;

    const handleFollowChange = (userId: string, following: boolean) => {
        setFollowingIds(prev => {
            const next = new Set(prev);
            if (following) next.add(userId); else next.delete(userId);
            return next;
        });
    };

    const refreshFollowingIds = useCallback(async () => {
        const requestId = ++followingRequestIdRef.current;
        const following = await api.getFollowing();
        if (requestId !== followingRequestIdRef.current) return;
        setFollowingIds(new Set((following ?? []).map(user => user.user_id)));
    }, []);

    const handleOpenUserProfile = (profile: OpenUserProfile) => {
        setOpenUserProfile(profile);
        setOwnProfileOpen(false);
        setOpenChat(null);
    };

    const handleCloseChat = () => {
        setOpenChat(null);
        setChatsRefreshKey(current => current + 1);
    };

    const closeUserProfile = () => {
        setOpenUserProfile(null);
    };

    const openOwnProfile = () => {
        setOwnProfileOpen(true);
        setOpenUserProfile(null);
        setOpenChat(null);
    };

    const closeOwnProfile = () => {
        setOwnProfileOpen(false);
    };

    const renderHeader = () => {
        if (inChat) return null;
        if (inUserProfile) return null;
        if (inOwnProfile) return null;

        const titles: Record<Tab, React.ReactNode> = {
            community: (
                <Text style={styles.wordmark}>
                    Sober<Text style={styles.wordmarkAccent}>Space</Text>
                </Text>
            ),
            discover: <Text style={styles.pageTitle}>Discover</Text>,
            support: <Text style={styles.pageTitle}>Support</Text>,
            meetups: <Text style={styles.pageTitle}>Meetups</Text>,
            chats: <Text style={styles.pageTitle}>Chats</Text>,
        };

        return (
            <View style={styles.topBar}>
                {titles[activeTab]}
                <TouchableOpacity onPress={openOwnProfile} disabled={!user}>
                    <Avatar
                        username={user?.username ?? 'me'}
                        avatarUrl={user?.avatar_url}
                        size={34}
                        fontSize={12}
                    />
                </TouchableOpacity>
            </View>
        );
    };

    const renderContent = () => {
        return (
            <>
                <View style={activeTab === 'community' ? styles.tabVisible : styles.tabHidden}>
                    <FeedScreen
                        isActive={activeTab === 'community'}
                        followingIds={followingIds}
                        onFollowChange={handleFollowChange}
                        onOpenUserProfile={handleOpenUserProfile}
                    />
                </View>
                <View style={activeTab === 'discover' ? styles.tabVisible : styles.tabHidden}>
                    <DiscoverScreen
                        isActive={activeTab === 'discover'}
                        followingIds={followingIds}
                        onFollowChange={handleFollowChange}
                        onOpenUserProfile={handleOpenUserProfile}
                        refreshFollowingIds={refreshFollowingIds}
                    />
                </View>
                <View style={activeTab === 'support' ? styles.tabVisible : styles.tabHidden}>
                    <SupportScreen
                        isActive={activeTab === 'support'}
                        onOpenChat={setOpenChat}
                        onOpenUserProfile={handleOpenUserProfile}
                    />
                </View>
                <View style={activeTab === 'meetups' ? styles.tabVisible : styles.tabHidden}>
                    <MeetupsScreen isActive={activeTab === 'meetups'} />
                </View>
                <View style={activeTab === 'chats' ? styles.tabVisible : styles.tabHidden}>
                    <ChatsScreen
                        isActive={activeTab === 'chats'}
                        refreshKey={chatsRefreshKey}
                        onOpenChat={setOpenChat}
                    />
                </View>
                {inOwnProfile && (
                    <View style={StyleSheet.absoluteFill}>
                        <ProfileTabScreen
                            isActive={inOwnProfile}
                            onBack={closeOwnProfile}
                            onFollowChange={handleFollowChange}
                            refreshFollowingIds={refreshFollowingIds}
                            onOpenUserProfile={handleOpenUserProfile}
                        />
                    </View>
                )}
                {inUserProfile && (
                    <View style={StyleSheet.absoluteFill}>
                        <UserProfileScreen
                            userId={openUserProfile!.userId}
                            username={openUserProfile!.username}
                            avatarUrl={openUserProfile!.avatarUrl}
                            followingIds={followingIds}
                            onBack={closeUserProfile}
                            onFollowChange={handleFollowChange}
                            refreshFollowingIds={refreshFollowingIds}
                            onOpenChat={setOpenChat}
                        />
                    </View>
                )}
                {inChat && (
                    <View style={StyleSheet.absoluteFill}>
                        <ChatScreen
                            chat={openChat!}
                            onBack={handleCloseChat}
                        />
                    </View>
                )}
            </>
        );
    };

    return (
        <>
            <StatusBar style="light" />
            <SafeAreaView style={styles.container} edges={['top']}>
                {renderHeader()}
                <View style={styles.content}>{renderContent()}</View>

                {!inChat && !inUserProfile && !inOwnProfile && (
                    <View style={[styles.tabBar, { paddingBottom: insets.bottom + 6 }]}>
                        {TABS.map(tab => (
                            <TouchableOpacity
                                key={tab.key}
                                style={styles.tabItem}
                                onPress={() => {
                                    setActiveTab(tab.key);
                                    setOpenChat(null);
                                }}
                            >
                                <Ionicons
                                    name={activeTab === tab.key ? tab.iconActive : tab.icon}
                                    size={22}
                                    color={activeTab === tab.key ? Colors.primary : Colors.light.textTertiary}
                                />
                                <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </SafeAreaView>
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.light.background },
    content: { flex: 1 },
    tabVisible: { flex: 1, display: 'flex' },
    tabHidden: { flex: 1, display: 'none' },

    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: 12,
    },
    wordmark: {
        fontSize: Typography.sizes.xl,
        fontWeight: '500',
        color: Colors.light.textPrimary,
    },
    wordmarkAccent: { color: Colors.primary },
    pageTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: '500',
        color: Colors.light.textPrimary,
    },

    tabBar: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: Colors.light.borderSecondary,
        paddingTop: 8,
        backgroundColor: Colors.light.background,
    },
    tabItem: { flex: 1, alignItems: 'center', gap: 4 },
    tabLabel: { fontSize: Typography.sizes.sm, color: Colors.light.textTertiary },
    tabLabelActive: { color: Colors.primary },
});
