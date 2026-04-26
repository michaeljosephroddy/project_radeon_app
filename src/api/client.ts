import * as SecureStore from 'expo-secure-store';
import { dedupeById } from '../utils/list';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';
const TOKEN_KEY = 'auth_token';
let inMemoryToken: string | null = null;
let hasLoadedToken = false;

// Called by useAuth to handle any 401 response after the initial session check.
let _onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void): void {
    _onUnauthorized = handler;
}

// Parses the standard API envelope and throws a useful error for non-OK responses.
async function parseDataResponse<T>(res: Response): Promise<T> {
    const text = await res.text();
    // Some endpoints can legitimately return an empty body. Reading text first lets
    // us gracefully handle both JSON payloads and "no content" responses.
    const json = text ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : {};

    if (res.status === 401) {
        await clearToken();
        _onUnauthorized?.();
        throw new Error(json.error || 'Unauthorized');
    }

    if (!res.ok) {
        throw new Error(json.error || `Request failed: ${res.status}`);
    }

    return json.data as T;
}

// ── Token helpers ──────────────────────────────────────────────────────────

// Reads the persisted auth token from secure storage for authenticated requests.
export async function getToken(): Promise<string | null> {
    if (hasLoadedToken) return inMemoryToken;
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    inMemoryToken = token;
    hasLoadedToken = true;
    return token;
}

// Persists the auth token after a successful login or registration flow.
export async function setToken(token: string): Promise<void> {
    inMemoryToken = token;
    hasLoadedToken = true;
    await SecureStore.setItemAsync(TOKEN_KEY, token);
}

