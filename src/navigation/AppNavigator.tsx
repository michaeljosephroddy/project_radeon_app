import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AppState,
    Keyboard,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getDeviceCoords, reverseGeocodePlace } from '../utils/location';
import type { CommentThreadTarget } from '../screens/main/feed/FeedCommentsScreen';
import { FeedScreen } from '../screens/main/FeedScreen';
import { DiscoverScreen } from '../screens/main/DiscoverScreen';
import { CommunityHubScreen, type CommunityHubSurface } from '../screens/main/CommunityHubScreen';
import { ChatsScreen } from '../screens/main/ChatsScreen';
import { ProfileTabScreen } from '../screens/main/ProfileTabScreen';
import { Avatar } from '../components/Avatar';
import { CenterCreateButton } from '../components/create/CenterCreateButton';
import type { ProfileContentTabKey } from '../components/profile/ProfileContentTabs';
import * as api from '../api/client';
import { AvatarSizes, Colors, ControlSizes, IconSizes, Radius, Spacing, TargetSizes, TextStyles, Typography } from '../theme';
import { useAuth } from '../hooks/useAuth';
import { useNotificationSummary } from '../hooks/queries/useNotificationSummary';
import { useNotificationIntent } from '../notifications/NotificationProvider';
import type { Chat } from '../api/client';
import type { MainTabParamList, RootStackParamList } from './types';

interface OpenUserProfile {
    userId: string;
    username: string;
    avatarUrl?: string;
}

type PrimaryTabRouteName = 'FeedTab' | 'DiscoverTab' | 'CommunityTab' | 'ChatsTab';
type MainTabsRouteParam = NonNullable<NonNullable<RootStackParamList['MainTabs']>['tab']>;

const MainTabs = createBottomTabNavigator<MainTabParamList>();
const FeedStack = createNativeStackNavigator<{ FeedHome: undefined }>();
const DiscoverStack = createNativeStackNavigator<{ DiscoverHome: undefined }>();
const CommunityStack = createNativeStackNavigator<{ CommunityHome: undefined }>();
const ChatsStack = createNativeStackNavigator<{ ChatsHome: undefined }>();
const ProfileStack = createNativeStackNavigator<{ ProfileHome: undefined }>();

const PRIMARY_TABS: Array<{
    key: PrimaryTabRouteName;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconActive: keyof typeof Ionicons.glyphMap;
}> = [
    { key: 'FeedTab', label: 'feed', icon: 'newspaper-outline', iconActive: 'newspaper' },
    { key: 'DiscoverTab', label: 'discover', icon: 'grid-outline', iconActive: 'grid' },
    { key: 'CommunityTab', label: 'community', icon: 'people-outline', iconActive: 'people' },
    { key: 'ChatsTab', label: 'chats', icon: 'chatbubble-outline', iconActive: 'chatbubble' },
];

const ROOT_TAB_TO_ROUTE: Record<MainTabsRouteParam, PrimaryTabRouteName> = {
    feed: 'FeedTab',
    discover: 'DiscoverTab',
    community: 'CommunityTab',
    chats: 'ChatsTab',
};

function badgeLabel(count: number): string {
    return count > 99 ? '99+' : String(count);
}

interface SharedTabProps {
    user?: api.User | null;
    notificationCount: number;
    onOpenNotifications: () => void;
    onOpenOwnProfile: (from: PrimaryTabRouteName) => void;
    onOpenUserProfile: (profile: OpenUserProfile) => void;
    onOpenComments: (thread: CommentThreadTarget, focusComposer: boolean, onCommentCreated?: (comment: api.Comment) => void) => void;
}

interface MainTabFrameProps {
    routeName: PrimaryTabRouteName;
    title: React.ReactNode;
    children: React.ReactNode;
    user?: api.User | null;
    notificationCount: number;
    onOpenNotifications: () => void;
    onOpenOwnProfile: (from: PrimaryTabRouteName) => void;
}

