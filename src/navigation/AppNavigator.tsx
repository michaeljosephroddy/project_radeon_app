import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Keyboard, Platform, AppState,
} from 'react-native';
import { getDeviceCoords, reverseGeocodePlace } from '../utils/location';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CommentThreadTarget } from '../screens/main/feed/FeedCommentsScreen';
import { FeedScreen } from '../screens/main/FeedScreen';
import { DiscoverScreen } from '../screens/main/DiscoverScreen';
import { CommunityHubScreen, type CommunityHubSurface } from '../screens/main/CommunityHubScreen';
import { ChatsScreen } from '../screens/main/ChatsScreen';
import { ProfileTabScreen } from '../screens/main/ProfileTabScreen';
import { Avatar } from '../components/Avatar';
import { CenterCreateButton } from '../components/create/CenterCreateButton';
import { CreateActionSheet, type GlobalCreateAction } from '../components/create/CreateActionSheet';
import type { ProfileContentTabKey } from '../components/profile/ProfileContentTabs';
import * as api from '../api/client';
import { Colors, ControlSizes, Radius, TextStyles, Typography, Spacing } from '../theme';
import { useAuth } from '../hooks/useAuth';
import { useNotificationSummary } from '../hooks/queries/useNotificationSummary';
import { useNotificationIntent } from '../notifications/NotificationProvider';
import type { Chat } from '../api/client';
import type { RootStackParamList } from './types';

interface OpenUserProfile {
    userId: string;
    username: string;
    avatarUrl?: string;
}

type MainTab = 'feed' | 'discover' | 'community' | 'chats';
type ContentTab = MainTab | 'profile';

const TABS: { key: MainTab; label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'feed',      label: 'feed',      icon: 'newspaper-outline', iconActive: 'newspaper' },
    { key: 'discover',  label: 'discover',  icon: 'grid-outline', iconActive: 'grid' },
    { key: 'community', label: 'community', icon: 'people-outline', iconActive: 'people' },
    { key: 'chats',     label: 'chats',     icon: 'chatbubble-outline', iconActive: 'chatbubble' },
];

function badgeLabel(count: number): string {
    return count > 99 ? '99+' : String(count);
}

function isMainTab(tab: ContentTab): tab is MainTab {
    return tab === 'feed' || tab === 'discover' || tab === 'community' || tab === 'chats';
}

// Each tab is its own memoized component so React skips reconciliation for the
// three tabs that didn't change when the active tab switches.
const DiscoverTab = React.memo(function DiscoverTab({
    isActive,
    onOpenUserProfile,
    onOpenChat,
    onOpenRecoveryMeeting,
    onOpenDatingLikes,
    onOpenDatingMatches,
    onOpenDatingProfileEditor,
}: {
    isActive: boolean;
    onOpenUserProfile: (p: OpenUserProfile) => void;
    onOpenChat: (chat: Chat) => void;
    onOpenRecoveryMeeting: (meeting: api.RecoveryMeeting) => void;
    onOpenDatingLikes: () => void;
    onOpenDatingMatches: () => void;
    onOpenDatingProfileEditor: () => void;
}) {
    return (
        <View style={isActive ? styles.tabVisible : styles.tabHidden}>
            <DiscoverScreen
                isActive={isActive}
                onOpenUserProfile={onOpenUserProfile}
                onOpenChat={onOpenChat}
                onOpenRecoveryMeeting={onOpenRecoveryMeeting}
                onOpenDatingLikes={onOpenDatingLikes}
                onOpenDatingMatches={onOpenDatingMatches}
                onOpenDatingProfileEditor={onOpenDatingProfileEditor}
            />
        </View>
    );
});

const FeedTab = React.memo(function FeedTab({
    isActive,
    onOpenUserProfile,
    onOpenComments,
    focusRequest,
    onFocusRequestConsumed,
}: {
    isActive: boolean;
    onOpenUserProfile: (p: OpenUserProfile) => void;
    onOpenComments: (thread: CommentThreadTarget, focusComposer: boolean, onCommentCreated?: (comment: api.Comment) => void) => void;
    focusRequest: { postId: string; commentId?: string; nonce: number } | null;
    onFocusRequestConsumed: (nonce: number) => void;
}) {
    return (
        <View style={isActive ? styles.tabVisible : styles.tabHidden}>
            <FeedScreen
                isActive={isActive}
                onOpenUserProfile={onOpenUserProfile}
                onOpenComments={onOpenComments}
                focusRequest={focusRequest}
                onFocusRequestConsumed={onFocusRequestConsumed}
            />
        </View>
    );
});

