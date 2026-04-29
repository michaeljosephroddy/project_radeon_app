export const queryKeys = {
    me: () => ['me'] as const,
    interests: () => ['interests'] as const,
    homeFeed: (limit = 20) => ['home-feed', { limit }] as const,
    user: (userId: string) => ['user', userId] as const,
    userPosts: (userId: string, limit = 20) => ['user-posts', userId, { limit }] as const,
    chats: (params?: { query?: string; limit?: number }) => ['chats', params ?? {}] as const,
    chat: (chatId: string) => ['chat', chatId] as const,
    chatMessages: (chatId: string) => ['chat-messages', chatId] as const,
    meetupCategories: () => ['meetup-categories'] as const,
    meetups: (filters?: {
        q?: string;
        category?: string;
        city?: string;
        distance_km?: number;
        event_type?: string;
        date_preset?: string;
        date_from?: string;
        date_to?: string;
        day_of_week?: number[];
        time_of_day?: string[];
        open_spots_only?: boolean;
        sort?: string;
        limit?: number;
    }) => ['meetups', filters ?? {}] as const,
    myMeetups: (params?: { scope?: string; limit?: number }) => ['my-meetups', params ?? {}] as const,
    meetup: (meetupId: string) => ['meetup', meetupId] as const,
    meetupAttendees: (meetupId: string) => ['meetup-attendees', meetupId] as const,
    meetupWaitlist: (meetupId: string) => ['meetup-waitlist', meetupId] as const,
    discoverSuggested: (params?: {
        lat?: number;
        lng?: number;
        limit?: number;
    }) => ['discover-suggested', params ?? {}] as const,
    discoverSearch: (params?: {
        query?: string;
        city?: string;
        gender?: string;
        ageMin?: number;
        ageMax?: number;
        distanceKm?: number;
        sobriety?: string;
        interests?: string[];
        lat?: number;
        lng?: number;
        limit?: number;
    }) => ['discover-search', params ?? {}] as const,
    discoverFiltered: (params?: {
        city?: string;
        gender?: string;
        ageMin?: number;
        ageMax?: number;
        distanceKm?: number;
        sobriety?: string;
        interests?: string[];
        lat?: number;
        lng?: number;
        limit?: number;
    }) => ['discover-filtered', params ?? {}] as const,
    discoverPreview: (params?: {
        query?: string;
        city?: string;
        gender?: string;
        ageMin?: number;
        ageMax?: number;
        distanceKm?: number;
        sobriety?: string;
        interests?: string[];
        lat?: number;
        lng?: number;
    }) => ['discover-preview', params ?? {}] as const,
    discover: (params?: {
        query?: string;
        city?: string;
        gender?: string;
        ageMin?: number;
        ageMax?: number;
        distanceKm?: number;
        sobriety?: string;
        interests?: string[];
        lat?: number;
        lng?: number;
        limit?: number;
    }) => {
        const normalized = params ?? {};
        if (normalized.query) {
            return ['discover-search', normalized] as const;
        }

        const hasAdvancedFilters = Boolean(
            normalized.city
            || normalized.gender
            || normalized.ageMin !== undefined
            || normalized.ageMax !== undefined
            || normalized.distanceKm !== undefined
            || normalized.sobriety
            || normalized.interests?.length,
        );

        if (hasAdvancedFilters) {
            return ['discover-filtered', normalized] as const;
        }

        return ['discover-suggested', {
            lat: normalized.lat,
            lng: normalized.lng,
            limit: normalized.limit,
        }] as const;
    },
    supportRequests: (params?: { scope?: 'open' | 'mine'; filter?: 'all' | 'urgent' | 'unanswered'; limit?: number }) => ['support-requests', params ?? {}] as const,
    supportOffers: (requestId: string, params?: { page?: number; limit?: number }) => ['support-offers', requestId, params ?? {}] as const,
    supportReplies: (requestId: string, params?: { limit?: number }) => ['support-replies', requestId, params ?? {}] as const,
};