// Removes any persisted auth token when the session is no longer valid.
export async function clearToken(): Promise<void> {
    inMemoryToken = null;
    hasLoadedToken = true;
    await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ── Base fetch ─────────────────────────────────────────────────────────────

// Sends a JSON request to the API and attaches auth headers when required.
async function request<T>(
    path: string,
    options: RequestInit = {},
    authenticated = true
): Promise<T> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    };

    if (authenticated) {
        const token = await getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    // Centralizing the auth/header merge here keeps the screen layer focused on
    // UI state instead of repeating fetch boilerplate on every API call.
    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    return parseDataResponse<T>(res);
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface User {
    id: string;
    username: string;
    avatar_url?: string;
    banner_url?: string | null;
    is_plus?: boolean;
    subscription_tier?: string | null;
    city?: string;
    country?: string;
    bio?: string | null;
    interests: string[];
    sober_since?: string;
    created_at: string;
    friendship_status: 'self' | 'none' | 'incoming' | 'outgoing' | 'friends';
    friend_count: number;
    incoming_friend_request_count: number;
    outgoing_friend_request_count: number;
    current_city?: string | null;
    location_updated_at?: string | null;
}

export interface PaginatedResponse<T> {
    items: T[];
    page: number;
    limit: number;
    has_more: boolean;
}

export interface CursorResponse<T> {
    items: T[];
    limit: number;
    has_more: boolean;
    next_cursor?: string | null;
}

export interface Post {
    id: string;
    user_id: string;
    username: string;
    avatar_url?: string;
    body: string;
    created_at: string;
    comment_count: number;
    like_count: number;
    images: PostImage[];
}

interface RawPost extends Omit<Post, 'images'> {
    images?: RawPostImage[] | null;
}

export interface PostImage {
    id: string;
    image_url: string;
    width: number;
    height: number;
    sort_order?: number;
}

interface RawPostImage {
    id: string;
    image_url?: string | null;
    width: number;
    height: number;
    sort_order?: number;
}

export interface Comment {
    id: string;
    user_id: string;
    username: string;
    avatar_url?: string;
    body: string;
    created_at: string;
    mentions: CommentMention[];
}

export interface CommentMention {
    user_id: string;
    username: string;
}

interface RawComment extends Omit<Comment, 'mentions'> {
    mentions?: CommentMention[] | null;
}

export interface Reaction {
    id: string;
    user_id: string;
    username: string;
    avatar_url?: string;
    type: string;
}

export interface Meetup {
    id: string;
    organizer_id: string;
    title: string;
    description?: string | null;
    city: string;
    starts_at: string;
    capacity?: number | null;
    attendee_count: number;
    is_attending: boolean;
    attendee_preview?: Array<{
        id: string;
        username: string;
        avatar_url?: string | null;
    }>;
}

export interface MeetupAttendee {
    id: string;
    username: string;
    avatar_url?: string | null;
    city?: string | null;
    rsvp_at: string;
}

export interface SupportProfile {
    is_available_to_support: boolean;
    support_updated_at?: string | null;
}

export interface SupportRequest {
    id: string;
    requester_id: string;
    username: string;
    avatar_url?: string | null;
    city?: string | null;
    type: 'need_to_talk' | 'need_distraction' | 'need_encouragement' | 'need_in_person_help';
    message?: string | null;
    urgency: 'when_you_can' | 'soon' | 'right_now';
    status: 'open' | 'closed';
    response_count: number;
    created_at: string;
    priority_visibility: boolean;
    priority_expires_at?: string | null;
    has_responded: boolean;
    is_own_request: boolean;
}

export interface SupportResponse {
    id: string;
    support_request_id: string;
    responder_id: string;
    username: string;
    avatar_url?: string | null;
    city?: string | null;
    response_type: 'can_chat' | 'check_in_later' | 'can_meet';
    message?: string | null;
    scheduled_for?: string | null;
    created_at: string;
    chat_id?: string | null;
}

export interface SupportChatContext {
    support_request_id: string;
    request_type: SupportRequest['type'];
    request_message?: string | null;
    requester_id: string;
    requester_username: string;
    responder_mode?: SupportResponse['response_type'];
    latest_response_type?: SupportResponse['response_type'];
    status?: 'pending_requester_acceptance' | 'accepted' | 'declined' | 'closed';
    awaiting_user_id?: string | null;
}

export interface SupportRequestsPage extends CursorResponse<SupportRequest> {
    open_request_count?: number;
    available_to_support_count?: number;
}

export interface Chat {
    id: string;
    is_group: boolean;
    status?: 'request' | 'active' | 'declined';
    name?: string;
    username?: string;
    avatar_url?: string;
    created_at: string;
    last_message?: string;
    last_message_at?: string;
    unread_count?: number;
    support_context?: SupportChatContext;
}

export interface CreateSupportResponseResult {
    response: SupportResponse;
    chat?: Chat;
}

interface RawChat extends Chat {
    avatarUrl?: string;
    other_user_avatar_url?: string;
    otherUserAvatarUrl?: string;
    user_avatar_url?: string;
    userAvatarUrl?: string;
    profile_photo_url?: string;
    profilePhotoUrl?: string;
    photo_url?: string;
    photoUrl?: string;
}

export interface Message {
    id: string;
    sender_id: string;
    username: string;
    avatar_url?: string;
    body: string;
    sent_at: string;
}

export interface MessagePage {
    items: Message[];
    limit: number;
    has_more: boolean;
    next_before?: string | null;
    other_user_last_read_message_id?: string | null;
}

export interface AppNotification {
    id: string;
    user_id: string;
    type: 'chat.message' | 'comment.mention';
    actor_id?: string;
    resource_type: 'chat' | 'comment';
    resource_id?: string;
    title: string;
    body: string;
    payload: Record<string, string>;
    created_at: string;
    read_at?: string;
}

export interface NotificationPreferences {
    chat_messages: boolean;
    comment_mentions: boolean;
}

export interface UpdateMeInput {
    username?: string;
    city?: string;
    country?: string;
    bio?: string | null;
    interests?: string[];
    sober_since?: string;
    lat?: number;
    lng?: number;
}

// ── Auth ───────────────────────────────────────────────────────────────────

// Creates a new user account and returns the initial auth payload.
export async function register(data: {
    username: string;
    email: string;
    password: string;
    city?: string;
    country?: string;
    sober_since?: string;
}): Promise<{ token: string; user_id: string }> {
    return request('/auth/register', { method: 'POST', body: JSON.stringify(data) }, false);
}

// Authenticates a user with email/password and returns a fresh auth token.
export async function login(email: string, password: string): Promise<{ token: string; user_id: string }> {
    return request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, false);
}

// Clears local auth state for a logout without requiring a separate API call.
export async function logout(): Promise<void> {
    await clearToken();
}

// ── Users ──────────────────────────────────────────────────────────────────

// Fetches the currently authenticated user's full profile.
export async function getMe(): Promise<User> {
    return request('/users/me');
}

