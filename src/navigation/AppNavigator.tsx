import React, { useCallback, useRef, useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FeedScreen } from '../screens/main/FeedScreen';
import { DiscoverScreen } from '../screens/main/DiscoverScreen';
import { EventsScreen } from '../screens/main/EventsScreen';
import { MessagesScreen } from '../screens/main/MessagesScreen';
import { ProfileTabScreen } from '../screens/main/ProfileTabScreen';
import { ChatScreen } from '../screens/main/ChatScreen';
import { UserProfileScreen } from '../screens/main/UserProfileScreen';
import { Colors, Typography, Spacing } from '../utils/theme';
import * as api from '../api/client';
import type { Conversation } from '../api/client';

interface OpenUserProfile {
    userId: string;
    username: string;
    avatarUrl?: string;
}

type Tab = 'community' | 'discover' | 'events' | 'messages' | 'profile';

const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'community', label: 'community', icon: 'newspaper-outline', iconActive: 'newspaper' },
    { key: 'discover',  label: 'discover',  icon: 'grid-outline', iconActive: 'grid' },
    { key: 'events',    label: 'events',    icon: 'calendar-outline', iconActive: 'calendar' },
    { key: 'messages',  label: 'messages',  icon: 'chatbubble-outline', iconActive: 'chatbubble' },
    { key: 'profile',   label: 'profile',   icon: 'person-circle-outline', iconActive: 'person-circle' },
];

export function AppNavigator() {
    const [activeTab, setActiveTab] = useState<Tab>('community');
    const [openConversation, setOpenConversation] = useState<Conversation | null>(null);
    const [openUserProfile, setOpenUserProfile] = useState<OpenUserProfile | null>(null);
    const [messagesRefreshKey, setMessagesRefreshKey] = useState(0);
    const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
const followingRequestIdRef = useRef(0);
    const insets = useSafeAreaInsets();

    const inChat = openConversation !== null;
    const inUserProfile = openUserProfile !== null;

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
    };

    const handleCloseConversation = () => {
        setOpenConversation(null);
        setMessagesRefreshKey(current => current + 1);
    };

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
            events:   <Text style={styles.pageTitle}>Events</Text>,
            messages: <Text style={styles.pageTitle}>Messages</Text>,
            profile:  null,
        };

        return (
            <View style={styles.topBar}>
                {titles[activeTab]}
                <View />
            </View>
        );
    };

    const renderContent = () => {
        return (
            <>
                <View style={activeTab === 'community' ? styles.tabVisible : styles.tabHidden}>
                    <FeedScreen
                        followingIds={followingIds}
                        onFollowChange={handleFollowChange}
                        onOpenUserProfile={handleOpenUserProfile}
                        onFollowingLoaded={setFollowingIds}
                    />
                </View>
                <View style={activeTab === 'discover' ? styles.tabVisible : styles.tabHidden}>
                    <DiscoverScreen
                        followingIds={followingIds}
                        onFollowChange={handleFollowChange}
                        onOpenUserProfile={handleOpenUserProfile}
                        refreshFollowingIds={refreshFollowingIds}
                    />
                </View>
                <View style={activeTab === 'events' ? styles.tabVisible : styles.tabHidden}>
                    <EventsScreen />
                </View>
                <View style={activeTab === 'messages' ? styles.tabVisible : styles.tabHidden}>
                    <MessagesScreen
                        isActive={activeTab === 'messages'}
                        refreshKey={messagesRefreshKey}
                        onOpenConversation={setOpenConversation}
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
                    <View style={StyleSheet.absoluteFill}>
                        <UserProfileScreen
                            userId={openUserProfile!.userId}
                            username={openUserProfile!.username}
                            avatarUrl={openUserProfile!.avatarUrl}
                            followingIds={followingIds}
                            onBack={() => setOpenUserProfile(null)}
                            onFollowChange={handleFollowChange}
                            refreshFollowingIds={refreshFollowingIds}
                            onOpenConversation={setOpenConversation}
                        />
                    </View>
                )}
                {inChat && (
                    <View style={StyleSheet.absoluteFill}>
                        <ChatScreen
                            conversation={openConversation!}
                            onBack={handleCloseConversation}
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
                                    setOpenConversation(null);
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
