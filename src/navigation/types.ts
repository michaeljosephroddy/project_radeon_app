import type { Chat, GroupPost, Meetup, RecoveryMeeting } from '../api/client';
import type { CommentThreadTarget } from '../screens/main/feed/FeedCommentsModal';

export type RootStackParamList = {
    MainTabs: {
        tab?: 'feed' | 'discover' | 'community' | 'chats';
        feedFocusRequest?: { postId: string; commentId?: string; nonce: number };
    } | undefined;
    UserProfile: { userId: string; username?: string; avatarUrl?: string };
    Notifications: undefined;
    Chat: { chatId: string } | { chat: Chat };
    FeedComments: { thread: CommentThreadTarget; focusComposer?: boolean };
    ComposeDM: { recipientId: string; username: string; avatarUrl?: string };
    CreatePost: undefined;
    CreateGroup: undefined;
    CreateSupportRequest: undefined;
    CreateMeetup: { meetup?: Meetup } | undefined;
    MeetupDetail: { meetup: Meetup };
    RecoveryMeetingDetail: { meeting: RecoveryMeeting };
    GroupDetail: {
        groupId: string;
        initialAdminTab?: 'inbox' | 'reports';
        initialAdminThreadId?: string;
        focusPostRequest?: { postId: string; nonce: number };
        focusSupportRequest?: { requestId: string; postId?: string; nonce: number };
    };
    GroupComments: { post: GroupPost };
    DatingLikes: undefined;
    DatingMatches: undefined;
    DatingProfileEditor: undefined;
};

export type MainTabParamList = {
    FeedTab: undefined;
    DiscoverTab: undefined;
    CommunityTab: undefined;
    ChatsTab: undefined;
    ProfileTab: undefined;
};

export type DiscoverStackParamList = {
    DiscoverHome: undefined;
    DatingLikes: undefined;
    DatingMatches: undefined;
    DatingProfileEditor: undefined;
    DatingProfileSection: { section: string };
    DatingProfileDetail: { profileId: string };
    RecoveryMeetingDetail: { meetingId: string };
};
