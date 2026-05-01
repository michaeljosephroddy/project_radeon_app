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

export function getChatWebSocketUrl(accessToken: string): string {
    const baseUrl = BASE_URL.replace(/^http/i, 'ws');
    const url = new URL('/chats/ws', baseUrl);
    url.searchParams.set('access_token', accessToken);
    return url.toString();
}

function isOpaqueChatCursor(value: string): boolean {
    return value.includes('|');
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface User {
    id: string;
    username: string;
    avatar_url?: string;
    banner_url?: string | null;
    is_plus?: boolean;
    subscription_tier?: string | null;
    subscription_status?: string | null;
    city?: string;
    country?: string;
    bio?: string | null;
    interests: string[];
    gender?: UserGender | null;
    birth_date?: string | null;
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

interface RawCursorResponse<T> {
    items: T[];
    limit: number;
    has_more: boolean;
    next_cursor?: string | null;
    next_before?: string | null;
}

export interface Post {
    id: string;
    user_id: string;
    username: string;
    avatar_url?: string;
    body: string;
    source_type?: 'daily_reflection' | string | null;
    source_id?: string | null;
    source_label?: string | null;
    created_at: string;
    comment_count: number;
    like_count: number;
    images: PostImage[];
    tags: string[];
}

export type FeedMode = 'home';
export type FeedItemKind = 'post' | 'reshare';
export type FeedEventType =
    | 'impression'
    | 'open_post'
    | 'open_comments'
    | 'comment'
    | 'like'
    | 'unlike'
    | 'share_open'
    | 'share_create'
    | 'hide'
    | 'mute_author';

export interface FeedActor {
    user_id: string;
    username: string;
    avatar_url?: string | null;
}

export interface ViewerFeedState {
    is_friend: boolean;
    is_liked: boolean;
    is_hidden: boolean;
    is_muted: boolean;
    is_reshared: boolean;
    is_own_post: boolean;
    is_own_share: boolean;
}

export interface EmbeddedPost {
    post_id: string;
    author: FeedActor;
    body: string;
    source_type?: 'daily_reflection' | string | null;
    source_id?: string | null;
    source_label?: string | null;
    images: PostImage[];
    created_at: string;
    like_count: number;
    comment_count: number;
    share_count: number;
    tags: string[];
}

export interface ReshareMetadata {
    share_id: string;
    original_post_id: string;
    commentary: string;
    created_at: string;
}

export interface FeedItem {
    id: string;
    kind: FeedItemKind;
    score: number;
    served_at_key: string;
    author: FeedActor;
    body: string;
    source_type?: 'daily_reflection' | string | null;
    source_id?: string | null;
    source_label?: string | null;
    images: PostImage[];
    tags: string[];
    created_at: string;
    like_count: number;
    comment_count: number;
    share_count: number;
    viewer_state: ViewerFeedState;
    original_post?: EmbeddedPost | null;
    reshare_metadata?: ReshareMetadata | null;
}

export interface HiddenFeedItem {
    item_id: string;
    item_kind: FeedItemKind;
    hidden_at: string;
    item: FeedItem;
}

export interface FeedImpressionInput {
    item_id: string;
    item_kind: FeedItemKind;
    feed_mode: FeedMode;
    session_id: string;
    position: number;
    served_at: string;
    viewed_at?: string;
    view_ms: number;
    was_clicked?: boolean;
    was_liked?: boolean;
    was_commented?: boolean;
}

export interface FeedEventInput {
    item_id: string;
    item_kind: FeedItemKind;
    feed_mode: FeedMode;
    event_type: FeedEventType;
    position?: number;
    event_at?: string;
    payload?: Record<string, unknown>;
}

interface RawPost extends Omit<Post, 'images' | 'tags'> {
    images?: RawPostImage[] | null;
    tags?: string[] | null;
}

interface RawEmbeddedPost extends Omit<EmbeddedPost, 'images' | 'tags'> {
    images?: RawPostImage[] | null;
    tags?: string[] | null;
}

interface RawFeedItem extends Omit<FeedItem, 'images' | 'tags' | 'original_post'> {
    images?: RawPostImage[] | null;
    tags?: string[] | null;
    original_post?: RawEmbeddedPost | null;
}

interface RawHiddenFeedItem extends Omit<HiddenFeedItem, 'item'> {
    item: RawFeedItem;
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

export interface NotificationItem {
    id: string;
    user_id: string;
    type: 'chat.message' | 'comment.mention' | string;
    actor_id?: string | null;
    resource_type: string;
    resource_id?: string | null;
    title: string;
    body: string;
    payload: Record<string, unknown>;
    created_at: string;
    read_at?: string | null;
}

export interface NotificationSummary {
    unread_count: number;
}

export interface MeetupCategory {
    slug: string;
    label: string;
    sort_order: number;
}

export type MeetupEventType = 'in_person' | 'online' | 'hybrid';
export type MeetupStatus = 'draft' | 'published' | 'cancelled' | 'completed';
export type MeetupVisibility = 'public' | 'unlisted';
export type MeetupSort = 'recommended' | 'soonest' | 'distance' | 'popular' | 'newest';
export type MeetupDatePreset = 'today' | 'tomorrow' | 'this_week' | 'this_weekend' | 'custom';
export type MeetupTimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';
export type MyMeetupScope = 'upcoming' | 'going' | 'drafts' | 'cancelled' | 'past';

export interface MeetupPersonPreview {
    id: string;
    username: string;
    avatar_url?: string | null;
}

export interface MeetupHost extends MeetupPersonPreview {
    role: string;
}

export interface Meetup {
    id: string;
    organizer_id: string;
    organizer_username: string;
    organizer_avatar_url?: string | null;
    title: string;
    description?: string | null;
    category_slug: string;
    category_label: string;
    event_type: MeetupEventType;
    status: MeetupStatus;
    visibility: MeetupVisibility;
    city: string;
    country?: string | null;
    venue_name?: string | null;
    address_line_1?: string | null;
    address_line_2?: string | null;
    how_to_find_us?: string | null;
    online_url?: string | null;
    cover_image_url?: string | null;
    starts_at: string;
    ends_at?: string | null;
    timezone: string;
    lat?: number | null;
    lng?: number | null;
    distance_km?: number | null;
    capacity?: number | null;
    attendee_count: number;
    waitlist_enabled: boolean;
    waitlist_count: number;
    saved_count: number;
    is_attending: boolean;
    is_waitlisted: boolean;
    can_manage: boolean;
    attendee_preview?: MeetupPersonPreview[];
    hosts?: MeetupHost[];
    published_at?: string | null;
    updated_at: string;
    created_at: string;
}

export interface MeetupAttendee {
    id: string;
    username: string;
    avatar_url?: string | null;
    city?: string | null;
    rsvp_at: string;
}

export interface MeetupRsvpResult {
    state: 'none' | 'going' | 'waitlisted';
    attending: boolean;
    waitlisted: boolean;
    attendee_count: number;
    waitlist_count: number;
}

export interface MeetupFilters {
    q?: string;
    category?: string;
    city?: string;
    distance_km?: number;
    event_type?: MeetupEventType;
    date_preset?: MeetupDatePreset;
    date_from?: string;
    date_to?: string;
    day_of_week?: number[];
    time_of_day?: MeetupTimeOfDay[];
    open_spots_only?: boolean;
    sort?: MeetupSort;
}

export interface MeetupUpsertInput {
    title: string;
    description?: string | null;
    category_slug: string;
    co_host_ids?: string[];
    event_type: MeetupEventType;
    status: Extract<MeetupStatus, 'draft' | 'published'>;
    visibility: MeetupVisibility;
    city: string;
    country?: string | null;
    venue_name?: string | null;
    address_line_1?: string | null;
    address_line_2?: string | null;
    how_to_find_us?: string | null;
    online_url?: string | null;
    cover_image_url?: string | null;
    starts_at: string;
    ends_at?: string | null;
    timezone: string;
    lat?: number | null;
    lng?: number | null;
    capacity?: number | null;
    waitlist_enabled: boolean;
}

export type SupportUrgency = 'low' | 'medium' | 'high';
export type SupportType = 'chat' | 'call' | 'meetup' | 'general';
export type SupportTopic =
    | 'anxiety'
    | 'relapse_risk'
    | 'loneliness'
    | 'cravings'
    | 'depression'
    | 'family'
    | 'work'
    | 'sleep'
    | 'celebration'
    | 'general';
export type PreferredGender = 'woman' | 'man' | 'non_binary' | 'no_preference';
export type SupportRequestFilter = 'all' | 'urgent' | 'unanswered';

export interface SupportLocation {
    city?: string | null;
    region?: string | null;
    country?: string | null;
    approximate_lat?: number | null;
    approximate_lng?: number | null;
    visibility: 'hidden' | 'city' | 'approximate';
}

export interface SupportRequest {
    id: string;
    requester_id: string;
    username: string;
    avatar_url?: string | null;
    city?: string | null;
    support_type: SupportType;
    topics: SupportTopic[];
    preferred_gender?: PreferredGender | null;
    location?: SupportLocation | null;
    message?: string | null;
    urgency: SupportUrgency;
    status: 'open' | 'active' | 'closed';
    reply_count: number;
    offer_count: number;
    view_count: number;
    is_priority: boolean;
    created_at: string;
    privacy_level?: 'standard' | 'private';
    accepted_responder_id?: string | null;
    accepted_at?: string | null;
    closed_at?: string | null;
    responder_id?: string | null;
    responder_username?: string | null;
    responder_avatar_url?: string | null;
    chat_id?: string | null;
    has_offered: boolean;
    has_replied: boolean;
    is_own_request: boolean;
}

export interface SupportOffer {
    id: string;
    support_request_id: string;
    responder_id: string;
    username: string;
    avatar_url?: string | null;
    city?: string | null;
    offer_type: Exclude<SupportType, 'general'>;
    message?: string | null;
    status: 'pending' | 'accepted' | 'not_selected';
    scheduled_for?: string | null;
    created_at: string;
    chat_id?: string | null;
}

export interface SupportReply {
    id: string;
    support_request_id: string;
    author_id: string;
    username: string;
    avatar_url?: string | null;
    body: string;
    created_at: string;
}

export interface CreateSupportRequestInput {
    support_type: SupportType;
    message?: string | null;
    urgency: SupportUrgency;
    topics: SupportTopic[];
    preferred_gender?: PreferredGender | null;
    location?: SupportLocation | null;
    privacy_level?: 'standard' | 'private';
}

export interface CreateSupportOfferInput {
    offer_type: Exclude<SupportType, 'general'>;
    message?: string | null;
}

export interface CreateSupportReplyInput {
    body: string;
}

export interface SupportChatContext {
    support_request_id: string;
    request_type: SupportRequest['support_type'];
    request_message?: string | null;
    requester_id: string;
    requester_username: string;
    latest_offer_type?: SupportOffer['offer_type'];
    status?: 'pending_requester_acceptance' | 'accepted' | 'declined' | 'closed';
    awaiting_user_id?: string | null;
}

export interface Chat {
    id: string;
    is_group: boolean;
    status?: 'request' | 'active' | 'declined' | 'closed';
    name?: string;
    username?: string;
    avatar_url?: string;
    created_at: string;
    last_message?: string;
    last_message_at?: string;
    unread_count?: number;
    support_context?: SupportChatContext;
}

export interface CreateSupportOfferResult {
    offer: SupportOffer;
    chat?: Chat;
}

export interface AcceptSupportOfferResult {
    request: SupportRequest;
}

export interface Message {
    id: string;
    chat_id?: string;
    sender_id: string;
    username: string;
    avatar_url?: string;
    kind?: 'user' | 'system';
    body: string;
    sent_at: string;
    client_message_id?: string | null;
    chat_seq?: number | null;
}

export interface MessagePage {
    items: Message[];
    limit: number;
    has_more: boolean;
    next_before?: string | null;
    other_user_last_read_message_id?: string | null;
}

export interface ChatMessageEnvelope {
    chat_id: string;
    message: Message;
    summary?: Chat | null;
}

export interface ChatMessageAckEnvelope {
    chat_id: string;
    client_message_id: string;
    message: Message;
    summary?: Chat | null;
}

export interface ChatReadReceiptEnvelope {
    chat_id: string;
    user_id: string;
    last_read_message_id?: string | null;
    read_at: string;
}

export interface ChatMessageFailedEnvelope {
    chat_id: string;
    client_message_id: string;
    error: string;
}

export interface ChatRealtimeServerEvent {
    type: string;
    event_id: string;
    occurred_at: string;
    cursor?: string;
    data?: unknown;
}

export type UserGender = 'woman' | 'man' | 'non_binary';
export type DiscoverSobrietyFilter = 'days_30' | 'days_90' | 'years_1' | 'years_5';
export type DiscoverRelaxedField = 'distance' | 'age' | 'interests' | 'sobriety';
export type DiscoverTooNarrowField = DiscoverRelaxedField | 'gender';

export interface DiscoverFiltersPayload {
    gender?: UserGender;
    ageMin?: number;
    ageMax?: number;
    distanceKm?: number;
    sobriety?: DiscoverSobrietyFilter;
    interests?: string[];
}

export interface DiscoverPreviewResponse {
    exact_count: number;
    broadened_count?: number;
    broadened_available: boolean;
    relaxed_filters?: DiscoverRelaxedField[];
    likely_too_narrow_fields?: DiscoverTooNarrowField[];
    effective_filters: {
        gender?: UserGender;
        age_min?: number;
        age_max?: number;
        distance_km?: number;
        sobriety?: DiscoverSobrietyFilter;
        interests?: string[];
    };
}

export interface UpdateMeInput {
    username?: string;
    city?: string;
    country?: string;
    gender?: UserGender | '';
    bio?: string | null;
    birth_date?: string;
    interests?: string[];
    sober_since?: string;
    lat?: number;
    lng?: number;
}

export interface DailyReflection {
    id: string;
    user_id: string;
    reflection_date: string;
    prompt_key?: string | null;
    prompt_text?: string | null;
    grateful_for?: string | null;
    on_mind?: string | null;
    blocking_today?: string | null;
    body: string;
    shared_post_id?: string | null;
    created_at: string;
    updated_at: string;
}

export interface UpsertDailyReflectionInput {
    prompt_key?: string | null;
    prompt_text?: string | null;
    grateful_for?: string | null;
    on_mind?: string | null;
    blocking_today?: string | null;
    body: string;
}

export interface RegisterInput {
    username: string;
    email: string;
    password: string;
    city?: string;
    country?: string;
    gender?: UserGender;
    birth_date?: string;
    sober_since?: string;
}

// ── Auth ───────────────────────────────────────────────────────────────────

// Creates a new user account and returns the initial auth payload.
export async function register(data: RegisterInput): Promise<{ token: string; user_id: string }> {
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

export async function uploadMeetupCoverImage(input: {
    uri: string;
    mimeType?: string;
    fileName?: string;
}): Promise<{ cover_image_url: string }> {
    const token = await getToken();
    const form = new FormData();
    form.append('cover', {
        uri: input.uri,
        name: input.fileName ?? 'meetup-cover.jpg',
        type: input.mimeType ?? 'image/jpeg',
    } as unknown as Blob);
    const res = await fetch(`${BASE_URL}/meetups/images`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
    });
    return parseDataResponse<{ cover_image_url: string }>(res);
}

// Silently records the caller's live GPS position and reverse-geocoded city.
export async function updateMyCurrentLocation(data: { lat: number; lng: number; city: string }): Promise<void> {
    await request('/users/me/location', { method: 'PATCH', body: JSON.stringify(data) });
}

// Fetches a public profile for another user by id.
export async function getUser(id: string): Promise<User> {
    return request(`/users/${id}`);
}

// ── Daily reflections ─────────────────────────────────────────────────────

export async function getTodayReflection(): Promise<DailyReflection | null> {
    return request('/reflections/today');
}

export async function upsertTodayReflection(input: UpsertDailyReflectionInput): Promise<DailyReflection> {
    return request('/reflections/today', { method: 'PUT', body: JSON.stringify(input) });
}

export async function listReflections(cursor?: string, limit = 20): Promise<CursorResponse<DailyReflection>> {
    const search = new URLSearchParams({ limit: String(limit) });
    if (cursor) search.set('before', cursor);
    return request(`/reflections?${search.toString()}`);
}

export async function getReflection(id: string): Promise<DailyReflection> {
    return request(`/reflections/${id}`);
}

export async function updateReflection(id: string, input: Partial<UpsertDailyReflectionInput>): Promise<DailyReflection> {
    return request(`/reflections/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export async function deleteReflection(id: string): Promise<void> {
    await request(`/reflections/${id}`, { method: 'DELETE' });
}

export async function shareReflection(id: string): Promise<{ post_id: string }> {
    return request(`/reflections/${id}/share`, { method: 'POST' });
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
    gender?: UserGender;
    ageMin?: number;
    ageMax?: number;
    distanceKm?: number;
    sobriety?: DiscoverSobrietyFilter;
    interests?: string[];
    lat?: number;
    lng?: number;
    cursor?: string;
    limit?: number;
    signal?: AbortSignal;
}): Promise<CursorResponse<User>> {
    const search = buildDiscoverSearchParams(params);
    const suffix = search.toString() ? `?${search.toString()}` : '';
    return request(`/users/discover${suffix}`, { signal: params?.signal });
}

export async function previewDiscoverUsers(params?: {
    query?: string;
    city?: string;
    gender?: UserGender;
    ageMin?: number;
    ageMax?: number;
    distanceKm?: number;
    sobriety?: DiscoverSobrietyFilter;
    interests?: string[];
    lat?: number;
    lng?: number;
}): Promise<DiscoverPreviewResponse> {
    const search = buildDiscoverSearchParams(params);
    const suffix = search.toString() ? `?${search.toString()}` : '';
    return request(`/users/discover/preview${suffix}`);
}

function buildDiscoverSearchParams(params?: {
    query?: string;
    city?: string;
    gender?: UserGender;
    ageMin?: number;
    ageMax?: number;
    distanceKm?: number;
    sobriety?: DiscoverSobrietyFilter;
    interests?: string[];
    lat?: number;
    lng?: number;
    cursor?: string;
    limit?: number;
}): URLSearchParams {
    const search = new URLSearchParams();
    if (params?.query?.trim()) search.set('q', params.query.trim());
    if (params?.city?.trim()) search.set('city', params.city.trim());
    if (params?.gender?.trim()) search.set('gender', params.gender.trim());
    if (typeof params?.ageMin === 'number') search.set('age_min', String(params.ageMin));
    if (typeof params?.ageMax === 'number') search.set('age_max', String(params.ageMax));
    if (typeof params?.distanceKm === 'number') search.set('distance_km', String(params.distanceKm));
    if (params?.sobriety?.trim()) search.set('sobriety', params.sobriety.trim());
    for (const interest of params?.interests ?? []) {
        if (interest.trim()) search.append('interest', interest.trim());
    }
    if (typeof params?.lat === 'number') search.set('lat', String(params.lat));
    if (typeof params?.lng === 'number') search.set('lng', String(params.lng));
    if (params?.cursor) search.set('cursor', params.cursor);
    if (params?.limit) search.set('limit', String(params.limit));
    return search;
}

// ── Feed & Posts ───────────────────────────────────────────────────────────

function normalizePost(post: RawPost): Post {
    return {
        ...post,
        images: (post.images ?? []).map(normalizePostImage),
        tags: normalizePostTags(post.tags),
    };
}

function normalizePostTags(tags?: string[] | null): string[] {
    return (tags ?? []).filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0);
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

function normalizeEmbeddedPost(post: RawEmbeddedPost): EmbeddedPost {
    return {
        ...post,
        images: (post.images ?? []).map(normalizePostImage),
        tags: normalizePostTags(post.tags),
    };
}

function normalizeFeedItem(item: RawFeedItem): FeedItem {
    return {
        ...item,
        images: (item.images ?? []).map(normalizePostImage),
        tags: normalizePostTags(item.tags),
        original_post: item.original_post ? normalizeEmbeddedPost(item.original_post) : item.original_post,
    };
}

async function getScopedFeed(scope: FeedMode, cursor?: string, limit = 20): Promise<CursorResponse<FeedItem>> {
    const search = new URLSearchParams({ limit: String(limit) });
    if (cursor) search.set('before', cursor);
    // The helper keeps the feed request shape centralized even though home is the only read surface now.
    const path = '/feed/home';
    const page = await request<CursorResponse<RawFeedItem>>(`${path}?${search.toString()}`);
    return {
        ...page,
        items: (page.items ?? []).map(normalizeFeedItem),
    };
}

export async function getHomeFeed(cursor?: string, limit = 20): Promise<CursorResponse<FeedItem>> {
    return getScopedFeed('home', cursor, limit);
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
export async function createPost(data: { body?: string; images?: PostImage[]; tags?: string[] }): Promise<{ id: string }> {
    return request('/posts', { method: 'POST', body: JSON.stringify(data) });
}

export async function sharePost(data: { postId: string; commentary?: string }): Promise<{ id: string }> {
    return request(`/posts/${data.postId}/share`, {
        method: 'POST',
        body: JSON.stringify({ commentary: data.commentary ?? '' }),
    });
}

export async function hideFeedItem(data: { itemId: string; itemKind: FeedItemKind }): Promise<void> {
    return request(`/feed/items/${data.itemId}/hide`, {
        method: 'POST',
        body: JSON.stringify({ item_kind: data.itemKind }),
    });
}

export async function unhideFeedItem(data: { itemId: string; itemKind: FeedItemKind }): Promise<void> {
    const search = new URLSearchParams({ item_kind: data.itemKind });
    return request(`/feed/items/${data.itemId}/hide?${search.toString()}`, {
        method: 'DELETE',
    });
}

export async function getHiddenFeedItems(cursor?: string, limit = 20): Promise<CursorResponse<HiddenFeedItem>> {
    const search = new URLSearchParams({ limit: String(limit) });
    if (cursor) search.set('before', cursor);
    const page = await request<CursorResponse<RawHiddenFeedItem>>(`/feed/hidden?${search.toString()}`);
    return {
        ...page,
        items: (page.items ?? []).map((item) => ({
            item_id: item.item_id,
            item_kind: item.item_kind,
            hidden_at: item.hidden_at,
            item: normalizeFeedItem(item.item),
        })),
    };
}

export async function muteFeedAuthor(authorId: string): Promise<void> {
    return request(`/feed/authors/${authorId}/mute`, { method: 'POST' });
}

export async function logFeedImpressions(impressions: FeedImpressionInput[]): Promise<{ logged: number }> {
    return request('/feed/impressions', {
        method: 'POST',
        body: JSON.stringify({ impressions }),
    });
}

export async function logFeedEvents(events: FeedEventInput[]): Promise<{ logged: number }> {
    return request('/feed/events', {
        method: 'POST',
        body: JSON.stringify({ events }),
    });
}

export async function reactToFeedItem(id: string, itemKind: FeedItemKind, type = 'like'): Promise<{ reacted: boolean }> {
    return request(`/feed/items/${id}/react`, {
        method: 'POST',
        body: JSON.stringify({ item_kind: itemKind, type }),
    });
}

export async function addFeedItemComment(itemId: string, itemKind: FeedItemKind, body: string, mentionUserIds: string[] = []): Promise<Comment> {
    const comment = await request<RawComment>(`/feed/items/${itemId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body, item_kind: itemKind, mention_user_ids: mentionUserIds }),
    });
    return normalizeComment(comment);
}

export async function getFeedItemComments(itemId: string, itemKind: FeedItemKind, cursor?: string, limit = 20): Promise<CursorResponse<Comment>> {
    const search = new URLSearchParams({
        limit: String(limit),
        item_kind: itemKind,
    });
    if (cursor) search.set('after', cursor);
    const page = await request<CursorResponse<RawComment>>(`/feed/items/${itemId}/comments?${search.toString()}`);
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
        hosts: meetup.hosts
            ? dedupeById(meetup.hosts)
            : meetup.hosts,
    };
}

