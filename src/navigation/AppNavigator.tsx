import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Keyboard, Platform, AppState,
} from 'react-native';
import { getDeviceCoords, reverseGeocode } from '../utils/location';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CommentsModal, type CommentThreadTarget } from '../components/CommentsModal';
import { FeedScreen } from '../screens/main/FeedScreen';
import { DiscoverScreen } from '../screens/main/DiscoverScreen';
import { SupportScreen } from '../screens/main/SupportScreen';
import { MeetupsScreen } from '../screens/main/MeetupsScreen';
import { ChatsScreen } from '../screens/main/ChatsScreen';
import { ProfileTabScreen } from '../screens/main/ProfileTabScreen';
import { ChatScreen } from '../screens/main/ChatScreen';
import { NotificationsScreen } from '../screens/main/NotificationsScreen';
import { ComposeDMScreen } from '../screens/main/ComposeDMScreen';
import { DailyReflectionScreen } from '../screens/main/DailyReflectionScreen';
import { UserProfileScreen } from '../screens/main/UserProfileScreen';
import { MeetupDetailScreen } from '../screens/main/MeetupDetailScreen';
import { Avatar } from '../components/Avatar';
import { PlusUpsellScreen } from '../components/PlusUpsellScreen';
import * as api from '../api/client';
import { Colors, Radius, Typography, Spacing } from '../theme';
import { useAuth } from '../hooks/useAuth';
import { useNotificationSummary } from '../hooks/queries/useNotificationSummary';
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

function badgeLabel(count: number): string {
    return count > 99 ? '99+' : String(count);
}

