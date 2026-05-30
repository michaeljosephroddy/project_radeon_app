import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { DarkTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { AppNavigator } from './AppNavigator';
import { AuthNavigator } from './AuthNavigator';
import { OnboardingNavigator } from './OnboardingNavigator';
import { ChatScreen } from '../screens/main/ChatScreen';
import { UserProfileScreen } from '../screens/main/UserProfileScreen';
import { ComposeDMScreen } from '../screens/main/ComposeDMScreen';
import { CreatePostScreen } from '../screens/main/CreatePostScreen';
import { GroupCreateScreen } from '../screens/main/groups/GroupCreateScreen';
import { CreateSupportRequestScreen } from '../screens/main/CreateSupportRequestScreen';
import { CreateMeetupScreen } from '../screens/main/CreateMeetupScreen';
import { MeetupDetailScreen } from '../screens/main/MeetupDetailScreen';
import { RecoveryMeetingDetailScreen } from '../screens/main/support/RecoveryMeetingDetailScreen';
import { GroupDetailScreen } from '../screens/main/groups/GroupDetailScreen';
import { GroupAdminThreadScreen } from '../screens/main/groups/GroupAdminThreadScreen';
import { GroupCommentsScreen } from '../screens/main/groups/GroupCommentsScreen';
import { FeedCommentsScreen } from '../screens/main/feed/FeedCommentsScreen';
import { NotificationsScreen } from '../screens/main/NotificationsScreen';
import { DatingLikesRouteScreen } from '../screens/main/dating/DatingLikesRouteScreen';
import { DatingMatchesRouteScreen } from '../screens/main/dating/DatingMatchesRouteScreen';
import { DatingProfileDetailRouteScreen } from '../screens/main/dating/DatingProfileDetailRouteScreen';
import { DatingProfileEditorRouteScreen } from '../screens/main/dating/DatingProfileEditorRouteScreen';
import { ChatRealtimeProvider } from '../hooks/chat/ChatRealtimeProvider';
import { useAuth } from '../hooks/useAuth';
import { useGroup } from '../hooks/queries/useGroups';
import { NotificationProvider } from '../notifications/NotificationProvider';
import { Colors } from '../theme';
import * as api from '../api/client';
import type { Chat } from '../api/client';
import type { RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme: Theme = {
    ...DarkTheme,
    colors: {
        ...DarkTheme.colors,
        primary: Colors.primary,
        background: Colors.bg.page,
        card: Colors.bg.page,
        text: Colors.text.primary,
        border: Colors.border.emphasis,
        notification: Colors.danger,
    },
};

export function RootNavigation(): React.ReactElement {
    const { isAuthenticated, isLoading, isNewUser } = useAuth();

    if (isLoading) {
        return (
            <View style={styles.fullScreenLoading}>
                <ActivityIndicator color={Colors.primary} />
            </View>
        );
    }

    return (
        <NavigationContainer theme={navigationTheme}>
            {!isAuthenticated ? (
                <AuthNavigator />
            ) : isNewUser ? (
                <OnboardingNavigator />
            ) : (
                <ChatRealtimeProvider>
                    <NotificationProvider>
                        <RootStack.Navigator screenOptions={{ headerShown: false }}>
                            <RootStack.Screen name="MainTabs" component={AppNavigator} />
                            <RootStack.Screen name="Chat" component={RootChatScreen} />
                            <RootStack.Screen name="UserProfile" component={RootUserProfileScreen} />
                            <RootStack.Screen name="ComposeDM" component={RootComposeDMScreen} />
                            <RootStack.Screen name="CreatePost" component={RootCreatePostScreen} />
                            <RootStack.Screen name="CreateGroup" component={RootCreateGroupScreen} />
                            <RootStack.Screen name="CreateSupportRequest" component={RootCreateSupportRequestScreen} />
                            <RootStack.Screen name="CreateMeetup" component={RootCreateMeetupScreen} />
                            <RootStack.Screen name="MeetupDetail" component={RootMeetupDetailScreen} />
                            <RootStack.Screen name="RecoveryMeetingDetail" component={RootRecoveryMeetingDetailScreen} />
                            <RootStack.Screen name="GroupDetail" component={RootGroupDetailScreen} />
                            <RootStack.Screen name="GroupAdminThread" component={RootGroupAdminThreadScreen} />
                            <RootStack.Screen name="GroupComments" component={RootGroupCommentsScreen} />
                            <RootStack.Screen name="Notifications" component={RootNotificationsScreen} />
                            <RootStack.Screen name="FeedComments" component={RootFeedCommentsScreen} />
                            <RootStack.Screen name="DatingLikes" component={RootDatingLikesScreen} />
                            <RootStack.Screen name="DatingMatches" component={RootDatingMatchesScreen} />
                            <RootStack.Screen name="DatingProfileDetail" component={RootDatingProfileDetailScreen} />
                            <RootStack.Screen name="DatingProfileEditor" component={RootDatingProfileEditorScreen} />
                        </RootStack.Navigator>
                    </NotificationProvider>
                </ChatRealtimeProvider>
            )}
        </NavigationContainer>
    );
}

function RootChatScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'Chat'>): React.ReactElement {
    const [chat, setChat] = React.useState<Chat | null>('chat' in route.params ? route.params.chat : null);

    React.useEffect(() => {
        if ('chat' in route.params) {
            setChat(route.params.chat);
            return undefined;
        }

        let cancelled = false;
        void api.getChat(route.params.chatId)
            .then((loadedChat) => {
                if (!cancelled) setChat(loadedChat);
            })
            .catch(() => {
                if (!cancelled) navigation.goBack();
            });

        return () => {
            cancelled = true;
        };
    }, [navigation, route.params]);

    if (!chat) {
        return (
            <RootStackScreenFrame centered>
                <ActivityIndicator color={Colors.primary} />
            </RootStackScreenFrame>
        );
    }

    return (
        <RootStackScreenFrame>
            <ChatScreen
                chat={chat}
                onBack={() => navigation.goBack()}
            />
        </RootStackScreenFrame>
    );
}

function RootComposeDMScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'ComposeDM'>): React.ReactElement {
    return (
        <RootStackScreenFrame>
            <ComposeDMScreen
                recipientId={route.params.recipientId}
                username={route.params.username}
                avatarUrl={route.params.avatarUrl}
                onBack={() => navigation.goBack()}
                onComplete={(chat) => navigation.replace('Chat', { chat })}
            />
        </RootStackScreenFrame>
    );
}

function RootCreatePostScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'CreatePost'>): React.ReactElement {
    return (
        <RootStackScreenFrame>
            <CreatePostScreen onBack={() => navigation.goBack()} />
        </RootStackScreenFrame>
    );
}

function RootCreateGroupScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'CreateGroup'>): React.ReactElement {
    return (
        <RootStackScreenFrame>
            <GroupCreateScreen
                onBack={() => navigation.goBack()}
                onCreated={(group) => navigation.replace('GroupDetail', { groupId: group.id })}
            />
        </RootStackScreenFrame>
    );
}

function RootCreateSupportRequestScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'CreateSupportRequest'>): React.ReactElement {
    return (
        <RootStackScreenFrame>
            <CreateSupportRequestScreen
                onBack={() => navigation.goBack()}
                onCreated={() => navigation.goBack()}
            />
        </RootStackScreenFrame>
    );
}

function RootCreateMeetupScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'CreateMeetup'>): React.ReactElement {
    return (
        <RootStackScreenFrame>
            <CreateMeetupScreen
                onBack={() => navigation.goBack()}
                onCreated={() => navigation.goBack()}
                meetup={route.params?.meetup}
                onUpdated={() => navigation.goBack()}
            />
        </RootStackScreenFrame>
    );
}

function RootMeetupDetailScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'MeetupDetail'>): React.ReactElement {
    return (
        <RootStackScreenFrame>
            <MeetupDetailScreen
                meetup={route.params.meetup}
                onBack={() => navigation.goBack()}
                onOpenUserProfile={(profile) => navigation.navigate('UserProfile', profile)}
            />
        </RootStackScreenFrame>
    );
}

function RootRecoveryMeetingDetailScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'RecoveryMeetingDetail'>): React.ReactElement {
    return (
        <RootStackScreenFrame>
            <RecoveryMeetingDetailScreen
                meeting={route.params.meeting}
                onBack={() => navigation.goBack()}
            />
        </RootStackScreenFrame>
    );
}

function RootGroupDetailScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'GroupDetail'>): React.ReactElement {
    return (
        <RootStackScreenFrame>
            <GroupDetailScreen
                groupId={route.params.groupId}
                onBack={() => navigation.goBack()}
                onOpenComments={(post) => navigation.navigate('GroupComments', { post })}
                onOpenChat={(chat) => navigation.navigate('Chat', { chat })}
                onOpenAdminThread={(threadId) => navigation.navigate('GroupAdminThread', {
                    groupId: route.params.groupId,
                    threadId,
                })}
                initialAdminTab={route.params.initialAdminTab}
                initialAdminThreadId={route.params.initialAdminThreadId}
                focusPostRequest={route.params.focusPostRequest ?? null}
                onFocusPostConsumed={() => {}}
                focusSupportRequest={route.params.focusSupportRequest ?? null}
                onFocusSupportRequestConsumed={() => {}}
            />
        </RootStackScreenFrame>
    );
}

function RootGroupCommentsScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'GroupComments'>): React.ReactElement {
    const { user } = useAuth();
    if (!user) {
        return <View style={styles.fullScreen} />;
    }
    return (
        <RootStackScreenFrame>
            <GroupCommentsScreen
                post={route.params.post}
                currentUser={user}
                onBack={() => navigation.goBack()}
                onPressUser={(profile) => navigation.navigate('UserProfile', profile)}
            />
        </RootStackScreenFrame>
    );
}

function RootGroupAdminThreadScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'GroupAdminThread'>): React.ReactElement {
    const groupQuery = useGroup(route.params.groupId, true);
    const group = groupQuery.data;

    if (!group) {
        return (
            <RootStackScreenFrame centered>
                <ActivityIndicator color={Colors.primary} />
            </RootStackScreenFrame>
        );
    }

    return (
        <RootStackScreenFrame>
            <GroupAdminThreadScreen
                group={group}
                threadId={route.params.threadId}
                onBack={() => navigation.goBack()}
            />
        </RootStackScreenFrame>
    );
}

function RootFeedCommentsScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'FeedComments'>): React.ReactElement {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    if (!user) {
        return <View style={styles.fullScreen} />;
    }
    return (
        <RootStackScreenFrame>
            <FeedCommentsScreen
                thread={route.params.thread}
                currentUser={user}
                focusComposer={Boolean(route.params.focusComposer)}
                onBack={() => navigation.goBack()}
                onPressUser={(profile) => navigation.navigate('UserProfile', profile)}
                onCommentCreated={() => {
                    void queryClient.invalidateQueries({ queryKey: ['home-feed'] });
                    void queryClient.invalidateQueries({ queryKey: ['user-posts'] });
                }}
            />
        </RootStackScreenFrame>
    );
}

function RootNotificationsScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Notifications'>): React.ReactElement {
    return (
        <RootStackScreenFrame>
            <NotificationsScreen
                isActive
                onBack={() => navigation.goBack()}
                onOpenChat={async (chatId) => {
                    const chat = await api.getChat(chatId);
                    navigation.navigate('Chat', { chat });
                }}
                onOpenMention={(target) => navigation.navigate('MainTabs', {
                    tab: 'feed',
                    feedFocusRequest: {
                        postId: target.postId,
                        commentId: target.commentId,
                        nonce: Date.now(),
                    },
                })}
                onOpenGroup={(groupId, postId) => navigation.navigate('GroupDetail', {
                    groupId,
                    focusPostRequest: postId ? { postId, nonce: Date.now() } : undefined,
                })}
                onOpenGroupReports={(groupId) => navigation.navigate('GroupDetail', {
                    groupId,
                    initialAdminTab: 'reports',
                })}
                onOpenGroupAdminInbox={(groupId, threadId) => {
                    if (threadId) {
                        navigation.navigate('GroupAdminThread', { groupId, threadId });
                        return;
                    }
                    navigation.navigate('GroupDetail', { groupId, initialAdminTab: 'inbox' });
                }}
                onOpenSupportRequestContext={(groupId, supportRequestId, postId) => navigation.navigate('GroupDetail', {
                    groupId,
                    focusSupportRequest: { requestId: supportRequestId, postId, nonce: Date.now() },
                })}
            />
        </RootStackScreenFrame>
    );
}

function RootUserProfileScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'UserProfile'>): React.ReactElement {
    return (
        <RootStackScreenFrame>
            <UserProfileScreen
                userId={route.params.userId}
                username={route.params.username ?? 'Profile'}
                avatarUrl={route.params.avatarUrl}
                isActive
                onBack={() => navigation.goBack()}
                onOpenChat={(chat) => navigation.navigate('Chat', { chat })}
                onOpenComments={(thread, focusComposer) => navigation.navigate('FeedComments', { thread, focusComposer })}
                onComposeDM={(info) => navigation.navigate('ComposeDM', info)}
            />
        </RootStackScreenFrame>
    );
}

function RootDatingLikesScreen(): React.ReactElement {
    return (
        <RootStackScreenFrame>
            <DatingLikesRouteScreen />
        </RootStackScreenFrame>
    );
}

function RootDatingMatchesScreen(): React.ReactElement {
    return (
        <RootStackScreenFrame>
            <DatingMatchesRouteScreen />
        </RootStackScreenFrame>
    );
}

function RootDatingProfileDetailScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'DatingProfileDetail'>): React.ReactElement {
    return (
        <RootStackScreenFrame>
            <DatingProfileDetailRouteScreen
                route={route}
                navigation={navigation}
            />
        </RootStackScreenFrame>
    );
}

function RootDatingProfileEditorScreen(): React.ReactElement {
    return (
        <RootStackScreenFrame>
            <DatingProfileEditorRouteScreen />
        </RootStackScreenFrame>
    );
}

function RootStackScreenFrame({
    children,
    centered = false,
}: {
    children: React.ReactNode;
    centered?: boolean;
}): React.ReactElement {
    return (
        <SafeAreaView style={[styles.fullScreen, centered && styles.centered]} edges={['top']}>
            {children}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    fullScreen: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    centered: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    fullScreenLoading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg.page,
    },
});