function normalizeMeetupAttendee(attendee: MeetupAttendee): MeetupAttendee {
    return attendee;
}

// Fetches meetup events using cursor pagination and rich discovery filters.
export async function getMeetups(params?: MeetupFilters & { cursor?: string; limit?: number; signal?: AbortSignal }): Promise<CursorResponse<Meetup>> {
    const search = new URLSearchParams();
    if (params?.q) search.set('q', params.q);
    if (params?.category) search.set('category', params.category);
    if (params?.city) search.set('city', params.city);
    if (params?.distance_km !== undefined) search.set('distance_km', String(params.distance_km));
    if (params?.event_type) search.set('event_type', params.event_type);
    if (params?.date_preset) search.set('date_preset', params.date_preset);
    if (params?.date_from) search.set('date_from', params.date_from);
    if (params?.date_to) search.set('date_to', params.date_to);
    if (params?.day_of_week?.length) search.set('day_of_week', params.day_of_week.join(','));
    if (params?.time_of_day?.length) search.set('time_of_day', params.time_of_day.join(','));
    if (params?.open_spots_only) search.set('open_spots_only', 'true');
    if (params?.sort) search.set('sort', params.sort);
    if (params?.cursor) search.set('cursor', params.cursor);
    if (params?.limit) search.set('limit', String(params.limit));
    const suffix = search.toString() ? `?${search.toString()}` : '';
    const page = await request<CursorResponse<Meetup>>(`/meetups${suffix}`, { signal: params?.signal });
    return {
        ...page,
        items: (page.items ?? []).map(normalizeMeetup),
    };
}

