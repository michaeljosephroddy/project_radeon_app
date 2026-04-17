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
import { NetworkScreen } from '../screens/main/NetworkScreen';
import { ChatScreen } from '../screens/main/ChatScreen';
import { ProfileScreen } from '../screens/main/ProfileScreen';
import { SettingsScreen } from '../screens/main/SettingsScreen';
import { useAuth } from '../hooks/useAuth';
import { Avatar } from '../components/Avatar';
import { Colors, Typography, Spacing } from '../utils/theme';
import type { Conversation } from '../api/client';
import { ProfileSheet } from '../components/ProfileSheet'; // adjust path as needed

type Tab = 'feed' | 'people' | 'network' | 'events' | 'messages';

const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'feed', label: 'feed', icon: 'home-outline', iconActive: 'home' },
    { key: 'people', label: 'people', icon: 'people-outline', iconActive: 'people' },
    { key: 'network', label: 'network', icon: 'person-add-outline', iconActive: 'person-add' },
    { key: 'events', label: 'events', icon: 'calendar-outline', iconActive: 'calendar' },
    { key: 'messages', label: 'messages', icon: 'chatbubble-outline', iconActive: 'chatbubble' },
];

export function AppNavigator() {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('feed');
    const [openConversation, setOpenConversation] = useState<Conversation | null>(null);
    const [profileOpen, setProfileOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const insets = useSafeAreaInsets();
    const [profileSheetVisible, setProfileSheetVisible] = useState(false);

    const handleLogout = async () => {
        try { await logout(); } catch { }
    };

    const renderHeader = () => {
        if (activeTab === 'messages' && openConversation) return null;
        if (profileOpen) return null;
        if (settingsOpen) return null;

        const titles: Record<Tab, React.ReactNode> = {
            feed: (
                <Text style={styles.wordmark}>
                    Sober<Text style={styles.wordmarkAccent}>Space</Text>
                </Text>
            ),
            people: <Text style={styles.pageTitle}>People</Text>,
            network: <Text style={styles.pageTitle}>Network</Text>,
            events: <Text style={styles.pageTitle}>Events</Text>,
            messages: <Text style={styles.pageTitle}>Messages</Text>,
        };

        return (
            <View style={styles.topBar}>
                {titles[activeTab]}
                <View style={styles.topBarRight}>
                    {user && (
                        <TouchableOpacity
                            onPress={() => setProfileSheetVisible(true)}   // ← was handleLogout
                            style={styles.iconBtn}
                        >
                            <Avatar firstName={user.first_name} lastName={user.last_name} avatarUrl={user.avatar_url} size={28} fontSize={10} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    const renderContent = () => {
        if (profileOpen) {
            return <ProfileScreen onBack={() => setProfileOpen(false)} />;
        }

        if (settingsOpen) {
            return <SettingsScreen onBack={() => setSettingsOpen(false)} />;
        }

        if (activeTab === 'messages' && openConversation) {
            return (
                <ChatScreen
                    conversation={openConversation}
                    onBack={() => setOpenConversation(null)}
                />
            );
        }

        return (
            <>
                <View style={activeTab === 'feed' ? styles.tabVisible : styles.tabHidden}>
                    <FeedScreen />
                </View>
                <View style={activeTab === 'people' ? styles.tabVisible : styles.tabHidden}>
                    <PeopleScreen
                        onOpenChat={(conversation) => {
                            setActiveTab('messages');
                            setOpenConversation(conversation);
                        }}
                    />
                </View>
                <View style={activeTab === 'network' ? styles.tabVisible : styles.tabHidden}>
                    <NetworkScreen
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
            </>
        );
    };

    const inChat = activeTab === 'messages' && openConversation;
    const inOverlay = inChat || profileOpen || settingsOpen;

    return (
        <>
            <StatusBar style="light" />
            <SafeAreaView style={styles.container} edges={['top']}>
                {renderHeader()}
                <View style={styles.content}>{renderContent()}</View>

                {!inOverlay && (
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
                                <Text style={[
                                    styles.tabLabel,
                                    activeTab === tab.key && styles.tabLabelActive,
                                ]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </SafeAreaView>

            <ProfileSheet
                visible={profileSheetVisible}
                onClose={() => setProfileSheetVisible(false)}
                onLogout={handleLogout}
                onOpenProfile={() => { setProfileSheetVisible(false); setProfileOpen(true); }}
                onOpenSettings={() => { setProfileSheetVisible(false); setSettingsOpen(true); }}
                user={user}
            />
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
    topBarRight: { flexDirection: 'row', gap: Spacing.sm },
    iconBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.light.backgroundSecondary,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
        alignItems: 'center',
        justifyContent: 'center',
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
