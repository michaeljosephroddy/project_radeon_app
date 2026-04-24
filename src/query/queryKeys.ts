export const queryKeys = {
    me: () => ['me'] as const,
    interests: () => ['interests'] as const,
    feed: (limit = 20) => ['feed', { limit }] as const,
    user: (userId: string) => ['user', userId] as const,
    userPosts: (userId: string, limit = 20) => ['user-posts', userId, { limit }] as const,
    chats: (params?: { query?: string; limit?: number }) => ['chats', params ?? {}] as const,
    chatMessages: (chatId: string) => ['chat-messages', chatId] as const,
    meetups: (filters?: { q?: string; city?: string; limit?: number }) => ['meetups', filters ?? {}] as const,
    myMeetups: (params?: { limit?: number }) => ['my-meetups', params ?? {}] as const,
    meetup: (meetupId: string) => ['meetup', meetupId] as const,
    meetupAttendees: (meetupId: string) => ['meetup-attendees', meetupId] as const,
    discover: (params?: {
        query?: string;
        city?: string;
        gender?: string;
        ageMin?: number;
        ageMax?: number;
        distanceKm?: number;
        sobriety?: string;
        limit?: number;
    }) => ['discover', params ?? {}] as const,
    supportRequests: (params?: { scope?: 'open' | 'mine'; limit?: number }) => ['support-requests', params ?? {}] as const,
    supportProfile: () => ['support-profile'] as const,
};