// Updates the current user's editable profile fields.
export async function updateMe(data: UpdateMeInput): Promise<User> {
    return request('/users/me', { method: 'PATCH', body: JSON.stringify(data) });
}

// Uploads a new avatar image using multipart form data instead of JSON.
export async function uploadAvatar(uri: string): Promise<{ avatar_url: string }> {
    const token = await getToken();
    const form = new FormData();
    form.append('avatar', { uri, name: 'avatar.jpg', type: 'image/jpeg' } as unknown as Blob);
    const res = await fetch(`${BASE_URL}/users/me/avatar`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
    });
    return parseDataResponse<{ avatar_url: string }>(res);
}

export async function uploadBanner(uri: string): Promise<{ banner_url: string }> {
    const token = await getToken();
    const form = new FormData();
    form.append('banner', { uri, name: 'banner.jpg', type: 'image/jpeg' } as unknown as Blob);
    const res = await fetch(`${BASE_URL}/users/me/banner`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
    });
    return parseDataResponse<{ banner_url: string }>(res);
}

// Silently records the caller's live GPS position and reverse-geocoded city.
export async function updateMyCurrentLocation(data: { lat: number; lng: number; city: string }): Promise<void> {
    await request('/users/me/location', { method: 'PATCH', body: JSON.stringify(data) });
}

// Fetches a public profile for another user by id.
export async function getUser(id: string): Promise<User> {
    return request(`/users/${id}`);
}

// Loads the curated interest catalog used in profile editing.
export async function getInterests(): Promise<string[]> {
    const response = await request<{ items: string[] }>('/interests', {}, false);
    return response.items ?? [];
}

// Queries discover results using optional search filters.
export async function discoverUsers(params?: {
    query?: string;
    city?: string;
    gender?: string;
    ageMin?: number;
    ageMax?: number;
    distanceKm?: number;
    sobriety?: string;
    lat?: number;
    lng?: number;
    page?: number;
    limit?: number;
}): Promise<PaginatedResponse<User>> {
    const search = new URLSearchParams();
    if (params?.query?.trim()) search.set('q', params.query.trim());
    if (params?.city?.trim()) search.set('city', params.city.trim());
    if (params?.gender?.trim()) search.set('gender', params.gender.trim());
    if (typeof params?.ageMin === 'number') search.set('age_min', String(params.ageMin));
    if (typeof params?.ageMax === 'number') search.set('age_max', String(params.ageMax));
    if (typeof params?.distanceKm === 'number') search.set('distance_km', String(params.distanceKm));
    if (params?.sobriety?.trim()) search.set('sobriety', params.sobriety.trim());
    if (typeof params?.lat === 'number') search.set('lat', String(params.lat));
    if (typeof params?.lng === 'number') search.set('lng', String(params.lng));
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    const suffix = search.toString() ? `?${search.toString()}` : '';
    return request(`/users/discover${suffix}`);
}

// ── Feed & Posts ───────────────────────────────────────────────────────────

function normalizePost(post: RawPost): Post {
    return {
        ...post,
        images: (post.images ?? []).map(normalizePostImage),
    };
}

function normalizePostImage(image: RawPostImage): PostImage {
    return {
        id: image.id,
        image_url: image.image_url ?? '',
        width: image.width,
        height: image.height,
        sort_order: image.sort_order,
    };
}

// Loads the feed page used on the community tab.
export async function getFeed(cursor?: string, limit = 20): Promise<CursorResponse<Post>> {
    const search = new URLSearchParams({ limit: String(limit) });
    if (cursor) search.set('before', cursor);
    const page = await request<CursorResponse<RawPost>>(`/feed?${search.toString()}`);
    return {
        ...page,
        items: (page.items ?? []).map(normalizePost),
    };
}

// Loads all posts authored by a specific user.
export async function getUserPosts(userId: string, cursor?: string, limit = 20): Promise<CursorResponse<Post>> {
    const search = new URLSearchParams({ limit: String(limit) });
    if (cursor) search.set('before', cursor);
    const page = await request<CursorResponse<RawPost>>(`/users/${userId}/posts?${search.toString()}`);
    return {
        ...page,
        items: (page.items ?? []).map(normalizePost),
    };
}

