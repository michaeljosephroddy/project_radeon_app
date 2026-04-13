import React, { useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeedScreen } from '../screens/main/FeedScreen';
import { PeopleScreen } from '../screens/main/PeopleScreen';
import { EventsScreen } from '../screens/main/EventsScreen';
import { MessagesScreen } from '../screens/main/MessagesScreen';
import { ChatScreen } from '../screens/main/ChatScreen';
import { useAuth } from '../hooks/useAuth';
import { Avatar } from '../components/Avatar';
import { Colors, Typography, Spacing } from '../utils/theme';
import type { Conversation } from '../api/client';
import { ProfileSheet } from '../components/ProfileSheet'; // adjust path as needed

type Tab = 'feed' | 'people' | 'events' | 'messages';

const TABS: { key: Tab; label: string }[] = [
    { key: 'feed', label: 'feed' },
    { key: 'people', label: 'people' },
    { key: 'events', label: 'events' },
    { key: 'messages', label: 'messages' },
];

export function AppNavigator() {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('feed');
    const [openConversation, setOpenConversation] = useState<Conversation | null>(null);
    const insets = useSafeAreaInsets();
    const [profileSheetVisible, setProfileSheetVisible] = useState(false);

    const handleLogout = async () => {
        try { await logout(); } catch { }
    };

    const renderHeader = () => {
        if (activeTab === 'messages' && openConversation) return null;

        const titles: Record<Tab, React.ReactNode> = {
            feed: (
                <Text style={styles.wordmark}>
                    project<Text style={styles.wordmarkAccent}>_radeon</Text>
                </Text>
            ),
            people: <Text style={styles.pageTitle}>People</Text>,
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
                            <Avatar firstName={user.first_name} lastName={user.last_name} size={28} fontSize={10} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    const renderContent = () => {
        if (activeTab === 'messages' && openConversation) {
            return (
                <ChatScreen
                    conversation={openConversation}
                    onBack={() => setOpenConversation(null)}
                />
            );
        }

        switch (activeTab) {
            case 'feed': return <FeedScreen />;
            case 'people': return (
                <PeopleScreen
                    onOpenChat={(conversation) => {
                        setActiveTab('messages');
                        setOpenConversation(conversation);
                    }}
                />
            );
            case 'events': return <EventsScreen />;
            case 'messages': return (
                <MessagesScreen onOpenConversation={setOpenConversation} />
            );
        }
    };

    const inChat = activeTab === 'messages' && openConversation;

    return (
        <>
            <SafeAreaView style={styles.container} edges={['top']}>
                {renderHeader()}
                <View style={styles.content}>{renderContent()}</View>

                {!inChat && (
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
                                <View style={[
                                    styles.tabIndicator,
                                    activeTab === tab.key && styles.tabIndicatorActive,
                                ]} />
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
                user={user}
            />
        </>
    );
}
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.light.background },
    content: { flex: 1 },

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
        borderTopWidth: 0.5,
        borderTopColor: Colors.light.border,
        paddingTop: 12,
    },
    tabItem: { flex: 1, alignItems: 'center', gap: 4 },
    tabIndicator: {
        width: 18,
        height: 2,
        borderRadius: 2,
        backgroundColor: 'transparent',
    },
    tabIndicatorActive: { backgroundColor: Colors.primary },
    tabLabel: { fontSize: Typography.sizes.xs, color: Colors.light.textTertiary },
    tabLabelActive: { color: Colors.primary },
});
