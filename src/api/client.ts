import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';
const TOKEN_KEY = 'auth_token';

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
    const json = await res.json();

    if (!res.ok) {
        throw new Error(json.error || `Request failed: ${res.status}`);
    }

    return json.data as T;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface User {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
    city?: string;
    country?: string;
    sober_since?: string;
    created_at: string;
    interests: string[];
}

export interface Post {
    id: string;
    user_id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
    body: string;
    created_at: string;
}

export interface Comment {
    id: string;
    user_id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
    body: string;
    created_at: string;
}

export interface Reaction {
    id: string;
    user_id: string;
    first_name: string;
    last_name: string;
    type: string;
}

export interface Connection {
    id: string;
    user_id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
    city?: string;
    status: string;
    connected_at: string;
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

export interface Attendee {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
    city?: string;
    rsvp_at: string;
}

export interface Conversation {
    id: string;
    is_group: boolean;
    name?: string;
    created_at: string;
    last_message?: string;
    last_message_at?: string;
}

export interface Message {
    id: string;
    sender_id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
    body: string;
    sent_at: string;
}

export interface Interest {
    id: string;
    name: string;
}

// ── Auth ───────────────────────────────────────────────────────────────────

export async function register(data: {
    first_name: string;
    last_name: string;
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

export async function getUser(id: string): Promise<User> {
    return request(`/users/${id}`);
}

export async function discoverUsers(city?: string): Promise<User[]> {
    const params = city ? `?city=${encodeURIComponent(city)}` : '';
    return request(`/users/discover${params}`);
}

export async function setInterests(interestIds: string[]): Promise<void> {
    return request('/users/me/interests', { method: 'PUT', body: JSON.stringify({ interest_ids: interestIds }) });
}

// ── Feed & Posts ───────────────────────────────────────────────────────────

export async function getFeed(page = 1, limit = 20): Promise<Post[]> {
    return request(`/feed?page=${page}&limit=${limit}`);
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

// ── Connections ────────────────────────────────────────────────────────────

export async function sendConnectionRequest(addresseeId: string): Promise<{ id: string }> {
    return request('/connections', { method: 'POST', body: JSON.stringify({ addressee_id: addresseeId }) });
}

export async function getConnections(): Promise<Connection[]> {
    return request('/connections');
}

export async function getPendingConnections(): Promise<Connection[]> {
    return request('/connections/pending');
}

export async function updateConnectionStatus(id: string, status: 'accepted' | 'declined'): Promise<void> {
    return request(`/connections/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export async function removeConnection(id: string): Promise<void> {
    return request(`/connections/${id}`, { method: 'DELETE' });
}

// ── Events ─────────────────────────────────────────────────────────────────

export async function getEvents(city?: string): Promise<Event[]> {
    const params = city ? `?city=${encodeURIComponent(city)}` : '';
    return request(`/events${params}`);
}

export async function getEvent(id: string): Promise<Event> {
    return request(`/events/${id}`);
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

export async function getEventAttendees(id: string): Promise<Attendee[]> {
    return request(`/events/${id}/attendees`);
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

export async function getMessageRequests(): Promise<Conversation[]> {
    return request('/conversations/requests');
}

export async function updateConversationStatus(
    id: string,
    status: 'active' | 'declined'
): Promise<void> {
    return request(`/conversations/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    });
}

// ── Interests ──────────────────────────────────────────────────────────────

export async function getInterests(): Promise<Interest[]> {
    return request('/interests');
}
