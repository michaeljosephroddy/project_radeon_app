import * as api from '../../api/client';

export const SUPPORT_TYPE_LABELS: Record<api.SupportType, string> = {
    chat: 'Chat',
    call: 'Call',
    meetup: 'Meetup',
};

export const SUPPORT_URGENCY_LABELS: Record<api.SupportUrgency, string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
};

export const SUPPORT_TOPIC_LABELS: Record<api.SupportTopic, string> = {
    anxiety: 'Anxiety',
    relapse_risk: 'Relapse risk',
    loneliness: 'Loneliness',
    cravings: 'Cravings',
    depression: 'Depression',
    family: 'Family',
    work: 'Work',
    sleep: 'Sleep',
    celebration: 'Celebration',
};

export function normalizeSupportType(value: unknown): api.SupportType {
    if (value === 'call') return 'call';
    if (value === 'meetup') return 'meetup';
    return 'chat';
}

export function getSupportTypeLabel(value: unknown): string {
    return SUPPORT_TYPE_LABELS[normalizeSupportType(value)];
}

export function getSupportTopicLabel(value: unknown): string | null {
    if (
        value === 'anxiety'
        || value === 'relapse_risk'
        || value === 'loneliness'
        || value === 'cravings'
        || value === 'depression'
        || value === 'family'
        || value === 'work'
        || value === 'sleep'
        || value === 'celebration'
    ) {
        return SUPPORT_TOPIC_LABELS[value];
    }
    return null;
}

export function getSupportOfferType(request: api.SupportRequest): api.SupportType {
    return normalizeSupportType(request.support_type);
}

export function getSupportRequestLocationLabel(request: api.SupportRequest): string | null {
    const location = request.location;
    if (location?.visibility && location.visibility !== 'hidden') {
        return [location.city, location.region].filter(Boolean).join(', ') || null;
    }
    return request.city ?? null;
}

export function getSupportPrimaryActionLabel(request: api.SupportRequest): string {
    if (request.is_own_request) return request.status === 'active' && request.chat_id ? 'Open chat' : 'Manage';
    if (request.already_chatting) return 'Already chatting';
    if (request.status !== 'open') return 'View';
    return `Offer ${getSupportTypeLabel(getSupportOfferType(request)).toLowerCase()}`;
}

const SUPPORT_INTENT_LABELS: Record<api.SupportType, string> = {
    chat: 'Looking for a chat',
    call: 'Looking for a call',
    meetup: 'Looking for a meetup',
};

export function getSupportIntentLine(request: api.SupportRequest, locationLabel: string | null): string {
    const intent = SUPPORT_INTENT_LABELS[normalizeSupportType(request.support_type)];
    return locationLabel ? `${locationLabel} · ${intent}` : intent;
}

export function formatSupportActivityCounts(offerCount: number, replyCount: number): string | null {
    const parts: string[] = [];
    if (offerCount > 0) parts.push(`${offerCount} offer${offerCount === 1 ? '' : 's'}`);
    if (replyCount > 0) parts.push(`${replyCount} repl${replyCount === 1 ? 'y' : 'ies'}`);
    return parts.length > 0 ? parts.join(' · ') : null;
}