const CommunityTab = React.memo(function CommunityTab({
    isActive,
    activeSurface,
    onChangeSurface,
    onOpenGroup,
    onOpenMeetup,
    onOpenManageMeetup,
}: {
    isActive: boolean;
    activeSurface: CommunityHubSurface;
    onChangeSurface: (surface: CommunityHubSurface) => void;
    onOpenGroup: (groupId: string) => void;
    onOpenMeetup: (meetup: api.Meetup) => void;
    onOpenManageMeetup: (meetup: api.Meetup) => void;
}) {
    return (
        <View style={isActive ? styles.tabVisible : styles.tabHidden}>
            <CommunityHubScreen
                isActive={isActive}
                activeSurface={activeSurface}
                onChangeSurface={onChangeSurface}
                onOpenGroup={onOpenGroup}
                onOpenMeetup={onOpenMeetup}
                onOpenManageMeetup={onOpenManageMeetup}
            />
        </View>
    );
});

const ChatsTab = React.memo(function ChatsTab({ isActive, onOpenChat }: { isActive: boolean; onOpenChat: (c: Chat) => void }) {
    return <View style={isActive ? styles.tabVisible : styles.tabHidden}><ChatsScreen isActive={isActive} onOpenChat={onOpenChat} /></View>;
});

const ProfileTab = React.memo(function ProfileTab({
    isActive,
    initialContentTab,
    resetKey,
    onBack,
    onOpenUserProfile,
    onOpenComments,
}: {
    isActive: boolean;
    initialContentTab: ProfileContentTabKey;
    resetKey: number;
    onBack: () => void;
    onOpenUserProfile: (p: OpenUserProfile) => void;
    onOpenComments: (thread: CommentThreadTarget, focusComposer: boolean, onCommentCreated?: (comment: api.Comment) => void) => void;
}) {
    return (
        <View style={isActive ? styles.tabVisible : styles.tabHidden}>
            <ProfileTabScreen
                isActive={isActive}
                initialContentTab={initialContentTab}
                resetKey={resetKey}
                onBack={onBack}
                onOpenUserProfile={onOpenUserProfile}
                onOpenComments={onOpenComments}
            />
        </View>
    );
});

