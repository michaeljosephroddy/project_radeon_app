import * as api from '../../api/client';

export const SUPPORT_TYPE_LABELS: Record<api.SupportType, string> = {
    chat: 'Chat',
    call: 'Call',
    meetup: 'Meetup',
    general: 'General',
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
    general: 'General',
};

export function getSupportOfferType(request: api.SupportRequest): Exclude<api.SupportType, 'general'> {
    return request.support_type === 'general' ? 'chat' : request.support_type;
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
    if (request.status !== 'open') return 'View';
    if (request.support_type === 'general') return 'Reply';
    return `Offer ${SUPPORT_TYPE_LABELS[getSupportOfferType(request)].toLowerCase()}`;
}