// Loads available meetup categories for discovery and creation.
export async function getMeetupCategories(): Promise<MeetupCategory[]> {
    return request('/meetups/categories');
}

// Loads a single meetup detail record.
export async function getMeetup(id: string): Promise<Meetup> {
    return normalizeMeetup(await request<Meetup>(`/meetups/${id}`));
}

// Creates a new meetup with the provided event details.
export async function createMeetup(data: MeetupUpsertInput): Promise<Meetup> {
    return normalizeMeetup(await request<Meetup>('/meetups', { method: 'POST', body: JSON.stringify(data) }));
}

// Updates a meetup owned by the current user.
export async function updateMeetup(id: string, data: MeetupUpsertInput): Promise<Meetup> {
    return normalizeMeetup(await request<Meetup>(`/meetups/${id}`, { method: 'PATCH', body: JSON.stringify(data) }));
}

export async function deleteMeetup(id: string): Promise<{ deleted: boolean }> {
    return request(`/meetups/${id}`, { method: 'DELETE' });
}

export async function publishMeetup(id: string): Promise<Meetup> {
    return normalizeMeetup(await request<Meetup>(`/meetups/${id}/publish`, { method: 'POST' }));
}

export async function cancelMeetup(id: string): Promise<Meetup> {
    return normalizeMeetup(await request<Meetup>(`/meetups/${id}/cancel`, { method: 'POST' }));
}

