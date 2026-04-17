import React, { useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FeedScreen } from '../screens/main/FeedScreen';
import { PeopleScreen } from '../screens/main/PeopleScreen';
import { EventsScreen } from '../screens/main/EventsScreen';
import { MessagesScreen } from '../screens/main/MessagesScreen';
import { ProfileTabScreen } from '../screens/main/ProfileTabScreen';
import { ChatScreen } from '../screens/main/ChatScreen';
import { UserProfileScreen } from '../screens/main/UserProfileScreen';
import { Colors, Typography, Spacing } from '../utils/theme';
import type { Conversation } from '../api/client';

interface OpenUserProfile {
    userId: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    isFollowing: boolean;
}

type Tab = 'community' | 'people' | 'events' | 'messages' | 'profile';

const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'community', label: 'community', icon: 'newspaper-outline', iconActive: 'newspaper' },
    { key: 'people',    label: 'people',    icon: 'people-outline',   iconActive: 'people' },
    { key: 'events',    label: 'events',    icon: 'calendar-outline', iconActive: 'calendar' },
    { key: 'messages',  label: 'messages',  icon: 'chatbubble-outline', iconActive: 'chatbubble' },
    { key: 'profile',   label: 'profile',   icon: 'person-circle-outline', iconActive: 'person-circle' },
];

export function AppNavigator() {
    const [activeTab, setActiveTab] = useState<Tab>('community');
    const [openConversation, setOpenConversation] = useState<Conversation | null>(null);
    const [openUserProfile, setOpenUserProfile] = useState<OpenUserProfile | null>(null);
    const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
    const insets = useSafeAreaInsets();

    const inChat = activeTab === 'messages' && openConversation !== null;
    const inUserProfile = openUserProfile !== null;

    const handleFollowChange = (userId: string, following: boolean) => {
        setFollowingIds(prev => {
            const next = new Set(prev);
            if (following) next.add(userId); else next.delete(userId);
            return next;
        });
    };

    const handleOpenUserProfile = (profile: Omit<OpenUserProfile, 'isFollowing'>) => {
        setOpenUserProfile({ ...profile, isFollowing: followingIds.has(profile.userId) });
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
            people:   <Text style={styles.pageTitle}>People</Text>,
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
        if (inChat) {
            return (
                <ChatScreen
                    conversation={openConversation!}
                    onBack={() => setOpenConversation(null)}
                />
            );
        }

        if (inUserProfile) {
            return (
                <UserProfileScreen
                    userId={openUserProfile!.userId}
                    firstName={openUserProfile!.firstName}
                    lastName={openUserProfile!.lastName}
                    avatarUrl={openUserProfile!.avatarUrl}
                    initialIsFollowing={openUserProfile!.isFollowing}
                    onBack={() => setOpenUserProfile(null)}
                    onFollowChange={handleFollowChange}
                />
            );
        }

        return (
            <>
                <View style={activeTab === 'community' ? styles.tabVisible : styles.tabHidden}>
                    <FeedScreen
                        followingIds={followingIds}
                        onFollowChange={handleFollowChange}
                        onOpenUserProfile={handleOpenUserProfile}
                        onFollowingLoaded={ids => setFollowingIds(ids)}
                    />
                </View>
                <View style={activeTab === 'people' ? styles.tabVisible : styles.tabHidden}>
                    <PeopleScreen
                        onOpenChat={(conversation) => {
                            setActiveTab('messages');
                            setOpenConversation(conversation);
                        }}
                    />
                </View>
                <View style={activeTab === 'events' ? styles.tabVisible : styles.tabHidden}>
                    <EventsScreen />
                </View>
                <View style={activeTab === 'messages' ? styles.tabVisible : styles.tabHidden}>
                    <MessagesScreen onOpenConversation={setOpenConversation} />
                </View>
                <View style={activeTab === 'profile' ? styles.tabVisible : styles.tabHidden}>
                    <ProfileTabScreen />
                </View>
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
                    <View style={[styles.tabBar, { paddingBottom: insets.bottom + 10 }]}>
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
        paddingTop: 16,
        backgroundColor: Colors.light.backgroundSecondary,
    },
    tabItem: { flex: 1, alignItems: 'center', gap: 4 },
    tabLabel: { fontSize: Typography.sizes.sm, color: Colors.light.textTertiary },
    tabLabelActive: { color: Colors.primary },
});