function MainTabFrame({
    routeName,
    title,
    children,
    user,
    notificationCount,
    onOpenNotifications,
    onOpenOwnProfile,
}: MainTabFrameProps): React.ReactElement {
    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.topBar}>
                {title}
                <View style={styles.topBarActions}>
                    <TouchableOpacity
                        style={styles.headerIconButton}
                        onPress={onOpenNotifications}
                        disabled={!user}
                        accessibilityRole="button"
                        accessibilityLabel="Open notifications"
                    >
                        <Ionicons name="notifications-outline" size={IconSizes.tool} color={Colors.text.primary} />
                        {notificationCount > 0 ? (
                            <View style={styles.notificationBadge}>
                                <Text style={styles.notificationBadgeText}>{badgeLabel(notificationCount)}</Text>
                            </View>
                        ) : null}
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => onOpenOwnProfile(routeName)}
                        disabled={!user}
                        accessibilityRole="button"
                        accessibilityLabel="Open profile"
                    >
                        <Avatar
                            username={user?.username ?? 'me'}
                            avatarUrl={user?.avatar_url}
                            size={AvatarSizes.comment}
                            fontSize={TextStyles.caption.fontSize}
                        />
                    </TouchableOpacity>
                </View>
            </View>
            <View style={styles.content}>
                {children}
            </View>
        </SafeAreaView>
    );
}

function FeedHomeScreen({
    shared,
    focusRequest,
    onFocusRequestConsumed,
}: {
    shared: SharedTabProps;
    focusRequest: { postId: string; commentId?: string; nonce: number } | null;
    onFocusRequestConsumed: (nonce: number) => void;
}): React.ReactElement {
    const isFocused = useIsFocused();

    return (
        <MainTabFrame
            routeName="FeedTab"
            title={(
                <Text style={styles.wordmark}>
                    Sober<Text style={styles.wordmarkAccent}>Space</Text>
                </Text>
            )}
            user={shared.user}
            notificationCount={shared.notificationCount}
            onOpenNotifications={shared.onOpenNotifications}
            onOpenOwnProfile={shared.onOpenOwnProfile}
        >
            <FeedScreen
                isActive={isFocused}
                onOpenUserProfile={shared.onOpenUserProfile}
                onOpenComments={shared.onOpenComments}
                focusRequest={focusRequest}
                onFocusRequestConsumed={onFocusRequestConsumed}
            />
        </MainTabFrame>
    );
}

function DiscoverHomeScreen({
    shared,
    onOpenChat,
    onOpenRecoveryMeeting,
}: {
    shared: SharedTabProps;
    onOpenChat: (chat: Chat) => void;
    onOpenRecoveryMeeting: (meeting: api.RecoveryMeeting) => void;
}): React.ReactElement {
    const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const isFocused = useIsFocused();

    return (
        <MainTabFrame
            routeName="DiscoverTab"
            title={<Text style={styles.pageTitle}>Discover</Text>}
            user={shared.user}
            notificationCount={shared.notificationCount}
            onOpenNotifications={shared.onOpenNotifications}
            onOpenOwnProfile={shared.onOpenOwnProfile}
        >
            <DiscoverScreen
                isActive={isFocused}
                onOpenUserProfile={shared.onOpenUserProfile}
                onOpenChat={onOpenChat}
                onOpenRecoveryMeeting={onOpenRecoveryMeeting}
                onOpenDatingLikes={() => rootNavigation.navigate('DatingLikes')}
                onOpenDatingMatches={() => rootNavigation.navigate('DatingMatches')}
                onOpenDatingProfileEditor={() => rootNavigation.navigate('DatingProfileEditor')}
                onOpenDatingProfile={(profile) => rootNavigation.navigate('DatingProfileDetail', {
                    profileId: profile.id,
                    initialProfile: profile,
                })}
            />
        </MainTabFrame>
    );
}

function CommunityHomeScreen({
    shared,
    activeSurface,
    onChangeSurface,
    onOpenGroup,
    onOpenChat,
    focusSignalId,
    onOpenMeetup,
    onOpenManageMeetup,
}: {
    shared: SharedTabProps;
    activeSurface: CommunityHubSurface;
    onChangeSurface: (surface: CommunityHubSurface) => void;
    onOpenGroup: (groupId: string) => void;
    onOpenChat: (chat: api.Chat) => void;
    focusSignalId: string | null;
    onOpenMeetup: (meetup: api.Meetup) => void;
    onOpenManageMeetup: (meetup: api.Meetup) => void;
}): React.ReactElement {
    const isFocused = useIsFocused();

    return (
        <MainTabFrame
            routeName="CommunityTab"
            title={<Text style={styles.pageTitle}>Community</Text>}
            user={shared.user}
            notificationCount={shared.notificationCount}
            onOpenNotifications={shared.onOpenNotifications}
            onOpenOwnProfile={shared.onOpenOwnProfile}
        >
            <CommunityHubScreen
                isActive={isFocused}
                activeSurface={activeSurface}
                onChangeSurface={onChangeSurface}
                onOpenGroup={onOpenGroup}
                onOpenChat={onOpenChat}
                focusSignalId={focusSignalId}
                onOpenMeetup={onOpenMeetup}
                onOpenManageMeetup={onOpenManageMeetup}
            />
        </MainTabFrame>
    );
}

