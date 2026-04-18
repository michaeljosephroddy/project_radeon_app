import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';
const TOKEN_KEY = 'auth_token';

async function parseDataResponse<T>(res: Response): Promise<T> {
    const text = await res.text();
    const json = text ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : {};

    if (!res.ok) {
        throw new Error(json.error || `Request failed: ${res.status}`);
    }

    return json.data as T;
}

// ── Token helpers ──────────────────────────────────────────────────────────

export async function getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ── Base fetch ─────────────────────────────────────────────────────────────

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

export interface Event {
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

export interface Conversation {
    id: string;
    is_group: boolean;
    name?: string;
    username?: string;
    avatar_url?: string;
    created_at: string;
    last_message?: string;
    last_message_at?: string;
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

export async function login(email: string, password: string): Promise<{ token: string; user_id: string }> {
    return request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, false);
}

export async function logout(): Promise<void> {
    await clearToken();
}

// ── Users ──────────────────────────────────────────────────────────────────

export async function getMe(): Promise<User> {
    return request('/users/me');
}

export async function updateMe(data: Partial<User>): Promise<User> {
    return request('/users/me', { method: 'PATCH', body: JSON.stringify(data) });
}

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

export async function getUser(id: string): Promise<User> {
    return request(`/users/${id}`);
}

export async function discoverUsers(params?: { query?: string; city?: string }): Promise<User[]> {
    const search = new URLSearchParams();
    if (params?.query?.trim()) search.set('q', params.query.trim());
    if (params?.city?.trim()) search.set('city', params.city.trim());
    const suffix = search.toString() ? `?${search.toString()}` : '';
    return request(`/users/discover${suffix}`);
}

// ── Feed & Posts ───────────────────────────────────────────────────────────

export async function getFeed(page = 1, limit = 20): Promise<Post[]> {
    return request(`/feed?page=${page}&limit=${limit}`);
}

export async function getUserPosts(userId: string): Promise<Post[]> {
    return request(`/users/${userId}/posts`);
}

export async function createPost(body: string): Promise<{ id: string }> {
    return request('/posts', { method: 'POST', body: JSON.stringify({ body }) });
}

export async function deletePost(id: string): Promise<void> {
    return request(`/posts/${id}`, { method: 'DELETE' });
}

export async function reactToPost(id: string, type = 'like'): Promise<{ reacted: boolean }> {
    return request(`/posts/${id}/react`, { method: 'POST', body: JSON.stringify({ type }) });
}

export async function getReactions(id: string): Promise<Reaction[]> {
    return request(`/posts/${id}/reactions`);
}

export async function addComment(postId: string, body: string): Promise<{ id: string }> {
    return request(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
}

export async function getComments(postId: string): Promise<Comment[]> {
    return request(`/posts/${postId}/comments`);
}

// ── Events ─────────────────────────────────────────────────────────────────

export async function getEvents(city?: string): Promise<Event[]> {
    const params = city ? `?city=${encodeURIComponent(city)}` : '';
    return request(`/events${params}`);
}

export async function createEvent(data: {
    title: string;
    description?: string;
    city: string;
    starts_at: string;
    capacity?: number;
}): Promise<{ id: string }> {
    return request('/events', { method: 'POST', body: JSON.stringify(data) });
}

export async function rsvpEvent(id: string): Promise<{ attending: boolean }> {
    return request(`/events/${id}/rsvp`, { method: 'POST' });
}

// ── Messages ───────────────────────────────────────────────────────────────

export async function getConversations(): Promise<Conversation[]> {
    return request('/conversations');
}

export async function createConversation(memberIds: string[], name?: string): Promise<{ id: string }> {
    return request('/conversations', { method: 'POST', body: JSON.stringify({ member_ids: memberIds, name }) });
}

export async function getMessages(conversationId: string): Promise<Message[]> {
    return request(`/conversations/${conversationId}/messages`);
}

export async function sendMessage(conversationId: string, body: string): Promise<{ id: string }> {
    return request(`/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify({ body }) });
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

export async function followUser(id: string): Promise<void> {
    return request(`/users/${id}/follow`, { method: 'POST' });
}

export async function unfollowUser(id: string): Promise<void> {
    return request(`/users/${id}/follow`, { method: 'DELETE' });
}

export async function getFollowing(): Promise<FollowUser[]> {
    return request('/users/me/following');
}

export async function getFollowers(): Promise<FollowUser[]> {
    return request('/users/me/followers');
}
