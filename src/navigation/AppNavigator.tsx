import React, { useCallback, useRef, useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FeedScreen } from '../screens/main/FeedScreen';
import { DiscoverScreen } from '../screens/main/DiscoverScreen';
import { MeetupsScreen } from '../screens/main/MeetupsScreen';
import { ChatsScreen } from '../screens/main/ChatsScreen';
import { ProfileTabScreen } from '../screens/main/ProfileTabScreen';
import { ChatScreen } from '../screens/main/ChatScreen';
import { UserProfileScreen } from '../screens/main/UserProfileScreen';
import { Colors, Typography, Spacing } from '../utils/theme';
import * as api from '../api/client';
import type { Chat } from '../api/client';

interface OpenUserProfile {
    userId: string;
    username: string;
    avatarUrl?: string;
}

type Tab = 'community' | 'discover' | 'meetups' | 'chats' | 'profile';

const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'community', label: 'community', icon: 'newspaper-outline', iconActive: 'newspaper' },
    { key: 'discover',  label: 'discover',  icon: 'grid-outline', iconActive: 'grid' },
    { key: 'meetups',   label: 'meetups',   icon: 'calendar-outline', iconActive: 'calendar' },
    { key: 'chats',     label: 'chats',     icon: 'chatbubble-outline', iconActive: 'chatbubble' },
    { key: 'profile',   label: 'profile',   icon: 'person-circle-outline', iconActive: 'person-circle' },
];

// Coordinates tab state plus lightweight overlays for profiles and chats.
export function AppNavigator() {
    const [activeTab, setActiveTab] = useState<Tab>('community');
    const [openChat, setOpenChat] = useState<Chat | null>(null);
    const [openUserProfile, setOpenUserProfile] = useState<OpenUserProfile | null>(null);
    const [chatsRefreshKey, setChatsRefreshKey] = useState(0);
    const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
    const followingRequestIdRef = useRef(0);
    const insets = useSafeAreaInsets();

    const inChat = openChat !== null;
    const inUserProfile = openUserProfile !== null;

    // Applies optimistic follow state updates shared across multiple tabs.
    const handleFollowChange = (userId: string, following: boolean) => {
        setFollowingIds(prev => {
            const next = new Set(prev);
            if (following) next.add(userId); else next.delete(userId);
            return next;
        });
    };

    // Reloads the current following ids and ignores stale request results.
    const refreshFollowingIds = useCallback(async () => {
        const requestId = ++followingRequestIdRef.current;
        const following = await api.getFollowing();
        // Ignore stale responses if a newer refresh started while this request was in flight.
        if (requestId !== followingRequestIdRef.current) return;
        setFollowingIds(new Set((following ?? []).map(user => user.user_id)));
    }, []);

    // Opens a user profile overlay and closes any open chat overlay.
    const handleOpenUserProfile = (profile: OpenUserProfile) => {
        setOpenUserProfile(profile);
        setOpenChat(null);
    };

    // Closes the chat overlay and bumps the chat refresh key for the list tab.
    const handleCloseChat = () => {
        setOpenChat(null);
        setChatsRefreshKey(current => current + 1);
    };

    // Dismisses the currently open user profile overlay.
    const closeUserProfile = () => {
        setOpenUserProfile(null);
    };

    // Renders the contextual top bar for the active top-level tab.
    const renderHeader = () => {
        if (inChat) return null;
        if (inUserProfile) return null;
        if (activeTab === 'profile') return null;

        const titles: Record<Tab, React.ReactNode> = {
            community: (
                <Text style={styles.wordmark}>
                    Sober<Text style={styles.wordmarkAccent}>Space</Text>
                </Text>
            ),
            discover: <Text style={styles.pageTitle}>Discover</Text>,
            meetups:  <Text style={styles.pageTitle}>Meetups</Text>,
            chats: <Text style={styles.pageTitle}>Chats</Text>,
            profile:  null,
        };

        return (
            <View style={styles.topBar}>
                {titles[activeTab]}
                <View />
            </View>
        );
    };

    // Renders tab content and any active overlays without unmounting inactive tabs.
    const renderContent = () => {
        return (
            <>
                {/* Keep each tab mounted and toggle visibility so local screen state
                    survives tab switches without adding a full navigation library. */}
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
                <View style={activeTab === 'profile' ? styles.tabVisible : styles.tabHidden}>
                    <ProfileTabScreen
                        isActive={activeTab === 'profile'}
                        onFollowChange={handleFollowChange}
                        refreshFollowingIds={refreshFollowingIds}
                        onOpenUserProfile={handleOpenUserProfile}
                    />
                </View>
                {inUserProfile && (
                    // Detail screens render above the tab content as lightweight overlays.
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

                {!inChat && !inUserProfile && (
                    <View style={[styles.tabBar, { paddingBottom: insets.bottom + 6 }]}>
                        {TABS.map(tab => (
                            <TouchableOpacity
                                key={tab.key}
                                style={styles.tabItem}
                            onPress={() => {
                                setActiveTab(tab.key);
                                // Closing the open chat avoids leaving a stale conversation
                                // overlay visible when the user switches sections.
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
