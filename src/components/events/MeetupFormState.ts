import * as api from '../../api/client';

export interface MeetupFormValues {
    title: string;
    description: string;
    category_slug: string;
    co_host_ids: string[];
    event_type: api.MeetupEventType;
    visibility: api.MeetupVisibility;
    city: string;
    country: string;
    venue_name: string;
    address_line_1: string;
    address_line_2: string;
    how_to_find_us: string;
    online_url: string;
    cover_image_url: string;
    starts_on: string;
    starts_at: string;
    ends_on: string;
    ends_at: string;
    timezone: string;
    lat: number | null;
    lng: number | null;
    capacity: string;
    waitlist_enabled: boolean;
}