// Loads meetups for the current user by organizer/attendance scope.
export async function getMyMeetups(scope: MyMeetupScope, cursor?: string, limit = 20): Promise<CursorResponse<Meetup>> {
    const search = new URLSearchParams({ scope, limit: String(limit) });
    if (cursor) search.set('cursor', cursor);
    const pageData = await request<CursorResponse<Meetup>>(`/users/me/meetups?${search.toString()}`);
    return {
        ...pageData,
        items: (pageData.items ?? []).map(normalizeMeetup),
    };
}

export async function createSupportRequest(data: CreateSupportRequestInput): Promise<SupportRequest> {
    return request('/support/requests', { method: 'POST', body: JSON.stringify(data) });
}

// Loads open support requests visible to the current user.
export async function getSupportRequests(
    filter: SupportRequestFilter = 'all',
    cursor?: string,
    limit = 20,
): Promise<CursorResponse<SupportRequest>> {
    const search = new URLSearchParams({ filter, limit: String(limit) });
    if (cursor) search.set('cursor', cursor);
    return request(`/support/requests?${search.toString()}`);
}

// Loads support requests created by the current user.
export async function getMySupportRequests(cursor?: string, limit = 20): Promise<CursorResponse<SupportRequest>> {
    const search = new URLSearchParams({ limit: String(limit) });
    if (cursor) search.set('before', cursor);
    return request(`/support/requests/mine?${search.toString()}`);
}