// Uploads a post image using multipart form data instead of JSON.
export async function uploadPostImage(input: {
    uri: string;
    mimeType?: string;
    fileName?: string;
}): Promise<PostImage> {
    const token = await getToken();
    const form = new FormData();
    form.append('image', {
        uri: input.uri,
        name: input.fileName ?? 'post.jpg',
        type: input.mimeType ?? 'image/jpeg',
    } as unknown as Blob);
    const res = await fetch(`${BASE_URL}/posts/images`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
    });
    const image = await parseDataResponse<RawPostImage>(res);
    return normalizePostImage(image);
}

// Creates a new feed post from the supplied text body and optional images.
export async function createPost(data: { body?: string; images?: PostImage[] }): Promise<{ id: string }> {
    return request('/posts', { method: 'POST', body: JSON.stringify(data) });
}

// Deletes a post by id.
export async function deletePost(id: string): Promise<void> {
    return request(`/posts/${id}`, { method: 'DELETE' });
}

// Toggles a reaction on a post and returns the new reacted state.
export async function reactToPost(id: string, type = 'like'): Promise<{ reacted: boolean }> {
    return request(`/posts/${id}/react`, { method: 'POST', body: JSON.stringify({ type }) });
}

// Fetches the users who reacted to a given post.
export async function getReactions(id: string): Promise<Reaction[]> {
    return request(`/posts/${id}/reactions`);
}