export function AppNavigator() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'MainTabs'>>();
    const { user, refreshUser } = useAuth();
    const { intent, consumeIntent } = useNotificationIntent();
    const notificationSummaryQuery = useNotificationSummary(Boolean(user?.id));
    const notificationSummary = notificationSummaryQuery.data;
    const [activeTab, setActiveTab] = useState<ContentTab>('feed');
    const [previousMainTab, setPreviousMainTab] = useState<MainTab>('feed');
    const [communitySurface, setCommunitySurface] = useState<CommunityHubSurface>('groups');
    const [createMenuOpen, setCreateMenuOpen] = useState(false);
    const [ownProfileInitialContentTab, setOwnProfileInitialContentTab] = useState<ProfileContentTabKey>('posts');
    const [ownProfileResetKey, setOwnProfileResetKey] = useState(0);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [feedFocusRequest, setFeedFocusRequest] = useState<{ postId: string; commentId?: string; nonce: number } | null>(null);
    const insets = useSafeAreaInsets();

    const openChatScreen = useCallback((chat: Chat): void => {
        Keyboard.dismiss();
        setCreateMenuOpen(false);
        navigation.navigate('Chat', { chat });
    }, [navigation]);

    const handleOpenUserProfile = useCallback((profile: OpenUserProfile) => {
        setCreateMenuOpen(false);
        navigation.navigate('UserProfile', profile);
    }, [navigation]);

    const handleOpenMeetup = useCallback((meetup: api.Meetup) => {
        setCreateMenuOpen(false);
        navigation.navigate('MeetupDetail', { meetup });
    }, [navigation]);

    const handleOpenRecoveryMeeting = useCallback((meeting: api.RecoveryMeeting) => {
        setCreateMenuOpen(false);
        navigation.navigate('RecoveryMeetingDetail', { meeting });
    }, [navigation]);

    const openNotifications = useCallback(() => {
        setCreateMenuOpen(false);
        navigation.navigate('Notifications');
    }, [navigation]);

    const handleOpenGroup = useCallback((groupId: string, postId?: string) => {
        setCreateMenuOpen(false);
        navigation.navigate('GroupDetail', {
            groupId,
            focusPostRequest: postId ? { postId, nonce: Date.now() } : undefined,
        });
    }, [navigation]);

    const handleOpenComments = useCallback((
        thread: CommentThreadTarget,
        focusComposer: boolean,
        _onCommentCreated?: (comment: api.Comment) => void,
    ) => {
        setCreateMenuOpen(false);
        navigation.navigate('FeedComments', { thread, focusComposer });
    }, [navigation]);

    const openCreatePost = useCallback(() => {
        setCreateMenuOpen(false);
        navigation.navigate('CreatePost');
    }, [navigation]);

    const openCreateGroup = useCallback(() => {
        setCreateMenuOpen(false);
        navigation.navigate('CreateGroup');
    }, [navigation]);

    const openCreateSupportRequest = useCallback(() => {
        setCreateMenuOpen(false);
        navigation.navigate('CreateSupportRequest');
    }, [navigation]);

    const openCreateMeetup = useCallback(() => {
        setCreateMenuOpen(false);
        navigation.navigate('CreateMeetup');
    }, [navigation]);

    const openManageMeetup = useCallback((meetup: api.Meetup) => {
        setCreateMenuOpen(false);
        navigation.navigate('CreateMeetup', { meetup });
    }, [navigation]);

    const handleFeedFocusRequestConsumed = useCallback((nonce: number) => {
        setFeedFocusRequest((current) => (
            current?.nonce === nonce ? null : current
        ));
    }, []);

    const openOwnProfile = useCallback(() => {
        setCreateMenuOpen(false);
        setOwnProfileInitialContentTab('posts');
        if (isMainTab(activeTab)) {
            setPreviousMainTab(activeTab);
        }
        setActiveTab('profile');
        setOwnProfileResetKey((current) => current + 1);
    }, [activeTab]);

    const closeOwnProfile = useCallback(() => {
        setActiveTab(previousMainTab);
    }, [previousMainTab]);

    const handleTabPress = useCallback((tab: MainTab) => {
        setCreateMenuOpen(false);
        setPreviousMainTab(tab);
        setActiveTab(tab);
    }, []);

    const syncingLocation = useRef(false);

    useEffect(() => {
        if (!user?.id) return;

        const syncLocation = async () => {
            if (syncingLocation.current) return;
            syncingLocation.current = true;
            try {
                const location = await getDeviceCoords();
                if (location.status !== 'available' || !location.coords) return;
                const place = await reverseGeocodePlace(location.coords.latitude, location.coords.longitude);
                if (!place?.city || !place.country) return;
                await api.updateMyCurrentLocation({
                    lat: location.coords.latitude,
                    lng: location.coords.longitude,
                    city: place.city,
                    country: place.country,
                });
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
            if (nextState !== 'active') return;
            if (!notificationSummaryQuery.isStale) return;
            if (notificationSummaryQuery.isFetching || notificationSummaryQuery.isLoading) return;
            if (notificationSummaryQuery.dataUpdatedAt === 0) return;

            void notificationSummaryQuery.refetch();
        });

        return () => sub.remove();
    }, [
        notificationSummaryQuery.dataUpdatedAt,
        notificationSummaryQuery.isFetching,
        notificationSummaryQuery.isLoading,
        notificationSummaryQuery.isStale,
        notificationSummaryQuery.refetch,
        user?.id,
    ]);

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

    useEffect(() => {
        const requestedTab = route.params?.tab;
        const requestedFocus = route.params?.feedFocusRequest;
        if (!requestedTab && !requestedFocus) return;

        setCreateMenuOpen(false);
        if (requestedTab) {
            setActiveTab(requestedTab);
            setPreviousMainTab(requestedTab);
        }
        if (requestedFocus) {
            setActiveTab('feed');
            setPreviousMainTab('feed');
            setFeedFocusRequest(requestedFocus);
        }
        navigation.setParams({ tab: undefined, feedFocusRequest: undefined });
    }, [navigation, route.params?.feedFocusRequest, route.params?.tab]);

    React.useEffect(() => {
        if (!intent) return;

        if (intent.kind === 'chat') {
            let cancelled = false;
            void (async () => {
                try {
                    const chat = await api.getChat(intent.chatId);
                    if (cancelled) return;
                    setActiveTab('chats');
                    openChatScreen(chat);
                } finally {
                    if (!cancelled) consumeIntent();
                }
            })();
            return () => {
                cancelled = true;
            };
        }

        if (intent.kind === 'group') {
            setCommunitySurface('groups');
            setActiveTab('community');
            navigation.navigate('GroupDetail', {
                groupId: intent.groupId,
                focusPostRequest: intent.postId ? { postId: intent.postId, nonce: Date.now() } : undefined,
            });
            consumeIntent();
            return;
        }

        if (intent.kind === 'group_admin_inbox') {
            setCommunitySurface('groups');
            setActiveTab('community');
            if (intent.threadId) {
                navigation.navigate('GroupAdminThread', {
                    groupId: intent.groupId,
                    threadId: intent.threadId,
                });
                consumeIntent();
                return;
            }
            navigation.navigate('GroupDetail', {
                groupId: intent.groupId,
                initialAdminTab: 'inbox',
            });
            consumeIntent();
            return;
        }

        if (intent.kind === 'group_report') {
            setCommunitySurface('groups');
            setActiveTab('community');
            navigation.navigate('GroupDetail', {
                groupId: intent.groupId,
                initialAdminTab: 'reports',
            });
            consumeIntent();
            return;
        }

        if (intent.kind === 'support_request') {
            setCommunitySurface('groups');
            setActiveTab('community');
            navigation.navigate('GroupDetail', {
                groupId: intent.groupId,
                focusSupportRequest: {
                    requestId: intent.supportRequestId,
                    postId: intent.postId,
                    nonce: Date.now(),
                },
            });
            consumeIntent();
            return;
        }

        setActiveTab('feed');
        setFeedFocusRequest({
            postId: intent.postId,
            commentId: intent.commentId,
            nonce: Date.now(),
        });
        consumeIntent();
    }, [consumeIntent, intent, navigation, openChatScreen]);

    const header = useMemo(() => {
        if (activeTab === 'profile') return null;

        const titles: Record<MainTab, React.ReactNode> = {
            feed: (
                <Text style={styles.wordmark}>
                    Sober<Text style={styles.wordmarkAccent}>Space</Text>
                </Text>
            ),
            discover: <Text style={styles.pageTitle}>Discover</Text>,
            community: <Text style={styles.pageTitle}>Community</Text>,
            chats: <Text style={styles.pageTitle}>Chats</Text>,
        };

        return (
            <View style={styles.topBar}>
                {titles[activeTab]}
                <View style={styles.topBarActions}>
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
        activeTab, notificationSummary?.unread_count,
        openNotifications, openOwnProfile, user,
    ]);

    const isOverlayOpen = false;
    const hidesBottomNav = false;
    const canShowGlobalCreate = Boolean(user) && !hidesBottomNav && !keyboardVisible;
    const tabBarBottomPadding = Platform.OS === 'android'
        ? Math.max(insets.bottom - 12, Spacing.xs)
        : Math.max(insets.bottom, Spacing.sm);

    const openGlobalCreateMenu = useCallback((): void => {
        setCreateMenuOpen(true);
    }, []);

    const closeGlobalCreateMenu = useCallback((): void => {
        setCreateMenuOpen(false);
    }, []);

    const globalCreateActions = useMemo<GlobalCreateAction[]>(() => [
        {
            key: 'post',
            title: 'Post',
            description: 'Share an update with the community.',
            icon: 'create-outline',
            onPress: openCreatePost,
        },
        {
            key: 'support_request',
            title: 'Support request',
            description: 'Ask the community for help right now.',
            icon: 'heart-outline',
            onPress: openCreateSupportRequest,
        },
        {
            key: 'meetup',
            title: 'Meetup',
            description: 'Host a sober event or gathering.',
            icon: 'calendar-outline',
            onPress: openCreateMeetup,
        },
        {
            key: 'group',
            title: 'Group',
            description: 'Start a focused recovery space.',
            icon: 'people-outline',
            onPress: openCreateGroup,
        },
    ], [openCreateGroup, openCreateMeetup, openCreatePost, openCreateSupportRequest]);

    useEffect(() => {
        if (!canShowGlobalCreate && createMenuOpen) {
            setCreateMenuOpen(false);
        }
    }, [canShowGlobalCreate, createMenuOpen]);

    return (
        <>
            <StatusBar style="light" />
            <SafeAreaView style={styles.container} edges={['top']}>
                {header}
                <View style={styles.content}>
                    <FeedTab
                        isActive={activeTab === 'feed' && !isOverlayOpen}
                        onOpenUserProfile={handleOpenUserProfile}
                        onOpenComments={handleOpenComments}
                        focusRequest={feedFocusRequest}
                        onFocusRequestConsumed={handleFeedFocusRequestConsumed}
                    />
                    <DiscoverTab
                        isActive={activeTab === 'discover' && !isOverlayOpen}
                        onOpenUserProfile={handleOpenUserProfile}
                        onOpenChat={openChatScreen}
                        onOpenRecoveryMeeting={handleOpenRecoveryMeeting}
                        onOpenDatingLikes={() => navigation.navigate('DatingLikes')}
                        onOpenDatingMatches={() => navigation.navigate('DatingMatches')}
                        onOpenDatingProfileEditor={() => navigation.navigate('DatingProfileEditor')}
                    />
                    <CommunityTab
                        isActive={activeTab === 'community' && !isOverlayOpen}
                        activeSurface={communitySurface}
                        onChangeSurface={setCommunitySurface}
                        onOpenGroup={handleOpenGroup}
                        onOpenMeetup={handleOpenMeetup}
                        onOpenManageMeetup={openManageMeetup}
                    />
                    <ChatsTab isActive={activeTab === 'chats' && !isOverlayOpen} onOpenChat={openChatScreen} />
                    <ProfileTab
                        isActive={activeTab === 'profile' && !isOverlayOpen}
                        initialContentTab={ownProfileInitialContentTab}
                        resetKey={ownProfileResetKey}
                        onBack={closeOwnProfile}
                        onOpenUserProfile={handleOpenUserProfile}
                        onOpenComments={handleOpenComments}
                    />
                </View>

                {!hidesBottomNav && !keyboardVisible && (
                    <View style={[styles.tabBar, { paddingBottom: tabBarBottomPadding }]}>
                        {TABS.slice(0, 2).map(tab => (
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
                        <View style={styles.createTabSlot}>
                            <CenterCreateButton
                                visible={canShowGlobalCreate}
                                onPress={openGlobalCreateMenu}
                            />
                        </View>
                        {TABS.slice(2).map(tab => (
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

            <CreateActionSheet
                visible={createMenuOpen && canShowGlobalCreate}
                actions={globalCreateActions}
                onClose={closeGlobalCreateMenu}
            />

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
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.sm,
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
        width: ControlSizes.iconButton,
        height: ControlSizes.iconButton,
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
        ...TextStyles.badge,
        color: Colors.textOn.danger,
    },

    tabBar: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderTopWidth: 1,
        borderTopColor: Colors.border.subtle,
        paddingTop: Spacing.sm,
        backgroundColor: Colors.bg.page,
        overflow: 'visible',
    },
    tabItem: { flex: 1, alignItems: 'center', gap: 4, minHeight: 44 },
    createTabSlot: {
        width: 74,
        alignItems: 'center',
        minHeight: 44,
        overflow: 'visible',
    },
    tabLabel: { fontSize: Typography.sizes.sm, color: Colors.text.muted },
    tabLabelActive: { color: Colors.primary },
});