// Updates a support request owned by the current user.
export async function updateSupportRequest(id: string, data: {
    status: 'closed';
}): Promise<SupportRequest> {
    return request(`/support/requests/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function createSupportOffer(id: string, data: CreateSupportOfferInput): Promise<CreateSupportOfferResult> {
    return request(`/support/requests/${id}/offers`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function acceptSupportOffer(requestId: string, offerId: string): Promise<SupportRequest> {
    const result = await request<AcceptSupportOfferResult | SupportRequest>(
        `/support/requests/${requestId}/offers/${offerId}/accept`,
        { method: 'POST' },
    );
    return 'request' in result ? result.request : result;
}

export async function declineSupportOffer(requestId: string, offerId: string): Promise<void> {
    await request(`/support/requests/${requestId}/offers/${offerId}/decline`, { method: 'POST' });
}

export async function cancelSupportOffer(requestId: string, offerId: string): Promise<void> {
    await request(`/support/requests/${requestId}/offers/${offerId}/cancel`, { method: 'POST' });
}

export async function getSupportOffers(id: string, page = 1, limit = 20): Promise<PaginatedResponse<SupportOffer>> {
    const search = new URLSearchParams({
        page: String(page),
        limit: String(limit),
    });
    return request(`/support/requests/${id}/offers?${search.toString()}`);
}

export async function getSupportReplies(id: string, cursor?: string, limit = 20): Promise<CursorResponse<SupportReply>> {
    const search = new URLSearchParams({ limit: String(limit) });
    if (cursor) search.set('cursor', cursor);
    return request(`/support/requests/${id}/replies?${search.toString()}`);
}

export async function createSupportReply(id: string, data: CreateSupportReplyInput): Promise<SupportReply> {
    return request(`/support/requests/${id}/replies`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// Toggles the current user's RSVP or waitlist state for a meetup.
export async function rsvpMeetup(id: string): Promise<MeetupRsvpResult> {
    return request(`/meetups/${id}/rsvp`, { method: 'POST' });
}

// Loads the attendee list for a specific meetup.
export async function getMeetupAttendees(id: string, cursor?: string, limit = 50): Promise<CursorResponse<MeetupAttendee>> {
    const search = new URLSearchParams({ limit: String(limit) });
    if (cursor) search.set('cursor', cursor);
    const pageData = await request<CursorResponse<MeetupAttendee>>(`/meetups/${id}/attendees?${search.toString()}`);
    return {
        ...pageData,
        items: dedupeById((pageData.items ?? []).map(normalizeMeetupAttendee)),
    };
}

export async function getMeetupWaitlist(id: string, cursor?: string, limit = 50): Promise<CursorResponse<MeetupAttendee>> {
    const search = new URLSearchParams({ limit: String(limit) });
    if (cursor) search.set('cursor', cursor);
    const pageData = await request<CursorResponse<MeetupAttendee>>(`/meetups/${id}/waitlist?${search.toString()}`);
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

// Loads the current user's chat list.
export async function getChats(params?: { query?: string; before?: string | null; limit?: number }): Promise<CursorResponse<Chat>> {
    const search = new URLSearchParams();
    if (params?.query?.trim()) search.set('q', params.query.trim());
    if (params?.before && isOpaqueChatCursor(params.before)) search.set('before', params.before);
    if (params?.limit) search.set('limit', String(params.limit));
    const suffix = search.toString() ? `?${search.toString()}` : '';
    const page = await request<RawCursorResponse<Chat>>(`/chats${suffix}`);
    return {
        limit: page.limit,
        has_more: page.has_more,
        next_cursor: page.next_cursor ?? page.next_before ?? null,
        items: page.items ?? [],
    };
}

export async function getChat(chatId: string): Promise<Chat> {
    return request<Chat>(`/chats/${chatId}`);
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

export async function getNotifications(params?: { before?: string | null; limit?: number }): Promise<CursorResponse<NotificationItem>> {
    const search = new URLSearchParams();
    if (params?.before) search.set('before', params.before);
    if (params?.limit) search.set('limit', String(params.limit));
    const suffix = search.toString() ? `?${search.toString()}` : '';
    const page = await request<RawCursorResponse<NotificationItem>>(`/notifications${suffix}`);
    return {
        limit: page.limit,
        has_more: page.has_more,
        next_cursor: page.next_cursor ?? page.next_before ?? null,
        items: page.items ?? [],
    };
}

export async function getNotificationSummary(): Promise<NotificationSummary> {
    return request<NotificationSummary>('/notifications/summary');
}

export async function markNotificationRead(id: string): Promise<void> {
    await request(`/notifications/${id}/read`, { method: 'POST' });
}

export async function markNotificationsRead(ids: string[]): Promise<{ read: boolean; updated: number }> {
    return request('/notifications/read', {
        method: 'POST',
        body: JSON.stringify({ notification_ids: ids }),
    });
}

export async function markAllNotificationsRead(): Promise<{ read: boolean; updated: number }> {
    return request('/notifications/read-all', { method: 'POST' });
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