function ChatsHomeScreen({
    shared,
    onOpenChat,
}: {
    shared: SharedTabProps;
    onOpenChat: (chat: Chat) => void;
}): React.ReactElement {
    const isFocused = useIsFocused();

    return (
        <MainTabFrame
            routeName="ChatsTab"
            title={<Text style={styles.pageTitle}>Chats</Text>}
            user={shared.user}
            notificationCount={shared.notificationCount}
            onOpenNotifications={shared.onOpenNotifications}
            onOpenOwnProfile={shared.onOpenOwnProfile}
        >
            <ChatsScreen isActive={isFocused} onOpenChat={onOpenChat} />
        </MainTabFrame>
    );
}

function ProfileHomeScreen({
    initialContentTab,
    resetKey,
    onBack,
    onOpenUserProfile,
    onOpenComments,
}: {
    initialContentTab: ProfileContentTabKey;
    resetKey: number;
    onBack: () => void;
    onOpenUserProfile: (profile: OpenUserProfile) => void;
    onOpenComments: (thread: CommentThreadTarget, focusComposer: boolean, onCommentCreated?: (comment: api.Comment) => void) => void;
}): React.ReactElement {
    const isFocused = useIsFocused();

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ProfileTabScreen
                isActive={isFocused}
                initialContentTab={initialContentTab}
                resetKey={resetKey}
                onBack={onBack}
                onOpenUserProfile={onOpenUserProfile}
                onOpenComments={onOpenComments}
            />
        </SafeAreaView>
    );
}

