import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Keyboard, Platform, AppState,
} from 'react-native';
import { getDeviceCoords, reverseGeocode } from '../utils/location';
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
import { ComposeDMScreen } from '../screens/main/ComposeDMScreen';
import { UserProfileScreen } from '../screens/main/UserProfileScreen';
import { MeetupDetailScreen } from '../screens/main/MeetupDetailScreen';
import { Avatar } from '../components/Avatar';
import * as api from '../api/client';
import { Colors, Typography, Spacing } from '../utils/theme';
import { useAuth } from '../hooks/useAuth';
import { useNotificationIntent } from '../notifications/NotificationProvider';
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

// Each tab is its own memoized component so React skips reconciliation for the
// three tabs that didn't change when the active tab switches.
const DiscoverTab = React.memo(function DiscoverTab({ isActive, onOpenUserProfile }: { isActive: boolean; onOpenUserProfile: (p: OpenUserProfile) => void }) {
    return <View style={isActive ? styles.tabVisible : styles.tabHidden}><DiscoverScreen isActive={isActive} onOpenUserProfile={onOpenUserProfile} /></View>;
});

const SupportTab = React.memo(function SupportTab({ isActive, onOpenChat, onOpenUserProfile }: { isActive: boolean; onOpenChat: (c: Chat) => void; onOpenUserProfile: (p: OpenUserProfile) => void }) {
    return <View style={isActive ? styles.tabVisible : styles.tabHidden}><SupportScreen isActive={isActive} onOpenChat={onOpenChat} onOpenUserProfile={onOpenUserProfile} /></View>;
});

const MeetupsTab = React.memo(function MeetupsTab({
    isActive,
    onOpenUserProfile,
    onOpenMeetup,
}: {
    isActive: boolean;
    onOpenUserProfile: (p: OpenUserProfile) => void;
    onOpenMeetup: (meetup: api.Meetup) => void;
}) {
    return (
        <View style={isActive ? styles.tabVisible : styles.tabHidden}>
            <MeetupsScreen
                isActive={isActive}
                onOpenUserProfile={onOpenUserProfile}
                onOpenMeetup={onOpenMeetup}
            />
        </View>
    );
});

const ChatsTab = React.memo(function ChatsTab({ isActive, onOpenChat }: { isActive: boolean; onOpenChat: (c: Chat) => void }) {
    return <View style={isActive ? styles.tabVisible : styles.tabHidden}><ChatsScreen isActive={isActive} onOpenChat={onOpenChat} /></View>;
});