// Creates a new comment on a specific post.
export async function addComment(postId: string, body: string, mentionUserIds: string[] = []): Promise<Comment> {
    const comment = await request<RawComment>(`/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body, mention_user_ids: mentionUserIds }),
    });
    return normalizeComment(comment);
}

// Loads a page of comments for a given post.
export async function getComments(postId: string, cursor?: string, limit = 20): Promise<CursorResponse<Comment>> {
    const search = new URLSearchParams({ limit: String(limit) });
    if (cursor) search.set('after', cursor);
    const page = await request<CursorResponse<RawComment>>(`/posts/${postId}/comments?${search.toString()}`);
    return {
        ...page,
        items: (page.items ?? []).map(normalizeComment),
    };
}

// ── Meetups ────────────────────────────────────────────────────────────────

function normalizeMeetup(meetup: Meetup): Meetup {
    return {
        ...meetup,
        attendee_preview: meetup.attendee_preview
            ? dedupeById(meetup.attendee_preview)
            : meetup.attendee_preview,
    };
}

function normalizeMeetupAttendee(attendee: MeetupAttendee): MeetupAttendee {
    return attendee;
}

// Fetches meetup events, optionally filtered by city and search query.
export async function getMeetups(params?: { q?: string; city?: string; page?: number; limit?: number }): Promise<PaginatedResponse<Meetup>> {
    const search = new URLSearchParams();
    if (params?.q) search.set('q', params.q);
    if (params?.city) search.set('city', params.city);
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    const suffix = search.toString() ? `?${search.toString()}` : '';
    const page = await request<PaginatedResponse<Meetup>>(`/meetups${suffix}`);
    return {
        ...page,
        items: (page.items ?? []).map(normalizeMeetup),
    };
}

// Creates a new meetup with the provided event details.
export async function createMeetup(data: {
    title: string;
    description?: string | null;
    city: string;
    starts_at: string;
    capacity?: number | null;
}): Promise<Meetup> {
    return normalizeMeetup(await request<Meetup>('/meetups', { method: 'POST', body: JSON.stringify(data) }));
}

// Loads meetups created by the currently authenticated user.
export async function getMyMeetups(page = 1, limit = 20): Promise<PaginatedResponse<Meetup>> {
    const pageData = await request<PaginatedResponse<Meetup>>(`/users/me/meetups?page=${page}&limit=${limit}`);
    return {
        ...pageData,
        items: (pageData.items ?? []).map(normalizeMeetup),
    };
}

// Loads the caller's support-availability settings.
export async function getMySupportProfile(): Promise<SupportProfile> {
    return request('/support/me');
}

// Updates the caller's support-availability settings.
export async function updateMySupportProfile(data: {
    is_available_to_support: boolean;
}): Promise<SupportProfile> {
    return request('/support/me', { method: 'PATCH', body: JSON.stringify(data) });
}

// Creates a new support request visible to the whole community.
export async function createSupportRequest(data: {
    type: SupportRequest['type'];
    message?: string | null;
    urgency: SupportRequest['urgency'];
    priority_visibility?: boolean;
}): Promise<SupportRequest> {
    return request('/support/requests', { method: 'POST', body: JSON.stringify(data) });
}

// Loads open support requests visible to the current user.
export async function getSupportRequests(cursor?: string, limit = 20): Promise<SupportRequestsPage> {
    const search = new URLSearchParams({ limit: String(limit) });
    if (cursor) search.set('before', cursor);
    return request(`/support/requests?${search.toString()}`);
}

// Loads support requests created by the current user.
export async function getMySupportRequests(cursor?: string, limit = 20): Promise<CursorResponse<SupportRequest>> {
    const search = new URLSearchParams({ limit: String(limit) });
    if (cursor) search.set('before', cursor);
    return request(`/support/requests/mine?${search.toString()}`);
}

// Loads a single support request by id.
export async function getSupportRequest(id: string): Promise<SupportRequest> {
    return request(`/support/requests/${id}`);
}

// Updates a support request owned by the current user.
export async function updateSupportRequest(id: string, data: {
    status: 'closed';
}): Promise<SupportRequest> {
    return request(`/support/requests/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

// Creates a response to an open support request.
export async function createSupportResponse(id: string, data: {
    response_type: SupportResponse['response_type'];
    scheduled_for?: string | null;
    message?: string | null;
}): Promise<CreateSupportResponseResult> {
    const result = await request<CreateSupportResponseResult | SupportResponse>(`/support/requests/${id}/responses`, {
        method: 'POST',
        body: JSON.stringify(data),
    });

    if ('response' in result) {
        return {
            ...result,
            chat: result.chat ? normalizeChat(result.chat as RawChat) : undefined,
        };
    }

    return { response: result };
}

// Loads responses for a support request owned by the current user.
export async function getSupportRequestResponses(id: string): Promise<SupportResponse[]> {
    const data = await request<SupportResponse[] | { items?: SupportResponse[] | null } | null>(`/support/requests/${id}/responses`);
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
}

// Toggles the current user's RSVP state for a meetup.
export async function rsvpMeetup(id: string): Promise<{ attending: boolean }> {
    return request(`/meetups/${id}/rsvp`, { method: 'POST' });
}

// Loads the attendee list for a specific meetup.
export async function getMeetupAttendees(id: string, page = 1, limit = 50): Promise<PaginatedResponse<MeetupAttendee>> {
    const pageData = await request<PaginatedResponse<MeetupAttendee>>(`/meetups/${id}/attendees?page=${page}&limit=${limit}`);
    return {
        ...pageData,
        items: dedupeById((pageData.items ?? []).map(normalizeMeetupAttendee)),
    };
}

// ── Messages ───────────────────────────────────────────────────────────────

function normalizeComment(comment: RawComment): Comment {
    return {
        ...comment,
        mentions: comment.mentions ?? [],
    };
}

// Normalizes chat payloads so the UI can rely on one avatar field name.
function normalizeChat(chat: RawChat): Chat {
    return {
        ...chat,
        // The backend has used several avatar field names over time. Normalize
        // them once so the rest of the app can consume a stable Chat shape.
        avatar_url: chat.avatar_url
            ?? chat.avatarUrl
            ?? chat.other_user_avatar_url
            ?? chat.otherUserAvatarUrl
            ?? chat.user_avatar_url
            ?? chat.userAvatarUrl
            ?? chat.profile_photo_url
            ?? chat.profilePhotoUrl
            ?? chat.photo_url
            ?? chat.photoUrl,
    };
}

// Loads the current user's chat list and normalizes each row.
export async function getChats(params?: { query?: string; page?: number; limit?: number }): Promise<PaginatedResponse<Chat>> {
    const search = new URLSearchParams();
    if (params?.query?.trim()) search.set('q', params.query.trim());
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    const suffix = search.toString() ? `?${search.toString()}` : '';
    const page = await request<PaginatedResponse<RawChat>>(`/chats${suffix}`);
    return {
        ...page,
        items: (page.items ?? []).map(normalizeChat),
    };
}

export async function getChat(chatId: string): Promise<Chat> {
    const chat = await request<RawChat>(`/chats/${chatId}`);
    return normalizeChat(chat);
}

// Creates a direct or group chat and returns its id.
export async function createChat(memberIds: string[], name?: string): Promise<{ id: string }> {
    return request('/chats', { method: 'POST', body: JSON.stringify({ member_ids: memberIds, name }) });
}

// Fetches the message history for a specific chat.
export async function getMessages(chatId: string, params?: { before?: string | null; limit?: number }): Promise<MessagePage> {
    const search = new URLSearchParams();
    if (params?.before) search.set('before', params.before);
    if (params?.limit) search.set('limit', String(params.limit));
    const suffix = search.toString() ? `?${search.toString()}` : '';
    return request(`/chats/${chatId}/messages${suffix}`);
}

// Sends a new message into an existing chat thread.
export async function sendMessage(chatId: string, body: string): Promise<{ id: string }> {
    return request(`/chats/${chatId}/messages`, { method: 'POST', body: JSON.stringify({ body }) });
}

export async function markChatRead(chatId: string, lastReadMessageId?: string): Promise<void> {
    await request(`/chats/${chatId}/read`, {
        method: 'POST',
        body: JSON.stringify(lastReadMessageId ? { last_read_message_id: lastReadMessageId } : {}),
    });
}

export async function acceptSupportChat(chatId: string): Promise<Chat> {
    const chat = await request<RawChat>(`/chats/${chatId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'active' }),
    });
    return normalizeChat(chat);
}

export async function declineSupportChat(chatId: string): Promise<Chat> {
    const chat = await request<RawChat>(`/chats/${chatId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'declined' }),
    });
    return normalizeChat(chat);
}