function MainTabBar({
    state,
    navigation,
    keyboardVisible,
    canShowGlobalCreate,
    onOpenCreate,
    bottomPadding,
}: BottomTabBarProps & {
    keyboardVisible: boolean;
    canShowGlobalCreate: boolean;
    onOpenCreate: () => void;
    bottomPadding: number;
}): React.ReactElement | null {
    const activeRouteName = state.routes[state.index]?.name as keyof MainTabParamList | undefined;
    if (keyboardVisible || activeRouteName === 'ProfileTab') {
        return null;
    }

    const renderTab = (tab: typeof PRIMARY_TABS[number]): React.ReactElement => {
        const active = activeRouteName === tab.key;
        return (
            <TouchableOpacity
                key={tab.key}
                style={styles.tabItem}
                onPress={() => navigation.navigate(tab.key)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${tab.label}`}
            >
                <Ionicons
                    name={active ? tab.iconActive : tab.icon}
                    size={IconSizes.tool}
                    color={active ? Colors.primary : Colors.text.muted}
                />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                    {tab.label}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.tabBar, { paddingBottom: bottomPadding }]}>
            {PRIMARY_TABS.slice(0, 2).map(renderTab)}
            <View style={styles.createTabSlot}>
                <CenterCreateButton
                    visible={canShowGlobalCreate}
                    onPress={onOpenCreate}
                />
            </View>
            {PRIMARY_TABS.slice(2).map(renderTab)}
        </View>
    );
}

export function AppNavigator(): React.ReactElement {
    const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'MainTabs'>>();
    const tabNavigationRef = useRef<BottomTabBarProps['navigation'] | null>(null);
    const syncingLocation = useRef(false);
    const { user, refreshUser } = useAuth();
    const { intent, consumeIntent } = useNotificationIntent();
    const notificationSummaryQuery = useNotificationSummary(Boolean(user?.id));
    const notificationSummary = notificationSummaryQuery.data;
    const insets = useSafeAreaInsets();
    const [communitySurface, setCommunitySurface] = useState<CommunityHubSurface>('reach_out');
    const [communityFocusSignalId, setCommunityFocusSignalId] = useState<string | null>(null);
    const [ownProfileInitialContentTab, setOwnProfileInitialContentTab] = useState<ProfileContentTabKey>('posts');
    const [ownProfileResetKey, setOwnProfileResetKey] = useState(0);
    const [previousMainTab, setPreviousMainTab] = useState<PrimaryTabRouteName>('FeedTab');
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [feedFocusRequest, setFeedFocusRequest] = useState<{ postId: string; commentId?: string; nonce: number } | null>(null);

    const navigateMainTab = useCallback((tab: PrimaryTabRouteName | 'ProfileTab'): void => {
        tabNavigationRef.current?.navigate(tab);
    }, []);

    const openChatScreen = useCallback((chat: Chat): void => {
        Keyboard.dismiss();
        rootNavigation.navigate('Chat', { chat });
    }, [rootNavigation]);

    const handleOpenUserProfile = useCallback((profile: OpenUserProfile): void => {
        rootNavigation.navigate('UserProfile', profile);
    }, [rootNavigation]);

    const handleOpenMeetup = useCallback((meetup: api.Meetup): void => {
        rootNavigation.navigate('MeetupDetail', { meetup });
    }, [rootNavigation]);

    const handleOpenRecoveryMeeting = useCallback((meeting: api.RecoveryMeeting): void => {
        rootNavigation.navigate('RecoveryMeetingDetail', { meeting });
    }, [rootNavigation]);

    const openNotifications = useCallback((): void => {
        rootNavigation.navigate('Notifications');
    }, [rootNavigation]);

    const handleOpenGroup = useCallback((groupId: string, postId?: string): void => {
        rootNavigation.navigate('GroupDetail', {
            groupId,
            focusPostRequest: postId ? { postId, nonce: Date.now() } : undefined,
        });
    }, [rootNavigation]);

    const handleOpenComments = useCallback((
        thread: CommentThreadTarget,
        focusComposer: boolean,
        _onCommentCreated?: (comment: api.Comment) => void,
    ): void => {
        rootNavigation.navigate('FeedComments', { thread, focusComposer });
    }, [rootNavigation]);

    const openManageMeetup = useCallback((meetup: api.Meetup): void => {
        rootNavigation.navigate('CreateMeetup', { meetup });
    }, [rootNavigation]);

    const handleOpenOwnProfile = useCallback((from: PrimaryTabRouteName): void => {
        setPreviousMainTab(from);
        setOwnProfileInitialContentTab('posts');
        setOwnProfileResetKey((current) => current + 1);
        navigateMainTab('ProfileTab');
    }, [navigateMainTab]);

    const closeOwnProfile = useCallback((): void => {
        navigateMainTab(previousMainTab);
    }, [navigateMainTab, previousMainTab]);

    const handleFeedFocusRequestConsumed = useCallback((nonce: number): void => {
        setFeedFocusRequest((current) => (
            current?.nonce === nonce ? null : current
        ));
    }, []);

    useEffect(() => {
        if (!user?.id) return;

        const syncLocation = async (): Promise<void> => {
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
                // Background sync failures are non-critical.
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

    useEffect(() => {
        const willShowSub = Keyboard.addListener('keyboardWillShow', () => setKeyboardVisible(true));
        const didShowSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
        const willHideSub = Keyboard.addListener('keyboardWillHide', () => setKeyboardVisible(false));
        const didHideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));

        return () => {
            willShowSub.remove();
            didShowSub.remove();
            willHideSub.remove();
            didHideSub.remove();
        };
    }, []);

    useEffect(() => {
        const requestedTab = route.params?.tab;
        const requestedCommunitySurface = route.params?.communitySurface;
        const requestedCommunityFocusSignalId = route.params?.communityFocusSignalId;
        const requestedFocus = route.params?.feedFocusRequest;
        if (!requestedTab && !requestedFocus && !requestedCommunitySurface && !requestedCommunityFocusSignalId) return;

        if (requestedTab) {
            navigateMainTab(ROOT_TAB_TO_ROUTE[requestedTab]);
        }
        if (requestedCommunitySurface) {
            setCommunitySurface(requestedCommunitySurface);
        }
        if (requestedCommunityFocusSignalId) {
            setCommunityFocusSignalId(requestedCommunityFocusSignalId);
        }
        if (requestedFocus) {
            navigateMainTab('FeedTab');
            setFeedFocusRequest(requestedFocus);
        }
        rootNavigation.setParams({
            tab: undefined,
            communitySurface: undefined,
            communityFocusSignalId: undefined,
            feedFocusRequest: undefined,
        });
    }, [
        navigateMainTab,
        rootNavigation,
        route.params?.communityFocusSignalId,
        route.params?.communitySurface,
        route.params?.feedFocusRequest,
        route.params?.tab,
    ]);

    useEffect(() => {
        if (!intent) return;

        if (intent.kind === 'chat') {
            let cancelled = false;
            void (async (): Promise<void> => {
                try {
                    const chat = await api.getChat(intent.chatId);
                    if (cancelled) return;
                    navigateMainTab('ChatsTab');
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
            navigateMainTab('CommunityTab');
            rootNavigation.navigate('GroupDetail', {
                groupId: intent.groupId,
                focusPostRequest: intent.postId ? { postId: intent.postId, nonce: Date.now() } : undefined,
            });
            consumeIntent();
            return;
        }

        if (intent.kind === 'group_admin_inbox') {
            setCommunitySurface('groups');
            navigateMainTab('CommunityTab');
            if (intent.threadId) {
                rootNavigation.navigate('GroupAdminThread', {
                    groupId: intent.groupId,
                    threadId: intent.threadId,
                });
                consumeIntent();
                return;
            }
            rootNavigation.navigate('GroupDetail', {
                groupId: intent.groupId,
                initialAdminTab: 'inbox',
            });
            consumeIntent();
            return;
        }

        if (intent.kind === 'group_report') {
            setCommunitySurface('groups');
            navigateMainTab('CommunityTab');
            rootNavigation.navigate('GroupDetail', {
                groupId: intent.groupId,
                initialAdminTab: 'reports',
            });
            consumeIntent();
            return;
        }

        if (intent.kind === 'support_request') {
            setCommunitySurface('groups');
            navigateMainTab('CommunityTab');
            rootNavigation.navigate('GroupDetail', {
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

        if (intent.kind === 'support_signal') {
            if (intent.chatId) {
                let cancelled = false;
                void (async (): Promise<void> => {
                    try {
                        const chat = await api.getChat(intent.chatId ?? '');
                        if (cancelled) return;
                        navigateMainTab('ChatsTab');
                        openChatScreen(chat);
                    } finally {
                        if (!cancelled) consumeIntent();
                    }
                })();
                return () => {
                    cancelled = true;
                };
            }
            setCommunitySurface('reach_out');
            setCommunityFocusSignalId(intent.signalId ?? null);
            navigateMainTab('CommunityTab');
            consumeIntent();
            return;
        }

        navigateMainTab('FeedTab');
        setFeedFocusRequest({
            postId: intent.postId,
            commentId: intent.commentId,
            nonce: Date.now(),
        });
        consumeIntent();
    }, [consumeIntent, intent, navigateMainTab, openChatScreen, rootNavigation]);

    const openGlobalCreateMenu = useCallback((): void => {
        Keyboard.dismiss();
        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
        rootNavigation.navigate('CreateMenu');
    }, [rootNavigation]);

    const canShowGlobalCreate = Boolean(user) && !keyboardVisible;
    const tabBarBottomPadding = Platform.OS === 'android'
        ? Math.max(insets.bottom - 12, Spacing.xs)
        : Math.max(insets.bottom, Spacing.sm);
    const notificationCount = notificationSummary?.unread_count ?? 0;
    const sharedTabProps = useMemo<SharedTabProps>(() => ({
        user,
        notificationCount,
        onOpenNotifications: openNotifications,
        onOpenOwnProfile: handleOpenOwnProfile,
        onOpenUserProfile: handleOpenUserProfile,
        onOpenComments: handleOpenComments,
    }), [
        handleOpenComments,
        handleOpenOwnProfile,
        handleOpenUserProfile,
        notificationCount,
        openNotifications,
        user,
    ]);

    return (
        <>
            <StatusBar style="light" />
            <MainTabs.Navigator
                initialRouteName="FeedTab"
                detachInactiveScreens={false}
                screenOptions={{
                    headerShown: false,
                    lazy: false,
                }}
                tabBar={(props) => {
                    tabNavigationRef.current = props.navigation;
                    return (
                        <MainTabBar
                            {...props}
                            keyboardVisible={keyboardVisible}
                            canShowGlobalCreate={canShowGlobalCreate}
                            onOpenCreate={openGlobalCreateMenu}
                            bottomPadding={tabBarBottomPadding}
                        />
                    );
                }}
            >
                <MainTabs.Screen name="FeedTab">
                    {() => (
                        <FeedStack.Navigator screenOptions={{ headerShown: false }}>
                            <FeedStack.Screen name="FeedHome">
                                {() => (
                                    <FeedHomeScreen
                                        shared={sharedTabProps}
                                        focusRequest={feedFocusRequest}
                                        onFocusRequestConsumed={handleFeedFocusRequestConsumed}
                                    />
                                )}
                            </FeedStack.Screen>
                        </FeedStack.Navigator>
                    )}
                </MainTabs.Screen>
                <MainTabs.Screen name="DiscoverTab">
                    {() => (
                        <DiscoverStack.Navigator screenOptions={{ headerShown: false }}>
                            <DiscoverStack.Screen name="DiscoverHome">
                                {() => (
                                    <DiscoverHomeScreen
                                        shared={sharedTabProps}
                                        onOpenChat={openChatScreen}
                                        onOpenRecoveryMeeting={handleOpenRecoveryMeeting}
                                    />
                                )}
                            </DiscoverStack.Screen>
                        </DiscoverStack.Navigator>
                    )}
                </MainTabs.Screen>
                <MainTabs.Screen name="CommunityTab">
                    {() => (
                        <CommunityStack.Navigator screenOptions={{ headerShown: false }}>
                            <CommunityStack.Screen name="CommunityHome">
                                {() => (
                                    <CommunityHomeScreen
                                        shared={sharedTabProps}
                                        activeSurface={communitySurface}
                                        onChangeSurface={setCommunitySurface}
                                        onOpenGroup={handleOpenGroup}
                                        onOpenChat={openChatScreen}
                                        focusSignalId={communityFocusSignalId}
                                        onOpenMeetup={handleOpenMeetup}
                                        onOpenManageMeetup={openManageMeetup}
                                    />
                                )}
                            </CommunityStack.Screen>
                        </CommunityStack.Navigator>
                    )}
                </MainTabs.Screen>
                <MainTabs.Screen name="ChatsTab">
                    {() => (
                        <ChatsStack.Navigator screenOptions={{ headerShown: false }}>
                            <ChatsStack.Screen name="ChatsHome">
                                {() => (
                                    <ChatsHomeScreen
                                        shared={sharedTabProps}
                                        onOpenChat={openChatScreen}
                                    />
                                )}
                            </ChatsStack.Screen>
                        </ChatsStack.Navigator>
                    )}
                </MainTabs.Screen>
                <MainTabs.Screen name="ProfileTab">
                    {() => (
                        <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
                            <ProfileStack.Screen name="ProfileHome">
                                {() => (
                                    <ProfileHomeScreen
                                        initialContentTab={ownProfileInitialContentTab}
                                        resetKey={ownProfileResetKey}
                                        onBack={closeOwnProfile}
                                        onOpenUserProfile={handleOpenUserProfile}
                                        onOpenComments={handleOpenComments}
                                    />
                                )}
                            </ProfileStack.Screen>
                        </ProfileStack.Navigator>
                    )}
                </MainTabs.Screen>
            </MainTabs.Navigator>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    content: {
        flex: 1,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.sm,
        backgroundColor: Colors.bg.page,
    },
    wordmark: {
        ...TextStyles.sectionTitle,
        color: Colors.text.primary,
    },
    wordmarkAccent: {
        color: Colors.primary,
    },
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
    tabItem: {
        flex: 1,
        alignItems: 'center',
        gap: Spacing.xs,
        minHeight: TargetSizes.minimum,
    },
    createTabSlot: {
        width: 74,
        alignItems: 'center',
        minHeight: TargetSizes.minimum,
        overflow: 'visible',
    },
    tabLabel: {
        ...TextStyles.caption,
        color: Colors.text.muted,
    },
    tabLabelActive: {
        color: Colors.primary,
    },
});

function triggerHaptic(style: Haptics.ImpactFeedbackStyle): void {
    try {
        Haptics.impactAsync(style).catch(() => {});
    } catch {
        // Haptics are optional in development builds.
    }
}
