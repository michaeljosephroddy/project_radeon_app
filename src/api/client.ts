import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';
const TOKEN_KEY = 'auth_token';

// Parses the standard API envelope and throws a useful error for non-OK responses.
async function parseDataResponse<T>(res: Response): Promise<T> {
    const text = await res.text();
    // Some endpoints can legitimately return an empty body. Reading text first lets
    // us gracefully handle both JSON payloads and "no content" responses.
    const json = text ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : {};

    if (!res.ok) {
        throw new Error(json.error || `Request failed: ${res.status}`);
    }

    return json.data as T;
}

// ── Token helpers ──────────────────────────────────────────────────────────

// Reads the persisted auth token from secure storage for authenticated requests.
export async function getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
}

// Persists the auth token after a successful login or registration flow.
export async function setToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
}

// Removes any persisted auth token when the session is no longer valid.
export async function clearToken(): Promise<void> {
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
    city?: string;
    country?: string;
    sober_since?: string;
    created_at: string;
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
}

export interface Comment {
    id: string;
    user_id: string;
    username: string;
    avatar_url?: string;
    body: string;
    created_at: string;
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
    description?: string;
    city: string;
    starts_at: string;
    capacity?: number;
    attendee_count: number;
    is_attending: boolean;
}

export interface Chat {
    id: string;
    is_group: boolean;
    name?: string;
    username?: string;
    avatar_url?: string;
    created_at: string;
    last_message?: string;
    last_message_at?: string;
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
export async function updateMe(data: Partial<User>): Promise<User> {
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

// Fetches a public profile for another user by id.
export async function getUser(id: string): Promise<User> {
    return request(`/users/${id}`);
}

// Queries discover results using optional search filters.
export async function discoverUsers(params?: { query?: string; city?: string }): Promise<User[]> {
    const search = new URLSearchParams();
    if (params?.query?.trim()) search.set('q', params.query.trim());
    if (params?.city?.trim()) search.set('city', params.city.trim());
    const suffix = search.toString() ? `?${search.toString()}` : '';
    return request(`/users/discover${suffix}`);
}

// ── Feed & Posts ───────────────────────────────────────────────────────────

// Loads the feed page used on the community tab.
export async function getFeed(page = 1, limit = 20): Promise<Post[]> {
    return request(`/feed?page=${page}&limit=${limit}`);
}

// Loads all posts authored by a specific user.
export async function getUserPosts(userId: string): Promise<Post[]> {
    return request(`/users/${userId}/posts`);
}

// Creates a new feed post from the supplied text body.
export async function createPost(body: string): Promise<{ id: string }> {
    return request('/posts', { method: 'POST', body: JSON.stringify({ body }) });
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
export async function addComment(postId: string, body: string): Promise<{ id: string }> {
    return request(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
}

// Loads all comments for a given post.
export async function getComments(postId: string): Promise<Comment[]> {
    return request(`/posts/${postId}/comments`);
}

// ── Meetups ────────────────────────────────────────────────────────────────

// Fetches meetup events, optionally filtered by city.
export async function getMeetups(city?: string): Promise<Meetup[]> {
    const params = city ? `?city=${encodeURIComponent(city)}` : '';
    return request(`/meetups${params}`);
}

// Creates a new meetup with the provided event details.
export async function createMeetup(data: {
    title: string;
    description?: string;
    city: string;
    starts_at: string;
    capacity?: number;
}): Promise<{ id: string }> {
    return request('/meetups', { method: 'POST', body: JSON.stringify(data) });
}

// Toggles the current user's RSVP state for a meetup.
export async function rsvpMeetup(id: string): Promise<{ attending: boolean }> {
    return request(`/meetups/${id}/rsvp`, { method: 'POST' });
}

// ── Messages ───────────────────────────────────────────────────────────────

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
export async function getChats(): Promise<Chat[]> {
    const chats = await request<RawChat[]>('/chats');
    return (chats ?? []).map(normalizeChat);
}

// Creates a direct or group chat and returns its id.
export async function createChat(memberIds: string[], name?: string): Promise<{ id: string }> {
    return request('/chats', { method: 'POST', body: JSON.stringify({ member_ids: memberIds, name }) });
}

// Fetches the message history for a specific chat.
export async function getMessages(chatId: string): Promise<Message[]> {
    return request(`/chats/${chatId}/messages`);
}

// Sends a new message into an existing chat thread.
export async function sendMessage(chatId: string, body: string): Promise<{ id: string }> {
    return request(`/chats/${chatId}/messages`, { method: 'POST', body: JSON.stringify({ body }) });
}

// ── Follows ────────────────────────────────────────────────────────────────

export interface FollowUser {
    id: string;
    user_id: string;
    username: string;
    avatar_url?: string;
    city?: string;
    created_at: string;
}

// Follows another user.
export async function followUser(id: string): Promise<void> {
    return request(`/users/${id}/follow`, { method: 'POST' });
}

// Unfollows another user.
export async function unfollowUser(id: string): Promise<void> {
    return request(`/users/${id}/follow`, { method: 'DELETE' });
}

// Loads the list of users the current user is following.
export async function getFollowing(): Promise<FollowUser[]> {
    return request('/users/me/following');
}

// Loads the list of users following the current user.
export async function getFollowers(): Promise<FollowUser[]> {
    return request('/users/me/followers');
}