// Deletes a direct chat or leaves a group chat for the current user.
export async function deleteChat(chatId: string): Promise<{ action: 'deleted' | 'left' }> {
    return request(`/chats/${chatId}`, { method: 'DELETE' });
}

export async function registerPushDevice(data: {
    push_token: string;
    platform: 'ios' | 'android';
    device_name?: string;
    app_version?: string;
}): Promise<{ id: string }> {
    return request('/notifications/devices', { method: 'POST', body: JSON.stringify(data) });
}

export async function getNotifications(cursor?: string, limit = 20): Promise<CursorResponse<AppNotification>> {
    const search = new URLSearchParams({ limit: String(limit) });
    if (cursor) search.set('before', cursor);
    return request(`/notifications?${search.toString()}`);
}

export async function markNotificationRead(id: string): Promise<void> {
    await request(`/notifications/${id}/read`, { method: 'POST' });
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
    return request('/notifications/preferences');
}

export async function updateNotificationPreferences(data: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    return request('/notifications/preferences', { method: 'PATCH', body: JSON.stringify(data) });
}

// ── Friends ────────────────────────────────────────────────────────────────

export interface FriendUser {
    id: string;
    user_id: string;
    username: string;
    avatar_url?: string;
    city?: string;
    created_at: string;
}

// Sends a friend request to another user.
export async function sendFriendRequest(id: string): Promise<void> {
    return request(`/users/${id}/friend-request`, { method: 'POST' });
}

// Accepts or declines a pending friend request from another user.
export async function updateFriendRequest(id: string, action: 'accept' | 'decline'): Promise<void> {
    return request(`/users/${id}/friend-request`, { method: 'PATCH', body: JSON.stringify({ action }) });
}

// Cancels a pending outgoing friend request.
export async function cancelFriendRequest(id: string): Promise<void> {
    return request(`/users/${id}/friend-request`, { method: 'DELETE' });
}

// Removes an accepted friend relationship.
export async function removeFriend(id: string): Promise<void> {
    return request(`/users/${id}/friend`, { method: 'DELETE' });
}

// Loads the list of accepted friends for the current user.
export async function getFriends(cursor?: string, limit = 25): Promise<CursorResponse<FriendUser>> {
    const search = new URLSearchParams({ limit: String(limit) });
    if (cursor) search.set('before', cursor);
    return request(`/users/me/friends?${search.toString()}`);
}

// Loads incoming friend requests for the current user.
export async function getIncomingFriendRequests(cursor?: string, limit = 25): Promise<CursorResponse<FriendUser>> {
    const search = new URLSearchParams({ limit: String(limit) });
    if (cursor) search.set('before', cursor);
    return request(`/users/me/friend-requests/incoming?${search.toString()}`);
}

// Loads outgoing friend requests for the current user.
export async function getOutgoingFriendRequests(cursor?: string, limit = 25): Promise<CursorResponse<FriendUser>> {
    const search = new URLSearchParams({ limit: String(limit) });
    if (cursor) search.set('before', cursor);
    return request(`/users/me/friend-requests/outgoing?${search.toString()}`);
}