export function AppNavigator() {
    const { user, refreshUser } = useAuth();
    const { intent, consumeIntent } = useNotificationIntent();
    const [activeTab, setActiveTab] = useState<Tab>('community');
    const [openChat, setOpenChat] = useState<Chat | null>(null);
    const [openUserProfile, setOpenUserProfile] = useState<OpenUserProfile | null>(null);
    const [pendingDM, setPendingDM] = useState<{ recipientId: string; username: string; avatarUrl?: string } | null>(null);
    const [ownProfileOpen, setOwnProfileOpen] = useState(false);
    const [openMeetup, setOpenMeetup] = useState<api.Meetup | null>(null);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [feedFocusRequest, setFeedFocusRequest] = useState<{ postId: string; commentId?: string; nonce: number } | null>(null);
    const insets = useSafeAreaInsets();

    const inChat = openChat !== null;
    const inUserProfile = openUserProfile !== null;
    const inOwnProfile = ownProfileOpen;
    const inComposeDM = pendingDM !== null;
    const inMeetupDetail = openMeetup !== null;

    const handleOpenUserProfile = useCallback((profile: OpenUserProfile) => {
        setOpenUserProfile(profile);
        setOwnProfileOpen(false);
        setOpenChat(null);
    }, []);

    const handleOpenMeetup = useCallback((meetup: api.Meetup) => {
        setOpenMeetup(meetup);
    }, []);

    const handleCloseMeetup = useCallback(() => {
        setOpenMeetup(null);
    }, []);

    const handleCloseChat = useCallback(() => {
        setOpenChat(null);
    }, []);

    const handleComposeDM = useCallback((info: { recipientId: string; username: string; avatarUrl?: string }) => {
        setPendingDM(info);
        setOpenUserProfile(null);
    }, []);

    const handleComposeDMComplete = useCallback((chat: Chat) => {
        setPendingDM(null);
        setOpenChat(chat);
    }, []);

    const closeUserProfile = useCallback(() => {
        setOpenUserProfile(null);
    }, []);

    const openOwnProfile = useCallback(() => {
        setOwnProfileOpen(true);
        setOpenUserProfile(null);
        setOpenChat(null);
    }, []);

    const closeOwnProfile = useCallback(() => {
        setOwnProfileOpen(false);
    }, []);

    const handleTabPress = useCallback((tab: Tab) => {
        setActiveTab(tab);
        setOpenChat(null);
    }, []);

    const syncingLocation = useRef(false);

    useEffect(() => {
        if (!user?.id) return;

        const syncLocation = async () => {
            if (syncingLocation.current) return;
            syncingLocation.current = true;
            try {
                const coords = await getDeviceCoords();
                if (!coords) return;
                const city = await reverseGeocode(coords.latitude, coords.longitude);
                if (!city) return;
                await api.updateMyCurrentLocation({ lat: coords.latitude, lng: coords.longitude, city });
                await refreshUser();
            } catch {
                // background sync — failures are non-critical
            } finally {
                syncingLocation.current = false;
            }
        };

        void syncLocation();

        const sub = AppState.addEventListener('change', nextState => {
            if (nextState === 'active') void syncLocation();
        });

        return () => sub.remove();
    }, [user?.id, refreshUser]);

    React.useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
        const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    React.useEffect(() => {
        if (!intent) return;

        if (intent.kind === 'chat') {
            let cancelled = false;
            void (async () => {
                try {
                    const chat = await api.getChat(intent.chatId);
                    if (cancelled) return;
                    setActiveTab('chats');
                    setOwnProfileOpen(false);
                    setOpenUserProfile(null);
                    setOpenChat(chat);
                } finally {
                    if (!cancelled) consumeIntent();
                }
            })();
            return () => {
                cancelled = true;
            };
        }

        setActiveTab('community');
        setOpenChat(null);
        setOpenUserProfile(null);
        setOwnProfileOpen(false);
        setFeedFocusRequest({
            postId: intent.postId,
            commentId: intent.commentId,
            nonce: Date.now(),
        });
        consumeIntent();
    }, [consumeIntent, intent]);

    const header = useMemo(() => {
        if (inChat || inUserProfile || inOwnProfile || inComposeDM || inMeetupDetail) return null;

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
    }, [inChat, inUserProfile, inOwnProfile, inComposeDM, inMeetupDetail, activeTab, user, openOwnProfile]);

    const overlays = useMemo(() => (
        <>
            {inOwnProfile && (
                <View style={StyleSheet.absoluteFill}>
                    <ProfileTabScreen
                        isActive={inOwnProfile}
                        onBack={closeOwnProfile}
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
                        isActive={inUserProfile && !inChat && !inComposeDM}
                        onBack={closeUserProfile}
                        onOpenChat={setOpenChat}
                        onComposeDM={handleComposeDM}
                    />
                </View>
            )}
            {inComposeDM && (
                <View style={StyleSheet.absoluteFill}>
                    <ComposeDMScreen
                        recipientId={pendingDM!.recipientId}
                        username={pendingDM!.username}
                        avatarUrl={pendingDM!.avatarUrl}
                        onBack={() => setPendingDM(null)}
                        onComplete={handleComposeDMComplete}
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
            {inMeetupDetail && (
                <View style={StyleSheet.absoluteFill}>
                    <MeetupDetailScreen
                        meetup={openMeetup!}
                        onBack={handleCloseMeetup}
                        onOpenUserProfile={handleOpenUserProfile}
                    />
                </View>
            )}
        </>
    ), [
        inOwnProfile, inUserProfile, inChat, inComposeDM, inMeetupDetail,
        openUserProfile, openChat, pendingDM, openMeetup,
        handleOpenUserProfile, handleCloseChat, closeUserProfile, closeOwnProfile,
        handleComposeDM, handleComposeDMComplete, handleCloseMeetup,
    ]);

    const isOverlayOpen = inChat || inUserProfile || inOwnProfile || inComposeDM || inMeetupDetail;

    return (
        <>
            <StatusBar style="light" />
            <SafeAreaView style={styles.container} edges={['top']}>
                {header}
                <View style={styles.content}>
                    <View style={activeTab === 'community' && !isOverlayOpen ? styles.tabVisible : styles.tabHidden}>
                        <FeedScreen
                            isActive={activeTab === 'community' && !isOverlayOpen}
                            onOpenUserProfile={handleOpenUserProfile}
                            focusRequest={feedFocusRequest}
                        />
                    </View>
                    <DiscoverTab isActive={activeTab === 'discover' && !isOverlayOpen} onOpenUserProfile={handleOpenUserProfile} />
                    <SupportTab isActive={activeTab === 'support' && !isOverlayOpen} onOpenChat={setOpenChat} onOpenUserProfile={handleOpenUserProfile} />
                    <MeetupsTab
                        isActive={activeTab === 'meetups' && !isOverlayOpen}
                        onOpenUserProfile={handleOpenUserProfile}
                        onOpenMeetup={handleOpenMeetup}
                    />
                    <ChatsTab isActive={activeTab === 'chats' && !isOverlayOpen} onOpenChat={setOpenChat} />
                    {overlays}
                </View>

                {!inChat && !inUserProfile && !inOwnProfile && !inComposeDM && !inMeetupDetail && !keyboardVisible && (
                    <View style={[styles.tabBar, { paddingBottom: insets.bottom + 6 }]}>
                        {TABS.map(tab => (
                            <TouchableOpacity
                                key={tab.key}
                                style={styles.tabItem}
                                onPress={() => handleTabPress(tab.key)}
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