// Each tab is its own memoized component so React skips reconciliation for the
// three tabs that didn't change when the active tab switches.
const DiscoverTab = React.memo(function DiscoverTab({
    isActive,
    onOpenUserProfile,
    onOpenPlus,
}: {
    isActive: boolean;
    onOpenUserProfile: (p: OpenUserProfile) => void;
    onOpenPlus: () => void;
}) {
    return <View style={isActive ? styles.tabVisible : styles.tabHidden}><DiscoverScreen isActive={isActive} onOpenUserProfile={onOpenUserProfile} onOpenPlus={onOpenPlus} /></View>;
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
    const {
        data: notificationSummary,
        refetch: refetchNotificationSummary,
    } = useNotificationSummary(Boolean(user?.id));
    const [activeTab, setActiveTab] = useState<Tab>('community');
    const [openChat, setOpenChat] = useState<Chat | null>(null);
    const [openUserProfile, setOpenUserProfile] = useState<OpenUserProfile | null>(null);
    const [pendingDM, setPendingDM] = useState<{ recipientId: string; username: string; avatarUrl?: string } | null>(null);
    const [ownProfileOpen, setOwnProfileOpen] = useState(false);
    const [openMeetup, setOpenMeetup] = useState<api.Meetup | null>(null);
    const [plusUpsellOpen, setPlusUpsellOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [reflectionOpen, setReflectionOpen] = useState(false);
    const [openComments, setOpenComments] = useState<{
        thread: CommentThreadTarget;
        focusComposer: boolean;
        onCommentCreated?: (comment: api.Comment) => void;
    } | null>(null);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [feedFocusRequest, setFeedFocusRequest] = useState<{ postId: string; commentId?: string; nonce: number } | null>(null);
    const insets = useSafeAreaInsets();

    const inChat = openChat !== null;
    const inUserProfile = openUserProfile !== null;
    const inOwnProfile = ownProfileOpen;
    const inComposeDM = pendingDM !== null;
    const inMeetupDetail = openMeetup !== null;
    const inPlusUpsell = plusUpsellOpen;
    const inNotifications = notificationsOpen;
    const inReflection = reflectionOpen;
    const inComments = openComments !== null;

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

    const openPlusUpsell = useCallback(() => {
        setPlusUpsellOpen(true);
    }, []);

    const closePlusUpsell = useCallback(() => {
        setPlusUpsellOpen(false);
    }, []);

    const openNotifications = useCallback(() => {
        setNotificationsOpen(true);
        setReflectionOpen(false);
        setOpenChat(null);
        setOpenUserProfile(null);
        setOwnProfileOpen(false);
        setPendingDM(null);
        setOpenMeetup(null);
        setPlusUpsellOpen(false);
    }, []);

    const closeNotifications = useCallback(() => {
        setNotificationsOpen(false);
    }, []);

    const openReflection = useCallback(() => {
        setReflectionOpen(true);
        setNotificationsOpen(false);
        setOpenChat(null);
        setOpenUserProfile(null);
        setOwnProfileOpen(false);
        setPendingDM(null);
        setOpenMeetup(null);
        setPlusUpsellOpen(false);
    }, []);

    const closeReflection = useCallback(() => {
        setReflectionOpen(false);
    }, []);

    const handleCloseChat = useCallback(() => {
        Keyboard.dismiss();
        setOpenChat(null);
        setNotificationsOpen(false);
        setReflectionOpen(false);
        setOpenComments(null);
        setKeyboardVisible(false);
    }, []);

    const handleComposeDM = useCallback((info: { recipientId: string; username: string; avatarUrl?: string }) => {
        setPendingDM(info);
        setOpenUserProfile(null);
    }, []);

    const handleComposeDMComplete = useCallback((chat: Chat) => {
        setPendingDM(null);
        setOpenChat(chat);
    }, []);

    const handleOpenComments = useCallback((
        thread: CommentThreadTarget,
        focusComposer: boolean,
        onCommentCreated?: (comment: api.Comment) => void,
    ) => {
        setOpenComments({ thread, focusComposer, onCommentCreated });
    }, []);

    const handleFeedFocusRequestConsumed = useCallback((nonce: number) => {
        setFeedFocusRequest((current) => (
            current?.nonce === nonce ? null : current
        ));
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
        setNotificationsOpen(false);
    }, []);

    const handleOpenNotificationChat = useCallback(async (chatId: string) => {
        const chat = await api.getChat(chatId);
        setNotificationsOpen(false);
        setReflectionOpen(false);
        setActiveTab('chats');
        setOwnProfileOpen(false);
        setOpenUserProfile(null);
        setPendingDM(null);
        setOpenMeetup(null);
        setPlusUpsellOpen(false);
        setOpenChat(chat);
    }, []);

    const handleOpenNotificationMention = useCallback((target: { postId: string; commentId?: string }) => {
        setNotificationsOpen(false);
        setReflectionOpen(false);
        setActiveTab('community');
        setOpenChat(null);
        setOpenUserProfile(null);
        setOwnProfileOpen(false);
        setPendingDM(null);
        setOpenMeetup(null);
        setPlusUpsellOpen(false);
        setFeedFocusRequest({
            postId: target.postId,
            commentId: target.commentId,
            nonce: Date.now(),
        });
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

    useEffect(() => {
        if (!user?.id) return undefined;

        const sub = AppState.addEventListener('change', nextState => {
            if (nextState === 'active') void refetchNotificationSummary();
        });

        return () => sub.remove();
    }, [refetchNotificationSummary, user?.id]);

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
                    setNotificationsOpen(false);
                    setReflectionOpen(false);
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
        setNotificationsOpen(false);
        setReflectionOpen(false);
        setFeedFocusRequest({
            postId: intent.postId,
            commentId: intent.commentId,
            nonce: Date.now(),
        });
        consumeIntent();
    }, [consumeIntent, intent]);

    const header = useMemo(() => {
        if (inChat || inUserProfile || inOwnProfile || inComposeDM || inMeetupDetail || inPlusUpsell || inNotifications || inReflection) return null;

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
                <View style={styles.topBarActions}>
                    <TouchableOpacity
                        style={styles.headerIconButton}
                        onPress={openReflection}
                        disabled={!user}
                    >
                        <Ionicons name="create-outline" size={22} color={Colors.text.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.headerIconButton}
                        onPress={openNotifications}
                        disabled={!user}
                    >
                        <Ionicons name="notifications-outline" size={22} color={Colors.text.primary} />
                        {(notificationSummary?.unread_count ?? 0) > 0 ? (
                            <View style={styles.notificationBadge}>
                                <Text style={styles.notificationBadgeText}>{badgeLabel(notificationSummary?.unread_count ?? 0)}</Text>
                            </View>
                        ) : null}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={openOwnProfile} disabled={!user}>
                        <Avatar
                            username={user?.username ?? 'me'}
                            avatarUrl={user?.avatar_url}
                            size={34}
                            fontSize={12}
                        />
                    </TouchableOpacity>
                </View>
            </View>
        );
    }, [
        activeTab, inChat, inComposeDM, inMeetupDetail, inNotifications, inReflection,
        inOwnProfile, inPlusUpsell, inUserProfile, notificationSummary?.unread_count,
        openNotifications, openOwnProfile, openReflection, user,
    ]);

    const overlays = useMemo(() => (
        <>
            {inOwnProfile && (
                <View style={StyleSheet.absoluteFill}>
                    <ProfileTabScreen
                        isActive={inOwnProfile}
                        onBack={closeOwnProfile}
                        onOpenUserProfile={handleOpenUserProfile}
                        onOpenComments={handleOpenComments}
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
            {inUserProfile && (
                <View style={StyleSheet.absoluteFill}>
                    <UserProfileScreen
                        userId={openUserProfile!.userId}
                        username={openUserProfile!.username}
                        avatarUrl={openUserProfile!.avatarUrl}
                        isActive={inUserProfile && !inChat && !inComposeDM}
                        onBack={closeUserProfile}
                        onOpenChat={setOpenChat}
                        onOpenComments={handleOpenComments}
                        onComposeDM={handleComposeDM}
                    />
                </View>
            )}
            {inPlusUpsell && (
                <View style={StyleSheet.absoluteFill}>
                    <PlusUpsellScreen
                        onPrimary={closePlusUpsell}
                        onDismiss={closePlusUpsell}
                    />
                </View>
            )}
            {inNotifications && (
                <View style={StyleSheet.absoluteFill}>
                    <NotificationsScreen
                        isActive={inNotifications}
                        onBack={closeNotifications}
                        onOpenChat={handleOpenNotificationChat}
                        onOpenMention={handleOpenNotificationMention}
                    />
                </View>
            )}
            {inReflection && user && (
                <View style={StyleSheet.absoluteFill}>
                    <DailyReflectionScreen
                        currentUserId={user.id}
                        isActive={inReflection}
                        onBack={closeReflection}
                    />
                </View>
            )}
        </>
    ), [
        inOwnProfile, inUserProfile, inChat, inComposeDM, inMeetupDetail, inPlusUpsell, inNotifications, inReflection,
        openUserProfile, openChat, pendingDM, openMeetup,
        handleOpenUserProfile, handleCloseChat, closeUserProfile, closeOwnProfile,
        handleOpenComments,
        handleComposeDM, handleComposeDMComplete, handleCloseMeetup, closePlusUpsell,
        closeNotifications, closeReflection, handleOpenNotificationChat, handleOpenNotificationMention, user,
    ]);

    const isOverlayOpen = inChat || inUserProfile || inOwnProfile || inComposeDM || inMeetupDetail || inPlusUpsell || inNotifications || inReflection;

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
                            onOpenComments={handleOpenComments}
                            focusRequest={feedFocusRequest}
                            onFocusRequestConsumed={handleFeedFocusRequestConsumed}
                        />
                    </View>
                    <DiscoverTab isActive={activeTab === 'discover' && !isOverlayOpen} onOpenUserProfile={handleOpenUserProfile} onOpenPlus={openPlusUpsell} />
                    <SupportTab isActive={activeTab === 'support' && !isOverlayOpen} onOpenChat={setOpenChat} onOpenUserProfile={handleOpenUserProfile} />
                    <MeetupsTab
                        isActive={activeTab === 'meetups' && !isOverlayOpen}
                        onOpenUserProfile={handleOpenUserProfile}
                        onOpenMeetup={handleOpenMeetup}
                    />
                    <ChatsTab isActive={activeTab === 'chats' && !isOverlayOpen} onOpenChat={setOpenChat} />
                    {overlays}
                </View>

                {!inChat && !inUserProfile && !inOwnProfile && !inComposeDM && !inMeetupDetail && !inNotifications && !inReflection && !keyboardVisible && (
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
                                    color={activeTab === tab.key ? Colors.primary : Colors.text.muted}
                                />
                                <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </SafeAreaView>

            {inComments && user && (
                <View style={StyleSheet.absoluteFillObject}>
                    <CommentsModal
                        thread={openComments!.thread}
                        currentUser={user}
                        focusComposer={openComments!.focusComposer}
                        onCommentCreated={openComments!.onCommentCreated}
                        onClose={() => setOpenComments(null)}
                        onPressUser={handleOpenUserProfile}
                    />
                </View>
            )}
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.page },
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
        color: Colors.text.primary,
    },
    wordmarkAccent: { color: Colors.primary },
    pageTitle: {
        ...Typography.screenTitle,
        color: Colors.text.primary,
    },
    topBarActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    headerIconButton: {
        position: 'relative',
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
    },
    notificationBadge: {
        position: 'absolute',
        top: -2,
        right: -4,
        minWidth: 18,
        height: 18,
        paddingHorizontal: Spacing.xs,
        borderRadius: Radius.pill,
        backgroundColor: Colors.danger,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.bg.page,
    },
    notificationBadgeText: {
        fontSize: 10,
        lineHeight: 12,
        color: Colors.textOn.danger,
        fontWeight: '700',
    },

    tabBar: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: Colors.border.subtle,
        paddingTop: 8,
        backgroundColor: Colors.bg.page,
    },
    tabItem: { flex: 1, alignItems: 'center', gap: 4 },
    tabLabel: { fontSize: Typography.sizes.sm, color: Colors.text.muted },
    tabLabelActive: { color: Colors.primary },
});
