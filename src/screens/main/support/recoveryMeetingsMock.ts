export type Fellowship = 'AA' | 'NA' | 'CA' | 'LifeRing' | 'SMART Recovery';

export type MeetingFormat = 'in_person' | 'online' | 'hybrid';

export type MeetingType =
    | 'Open'
    | 'Closed'
    | 'Step study'
    | 'Big Book'
    | 'Discussion'
    | 'Speaker'
    | 'Beginners'
    | 'Women only'
    | 'Men only'
    | 'LGBTQ+'
    | 'Tools-focused';

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface RecoveryMeeting {
    id: string;
    fellowship: Fellowship;
    name: string;
    description: string;
    day_of_week: DayOfWeek;
    start_time: string;
    duration_minutes: number;
    format: MeetingFormat;
    meeting_types: MeetingType[];
    country: string;
    city: string;
    venue: string | null;
    address: string | null;
}

export const FELLOWSHIPS: Fellowship[] = ['AA', 'NA', 'CA', 'LifeRing', 'SMART Recovery'];

export const MEETING_FORMATS: { value: MeetingFormat; label: string }[] = [
    { value: 'in_person', label: 'In person' },
    { value: 'online', label: 'Online' },
    { value: 'hybrid', label: 'Hybrid' },
];

export const MEETING_TYPES: MeetingType[] = [
    'Open',
    'Closed',
    'Step study',
    'Big Book',
    'Discussion',
    'Speaker',
    'Beginners',
    'Women only',
    'Men only',
    'LGBTQ+',
    'Tools-focused',
];

export const DAY_OPTIONS: { value: DayOfWeek; short: string; long: string }[] = [
    { value: 0, short: 'Sun', long: 'Sunday' },
    { value: 1, short: 'Mon', long: 'Monday' },
    { value: 2, short: 'Tue', long: 'Tuesday' },
    { value: 3, short: 'Wed', long: 'Wednesday' },
    { value: 4, short: 'Thu', long: 'Thursday' },
    { value: 5, short: 'Fri', long: 'Friday' },
    { value: 6, short: 'Sat', long: 'Saturday' },
];

export type TimeBucket = 'morning' | 'lunchtime' | 'evening' | 'late';

export const TIME_BUCKETS: { value: TimeBucket; label: string; range: string }[] = [
    { value: 'morning', label: 'Morning', range: 'Before 11:00' },
    { value: 'lunchtime', label: 'Lunchtime', range: '11:00 - 14:00' },
    { value: 'evening', label: 'Evening', range: '17:00 - 21:00' },
    { value: 'late', label: 'Late', range: 'After 21:00' },
];

export function timeBucketFor(start: string): TimeBucket {
    const [hh] = start.split(':').map(Number);
    if (hh < 11) return 'morning';
    if (hh < 14) return 'lunchtime';
    if (hh < 21) return 'evening';
    return 'late';
}

export function formatDayTime(day: DayOfWeek, start: string, durationMinutes: number): string {
    const dayLabel = DAY_OPTIONS[day].long;
    const [hh, mm] = start.split(':').map(Number);
    const end = new Date(2000, 0, 1, hh, mm + durationMinutes);
    const fmt = (d: Date) => d.toLocaleTimeString('default', { hour: 'numeric', minute: '2-digit' });
    const startFormatted = fmt(new Date(2000, 0, 1, hh, mm));
    return `${dayLabel}s - ${startFormatted} - ${fmt(end)}`;
}

export const RECOVERY_MEETINGS: RecoveryMeeting[] = [
    // Ireland
    {
        id: 'm-001',
        fellowship: 'CA',
        name: 'Sunlight of the Spirit',
        description: 'A gentle morning meeting for anyone starting their day with a reminder that recovery comes one day at a time.',
        day_of_week: 1,
        start_time: '07:30',
        duration_minutes: 60,
        format: 'in_person',
        meeting_types: ['Open', 'Discussion', 'Beginners'],
        country: 'Ireland',
        city: 'Dublin',
        venue: 'St Joseph\'s Church Hall',
        address: 'Berkeley Road, Phibsborough, Dublin 7',
    },
    {
        id: 'm-002',
        fellowship: 'SMART Recovery',
        name: 'Lunchtime Living Sober',
        description: 'A short midday meeting designed to fit around the working day. Bring your lunch.',
        day_of_week: 3,
        start_time: '12:30',
        duration_minutes: 45,
        format: 'in_person',
        meeting_types: ['Open', 'Discussion'],
        country: 'Ireland',
        city: 'Dublin',
        venue: 'Quaker Meeting House',
        address: '4-5 Eustace Street, Temple Bar, Dublin 2',
    },
    {
        id: 'm-003',
        fellowship: 'NA',
        name: 'Big Book Tuesday',
        description: 'Page-by-page reading and discussion of the Big Book. Newcomers and old timers welcome.',
        day_of_week: 2,
        start_time: '20:00',
        duration_minutes: 75,
        format: 'hybrid',
        meeting_types: ['Closed', 'Big Book', 'Step study'],
        country: 'Ireland',
        city: 'Dublin',
        venue: 'St Audoen\'s Parish Centre',
        address: 'Cornmarket, Dublin 8',
    },
    {
        id: 'm-004',
        fellowship: 'NA',
        name: 'Just for Today Cork',
        description: 'A welcoming Narcotics Anonymous meeting focused on living one day at a time.',
        day_of_week: 4,
        start_time: '19:30',
        duration_minutes: 75,
        format: 'in_person',
        meeting_types: ['Open', 'Discussion', 'Beginners'],
        country: 'Ireland',
        city: 'Cork',
        venue: 'Cork Recovery Hub',
        address: '12 Washington Street, Cork',
    },
    {
        id: 'm-005',
        fellowship: 'CA',
        name: 'Hope on the Coast',
        description: 'Cocaine Anonymous open speaker meeting with shared coffee afterwards.',
        day_of_week: 6,
        start_time: '11:00',
        duration_minutes: 90,
        format: 'in_person',
        meeting_types: ['Open', 'Speaker'],
        country: 'Ireland',
        city: 'Galway',
        venue: 'Galway Community Centre',
        address: 'Salthill, Galway',
    },
    {
        id: 'm-006',
        fellowship: 'SMART Recovery',
        name: 'SMART Tools Tuesday',
        description: 'Working through the SMART 4-Point Program - a CBT-based approach to addiction recovery.',
        day_of_week: 2,
        start_time: '18:30',
        duration_minutes: 90,
        format: 'online',
        meeting_types: ['Open', 'Tools-focused'],
        country: 'Ireland',
        city: 'Dublin',
        venue: null,
        address: null,
    },
    {
        id: 'm-007',
        fellowship: 'LifeRing',
        name: 'How Was Your Week',
        description: 'A secular peer support meeting where each person shares the highs and lows of their week in sobriety.',
        day_of_week: 4,
        start_time: '19:00',
        duration_minutes: 60,
        format: 'online',
        meeting_types: ['Open', 'Discussion'],
        country: 'Ireland',
        city: 'Dublin',
        venue: null,
        address: null,
    },
    {
        id: 'm-008',
        fellowship: 'AA',
        name: 'Women in Recovery Galway',
        description: 'A safe, women-only space for honest sharing and support.',
        day_of_week: 5,
        start_time: '19:30',
        duration_minutes: 75,
        format: 'in_person',
        meeting_types: ['Closed', 'Women only', 'Discussion'],
        country: 'Ireland',
        city: 'Galway',
        venue: 'St Nicholas\' Collegiate Church',
        address: 'Lombard Street, Galway',
    },
    {
        id: 'm-009',
        fellowship: 'NA',
        name: 'Clean and Free Limerick',
        description: 'Twelve-step working meeting. New members particularly welcome.',
        day_of_week: 1,
        start_time: '20:00',
        duration_minutes: 75,
        format: 'in_person',
        meeting_types: ['Open', 'Step study', 'Beginners'],
        country: 'Ireland',
        city: 'Limerick',
        venue: 'St John\'s Hospital Hall',
        address: 'St John\'s Square, Limerick',
    },
    {
        id: 'm-010',
        fellowship: 'AA',
        name: 'Pride Sober Dublin',
        description: 'An open AA meeting hosted by and for the LGBTQ+ recovery community.',
        day_of_week: 0,
        start_time: '17:00',
        duration_minutes: 75,
        format: 'in_person',
        meeting_types: ['Open', 'LGBTQ+', 'Discussion'],
        country: 'Ireland',
        city: 'Dublin',
        venue: 'Outhouse LGBT+ Community Resource Centre',
        address: '105 Capel Street, Dublin 1',
    },

    // United Kingdom
    {
        id: 'm-011',
        fellowship: 'AA',
        name: 'Camden Daily Reflection',
        description: 'A daily reflection meeting that opens with the day\'s reading from Daily Reflections.',
        day_of_week: 1,
        start_time: '08:00',
        duration_minutes: 60,
        format: 'in_person',
        meeting_types: ['Open', 'Discussion'],
        country: 'United Kingdom',
        city: 'London',
        venue: 'St Pancras Old Church Hall',
        address: 'Pancras Road, London NW1 1UL',
    },
    {
        id: 'm-012',
        fellowship: 'AA',
        name: 'Soho Sunday Night',
        description: 'A long-running open speaker meeting in the heart of Soho. Speakers from across London.',
        day_of_week: 0,
        start_time: '20:00',
        duration_minutes: 75,
        format: 'in_person',
        meeting_types: ['Open', 'Speaker'],
        country: 'United Kingdom',
        city: 'London',
        venue: 'St Anne\'s Church',
        address: '55 Dean Street, Soho, London W1D 6AF',
    },
    {
        id: 'm-013',
        fellowship: 'NA',
        name: 'Manchester Recovery',
        description: 'NA literature-based meeting. Shares always welcome.',
        day_of_week: 3,
        start_time: '19:30',
        duration_minutes: 90,
        format: 'in_person',
        meeting_types: ['Open', 'Discussion', 'Step study'],
        country: 'United Kingdom',
        city: 'Manchester',
        venue: 'Manchester Friends Meeting House',
        address: '6 Mount Street, Manchester M2 5NS',
    },
    {
        id: 'm-014',
        fellowship: 'CA',
        name: 'Edinburgh Hope and Recovery',
        description: 'Cocaine Anonymous meeting open to anyone with a desire to stop using.',
        day_of_week: 5,
        start_time: '19:30',
        duration_minutes: 75,
        format: 'hybrid',
        meeting_types: ['Open', 'Discussion'],
        country: 'United Kingdom',
        city: 'Edinburgh',
        venue: 'Augustine United Church',
        address: '41 George IV Bridge, Edinburgh EH1 1EL',
    },
    {
        id: 'm-015',
        fellowship: 'SMART Recovery',
        name: 'SMART Glasgow Online',
        description: 'Working with SMART tools - urge management, problem solving, and lifestyle balance.',
        day_of_week: 2,
        start_time: '19:00',
        duration_minutes: 90,
        format: 'online',
        meeting_types: ['Open', 'Tools-focused'],
        country: 'United Kingdom',
        city: 'Glasgow',
        venue: null,
        address: null,
    },
    {
        id: 'm-016',
        fellowship: 'LifeRing',
        name: 'LifeRing UK National',
        description: 'A weekly gathering of LifeRing members from across the UK. Secular, supportive, no religion.',
        day_of_week: 6,
        start_time: '10:00',
        duration_minutes: 75,
        format: 'online',
        meeting_types: ['Open', 'Discussion'],
        country: 'United Kingdom',
        city: 'London',
        venue: null,
        address: null,
    },
    {
        id: 'm-017',
        fellowship: 'AA',
        name: 'Brighton Beachfront Beginners',
        description: 'A relaxed beginners\' meeting on the seafront. Coffee, biscuits, and the steps.',
        day_of_week: 6,
        start_time: '11:30',
        duration_minutes: 75,
        format: 'in_person',
        meeting_types: ['Open', 'Beginners', 'Discussion'],
        country: 'United Kingdom',
        city: 'Brighton',
        venue: 'St Mary\'s Church',
        address: '60 St James\'s Street, Brighton BN2 1QF',
    },
    {
        id: 'm-018',
        fellowship: 'NA',
        name: 'Birmingham Just for Today',
        description: 'Open NA meeting - readings from Just for Today followed by sharing.',
        day_of_week: 4,
        start_time: '19:00',
        duration_minutes: 75,
        format: 'in_person',
        meeting_types: ['Open', 'Discussion'],
        country: 'United Kingdom',
        city: 'Birmingham',
        venue: 'Carrs Lane Church Centre',
        address: 'Carrs Lane, Birmingham B4 7SX',
    },

    // United States
    {
        id: 'm-019',
        fellowship: 'AA',
        name: 'Midtown Morning Meditation',
        description: 'Half meditation, half meeting. Start your day grounded.',
        day_of_week: 1,
        start_time: '07:00',
        duration_minutes: 60,
        format: 'in_person',
        meeting_types: ['Open', 'Discussion'],
        country: 'United States',
        city: 'New York',
        venue: 'St Peter\'s Episcopal Church',
        address: '619 Lexington Avenue, New York, NY 10022',
    },
    {
        id: 'm-020',
        fellowship: 'AA',
        name: 'Brooklyn Big Book',
        description: 'Step-by-step reading of the Big Book. We\'ll be on chapter 5 this week.',
        day_of_week: 2,
        start_time: '19:30',
        duration_minutes: 90,
        format: 'in_person',
        meeting_types: ['Closed', 'Big Book', 'Step study'],
        country: 'United States',
        city: 'New York',
        venue: 'Park Slope United Methodist Church',
        address: '6th Avenue & 8th Street, Brooklyn, NY 11215',
    },
    {
        id: 'm-021',
        fellowship: 'CA',
        name: 'Hollywood Hope CA',
        description: 'Cocaine Anonymous open speaker meeting. Light refreshments after.',
        day_of_week: 5,
        start_time: '20:00',
        duration_minutes: 90,
        format: 'in_person',
        meeting_types: ['Open', 'Speaker'],
        country: 'United States',
        city: 'Los Angeles',
        venue: 'Crescent Heights Methodist Church',
        address: '1296 N Fairfax Avenue, West Hollywood, CA 90046',
    },
    {
        id: 'm-022',
        fellowship: 'NA',
        name: 'Chicago Loop Lunchtime',
        description: 'NA meeting that fits in your lunch break. Quick reading, focused sharing.',
        day_of_week: 3,
        start_time: '12:15',
        duration_minutes: 45,
        format: 'in_person',
        meeting_types: ['Open', 'Discussion'],
        country: 'United States',
        city: 'Chicago',
        venue: 'St James Cathedral',
        address: '65 E Huron Street, Chicago, IL 60611',
    },
    {
        id: 'm-023',
        fellowship: 'SMART Recovery',
        name: 'SMART Boston Tools',
        description: 'Cognitive-behavioural tools for managing urges and rebuilding life.',
        day_of_week: 4,
        start_time: '18:30',
        duration_minutes: 90,
        format: 'hybrid',
        meeting_types: ['Open', 'Tools-focused'],
        country: 'United States',
        city: 'Boston',
        venue: 'Boston Public Library, Copley Branch',
        address: '700 Boylston Street, Boston, MA 02116',
    },
    {
        id: 'm-024',
        fellowship: 'LifeRing',
        name: 'Austin Sober Living Workshop',
        description: 'Building a sober life that works for you. Practical, supportive, secular.',
        day_of_week: 0,
        start_time: '17:30',
        duration_minutes: 75,
        format: 'in_person',
        meeting_types: ['Open', 'Discussion'],
        country: 'United States',
        city: 'Austin',
        venue: 'University Baptist Church',
        address: '2130 Guadalupe Street, Austin, TX 78705',
    },
    {
        id: 'm-025',
        fellowship: 'AA',
        name: 'San Francisco Castro Pride',
        description: 'Long-running LGBTQ+ AA meeting in the Castro. Open and warm.',
        day_of_week: 0,
        start_time: '19:00',
        duration_minutes: 75,
        format: 'in_person',
        meeting_types: ['Open', 'LGBTQ+', 'Discussion'],
        country: 'United States',
        city: 'San Francisco',
        venue: 'Most Holy Redeemer Catholic Church',
        address: '100 Diamond Street, San Francisco, CA 94114',
    },
    {
        id: 'm-026',
        fellowship: 'AA',
        name: 'Seattle Men\'s Stag Meeting',
        description: 'Closed men\'s discussion meeting. Honest sharing in a small group.',
        day_of_week: 2,
        start_time: '18:00',
        duration_minutes: 75,
        format: 'in_person',
        meeting_types: ['Closed', 'Men only', 'Discussion'],
        country: 'United States',
        city: 'Seattle',
        venue: 'Trinity United Methodist Church',
        address: '2317 Olympic Avenue W, Seattle, WA 98199',
    },
    {
        id: 'm-027',
        fellowship: 'NA',
        name: 'Portland Recovery Online',
        description: 'NA online meeting - a great option if you can\'t make it in person.',
        day_of_week: 6,
        start_time: '20:00',
        duration_minutes: 75,
        format: 'online',
        meeting_types: ['Open', 'Discussion'],
        country: 'United States',
        city: 'Portland',
        venue: null,
        address: null,
    },

    // Canada
    {
        id: 'm-028',
        fellowship: 'AA',
        name: 'Toronto Annex Tuesday',
        description: 'Long-standing open discussion meeting in the Annex. New members always welcome.',
        day_of_week: 2,
        start_time: '19:30',
        duration_minutes: 90,
        format: 'in_person',
        meeting_types: ['Open', 'Discussion', 'Beginners'],
        country: 'Canada',
        city: 'Toronto',
        venue: 'Trinity-St. Paul\'s United Church',
        address: '427 Bloor Street West, Toronto, ON M5S 1X7',
    },
    {
        id: 'm-029',
        fellowship: 'CA',
        name: 'Vancouver Coastal CA',
        description: 'Cocaine Anonymous open meeting near the seawall.',
        day_of_week: 5,
        start_time: '19:00',
        duration_minutes: 75,
        format: 'in_person',
        meeting_types: ['Open', 'Discussion'],
        country: 'Canada',
        city: 'Vancouver',
        venue: 'Vancouver Recovery Centre',
        address: '1110 Davie Street, Vancouver, BC V6E 1N1',
    },
    {
        id: 'm-030',
        fellowship: 'SMART Recovery',
        name: 'SMART Montreal Bilingue',
        description: 'Reunion SMART bilingue - partage en francais et en anglais.',
        day_of_week: 3,
        start_time: '18:30',
        duration_minutes: 90,
        format: 'online',
        meeting_types: ['Open', 'Tools-focused'],
        country: 'Canada',
        city: 'Montreal',
        venue: null,
        address: null,
    },
    {
        id: 'm-031',
        fellowship: 'NA',
        name: 'Calgary Clean Sunday',
        description: 'Weekly NA speaker meeting. Sponsorship table after.',
        day_of_week: 0,
        start_time: '11:00',
        duration_minutes: 75,
        format: 'in_person',
        meeting_types: ['Open', 'Speaker'],
        country: 'Canada',
        city: 'Calgary',
        venue: 'Sunalta Community Centre',
        address: '1627 10 Avenue SW, Calgary, AB T3C 0J5',
    },

    // Australia & New Zealand
    {
        id: 'm-032',
        fellowship: 'AA',
        name: 'Bondi Beach Steps',
        description: 'Step study meeting overlooking Bondi. Bring a hat.',
        day_of_week: 6,
        start_time: '08:00',
        duration_minutes: 60,
        format: 'in_person',
        meeting_types: ['Closed', 'Step study'],
        country: 'Australia',
        city: 'Sydney',
        venue: 'Bondi Pavilion',
        address: 'Queen Elizabeth Drive, Bondi Beach, NSW 2026',
    },
    {
        id: 'm-033',
        fellowship: 'NA',
        name: 'Melbourne Living Clean',
        description: 'NA discussion and reading from Living Clean. Open meeting.',
        day_of_week: 3,
        start_time: '19:30',
        duration_minutes: 75,
        format: 'in_person',
        meeting_types: ['Open', 'Discussion'],
        country: 'Australia',
        city: 'Melbourne',
        venue: 'Fitzroy Town Hall',
        address: '201 Napier Street, Fitzroy, VIC 3065',
    },
    {
        id: 'm-034',
        fellowship: 'LifeRing',
        name: 'LifeRing Auckland',
        description: 'Secular peer-to-peer recovery support. Talk about your week.',
        day_of_week: 4,
        start_time: '19:00',
        duration_minutes: 75,
        format: 'hybrid',
        meeting_types: ['Open', 'Discussion'],
        country: 'New Zealand',
        city: 'Auckland',
        venue: 'Ellen Melville Centre',
        address: '2 Freyberg Place, Auckland 1010',
    },
    {
        id: 'm-035',
        fellowship: 'AA',
        name: 'Wellington Women\'s Hour',
        description: 'A women-only open meeting with shared readings and reflection.',
        day_of_week: 1,
        start_time: '12:30',
        duration_minutes: 60,
        format: 'in_person',
        meeting_types: ['Closed', 'Women only', 'Discussion'],
        country: 'New Zealand',
        city: 'Wellington',
        venue: 'St Andrew\'s on the Terrace',
        address: '30 The Terrace, Wellington 6011',
    },

    // Extra Irish meetings (lean local for screenshots)
    {
        id: 'm-036',
        fellowship: 'AA',
        name: 'Dun Laoghaire Beginners',
        description: 'A welcoming first-stop meeting for anyone new to AA.',
        day_of_week: 0,
        start_time: '11:00',
        duration_minutes: 75,
        format: 'in_person',
        meeting_types: ['Open', 'Beginners', 'Discussion'],
        country: 'Ireland',
        city: 'Dublin',
        venue: 'Christ Church Dun Laoghaire',
        address: 'Park Road, Dun Laoghaire, Co. Dublin',
    },
    {
        id: 'm-037',
        fellowship: 'AA',
        name: 'Dublin Late Night Lifeline',
        description: 'A late meeting for shift workers and anyone struggling at night.',
        day_of_week: 4,
        start_time: '22:00',
        duration_minutes: 60,
        format: 'online',
        meeting_types: ['Open', 'Discussion'],
        country: 'Ireland',
        city: 'Dublin',
        venue: null,
        address: null,
    },
    {
        id: 'm-038',
        fellowship: 'CA',
        name: 'Cork Recovery Sunday',
        description: 'Weekly CA meeting. Speaker followed by open sharing.',
        day_of_week: 0,
        start_time: '19:30',
        duration_minutes: 90,
        format: 'in_person',
        meeting_types: ['Open', 'Speaker'],
        country: 'Ireland',
        city: 'Cork',
        venue: 'Triskel Christchurch',
        address: 'Tobin Street, Cork',
    },
    {
        id: 'm-039',
        fellowship: 'NA',
        name: 'Galway Friday Night Clean',
        description: 'NA literature meeting that closes out the working week.',
        day_of_week: 5,
        start_time: '19:30',
        duration_minutes: 75,
        format: 'in_person',
        meeting_types: ['Open', 'Step study', 'Discussion'],
        country: 'Ireland',
        city: 'Galway',
        venue: 'Galway Volunteer Centre',
        address: 'Mervue Business Park, Galway',
    },
    {
        id: 'm-040',
        fellowship: 'SMART Recovery',
        name: 'SMART Cork Online',
        description: 'Working through urge management, motivation, and lifestyle tools.',
        day_of_week: 1,
        start_time: '19:00',
        duration_minutes: 90,
        format: 'online',
        meeting_types: ['Open', 'Tools-focused', 'Beginners'],
        country: 'Ireland',
        city: 'Cork',
        venue: null,
        address: null,
    },
    {
        id: 'm-041',
        fellowship: 'AA',
        name: 'Limerick Saturday Morning',
        description: 'Open AA discussion meeting to start the weekend.',
        day_of_week: 6,
        start_time: '10:00',
        duration_minutes: 75,
        format: 'in_person',
        meeting_types: ['Open', 'Discussion'],
        country: 'Ireland',
        city: 'Limerick',
        venue: 'Redemptorist Community Centre',
        address: 'South Circular Road, Limerick',
    },
    {
        id: 'm-042',
        fellowship: 'LifeRing',
        name: 'LifeRing Dublin Weeknight',
        description: 'Weekly LifeRing meeting - an alcohol- and drug-free conversation about how the week went.',
        day_of_week: 2,
        start_time: '19:30',
        duration_minutes: 75,
        format: 'in_person',
        meeting_types: ['Open', 'Discussion'],
        country: 'Ireland',
        city: 'Dublin',
        venue: 'Pearse Street Library',
        address: '138-142 Pearse Street, Dublin 2',
    },
    {
        id: 'm-043',
        fellowship: 'AA',
        name: 'Dublin Sober Curious',
        description: 'A friendly open meeting for anyone exploring sobriety, including those still drinking.',
        day_of_week: 3,
        start_time: '18:30',
        duration_minutes: 75,
        format: 'hybrid',
        meeting_types: ['Open', 'Beginners', 'Discussion'],
        country: 'Ireland',
        city: 'Dublin',
        venue: 'St Andrew\'s Resource Centre',
        address: '114-116 Pearse Street, Dublin 2',
    },
    {
        id: 'm-044',
        fellowship: 'NA',
        name: 'Belfast Recovery Together',
        description: 'NA open meeting in central Belfast. Speaker followed by sharing.',
        day_of_week: 4,
        start_time: '20:00',
        duration_minutes: 90,
        format: 'in_person',
        meeting_types: ['Open', 'Speaker', 'Discussion'],
        country: 'United Kingdom',
        city: 'Belfast',
        venue: 'Belfast Unitarian Church',
        address: '7 Elmwood Avenue, Belfast BT9 6AA',
    },
    {
        id: 'm-045',
        fellowship: 'AA',
        name: 'Cardiff Bay Big Book',
        description: 'A focused Big Book study meeting. Working through the steps over a year.',
        day_of_week: 1,
        start_time: '19:30',
        duration_minutes: 75,
        format: 'in_person',
        meeting_types: ['Closed', 'Big Book', 'Step study'],
        country: 'United Kingdom',
        city: 'Cardiff',
        venue: 'Tabernacl Welsh Baptist Church',
        address: 'The Hayes, Cardiff CF10 1AJ',
    },
    {
        id: 'm-046',
        fellowship: 'CA',
        name: 'London Lambeth Open',
        description: 'Cocaine Anonymous open meeting south of the river.',
        day_of_week: 4,
        start_time: '19:30',
        duration_minutes: 75,
        format: 'in_person',
        meeting_types: ['Open', 'Discussion'],
        country: 'United Kingdom',
        city: 'London',
        venue: 'St John\'s Waterloo',
        address: '73 Waterloo Road, London SE1 8TY',
    },
    {
        id: 'm-047',
        fellowship: 'AA',
        name: 'NYC Women\'s Wednesday',
        description: 'Closed women\'s meeting. Strong, supportive group.',
        day_of_week: 3,
        start_time: '18:30',
        duration_minutes: 75,
        format: 'in_person',
        meeting_types: ['Closed', 'Women only', 'Discussion'],
        country: 'United States',
        city: 'New York',
        venue: 'St Bartholomew\'s Church',
        address: '325 Park Avenue, New York, NY 10022',
    },
    {
        id: 'm-048',
        fellowship: 'SMART Recovery',
        name: 'SMART Recovery Worldwide',
        description: 'Weekly SMART meeting open to participants from any timezone.',
        day_of_week: 0,
        start_time: '18:00',
        duration_minutes: 90,
        format: 'online',
        meeting_types: ['Open', 'Tools-focused'],
        country: 'United States',
        city: 'New York',
        venue: null,
        address: null,
    },
    {
        id: 'm-049',
        fellowship: 'AA',
        name: 'Dublin Family Group',
        description: 'AA meeting with childcare provided in the room next door. Parents very welcome.',
        day_of_week: 6,
        start_time: '11:00',
        duration_minutes: 75,
        format: 'in_person',
        meeting_types: ['Open', 'Discussion'],
        country: 'Ireland',
        city: 'Dublin',
        venue: 'Mount Argus Community Centre',
        address: 'Mount Argus Road, Harold\'s Cross, Dublin 6W',
    },
    {
        id: 'm-050',
        fellowship: 'AA',
        name: 'Dublin Sunset Reflection',
        description: 'A peaceful end-of-day reading and reflection meeting by the canal.',
        day_of_week: 5,
        start_time: '18:00',
        duration_minutes: 60,
        format: 'in_person',
        meeting_types: ['Open', 'Discussion'],
        country: 'Ireland',
        city: 'Dublin',
        venue: 'Portobello Institute',
        address: 'South Richmond Street, Dublin 2',
    },
];

export interface RecoveryMeetingFilters {
    query: string;
    fellowships: Fellowship[];
    country: string;
    city: string;
    daysOfWeek: DayOfWeek[];
    timeBuckets: TimeBucket[];
    format: MeetingFormat | '';
    meetingTypes: MeetingType[];
}

export const DEFAULT_MEETING_FILTERS: RecoveryMeetingFilters = {
    query: '',
    fellowships: [],
    country: '',
    city: '',
    daysOfWeek: [],
    timeBuckets: [],
    format: '',
    meetingTypes: [],
};

export function listCountries(): string[] {
    return Array.from(new Set(RECOVERY_MEETINGS.map((m) => m.country))).sort();
}

export function listCitiesForCountry(country: string): string[] {
    const filtered = country
        ? RECOVERY_MEETINGS.filter((m) => m.country === country)
        : RECOVERY_MEETINGS;
    return Array.from(new Set(filtered.map((m) => m.city))).sort();
}

export function applyMeetingFilters(
    meetings: RecoveryMeeting[],
    filters: RecoveryMeetingFilters,
): RecoveryMeeting[] {
    const q = filters.query.trim().toLowerCase();
    return meetings.filter((meeting) => {
        if (q) {
            const haystack = [
                meeting.name,
                meeting.fellowship,
                meeting.venue ?? '',
                meeting.city,
                meeting.country,
                meeting.meeting_types.join(' '),
            ].join(' ').toLowerCase();
            if (!haystack.includes(q)) return false;
        }
        if (filters.fellowships.length && !filters.fellowships.includes(meeting.fellowship)) return false;
        if (filters.country && meeting.country !== filters.country) return false;
        if (filters.city && meeting.city !== filters.city) return false;
        if (filters.daysOfWeek.length && !filters.daysOfWeek.includes(meeting.day_of_week)) return false;
        if (filters.timeBuckets.length && !filters.timeBuckets.includes(timeBucketFor(meeting.start_time))) return false;
        if (filters.format && meeting.format !== filters.format) return false;
        if (filters.meetingTypes.length && !filters.meetingTypes.some((t) => meeting.meeting_types.includes(t))) return false;
        return true;
    });
}

export interface ActiveFilterChip {
    key: string;
    label: string;
    remove: (filters: RecoveryMeetingFilters) => RecoveryMeetingFilters;
}

export function getActiveFilterChips(filters: RecoveryMeetingFilters): ActiveFilterChip[] {
    const chips: ActiveFilterChip[] = [];
    for (const fellowship of filters.fellowships) {
        chips.push({
            key: `fellowship:${fellowship}`,
            label: fellowship,
            remove: (current) => ({ ...current, fellowships: current.fellowships.filter((f) => f !== fellowship) }),
        });
    }
    if (filters.country) {
        chips.push({
            key: 'country',
            label: filters.country,
            remove: (current) => ({ ...current, country: '', city: '' }),
        });
    }
    if (filters.city) {
        chips.push({
            key: 'city',
            label: filters.city,
            remove: (current) => ({ ...current, city: '' }),
        });
    }
    for (const day of filters.daysOfWeek) {
        chips.push({
            key: `day:${day}`,
            label: DAY_OPTIONS[day].long,
            remove: (current) => ({ ...current, daysOfWeek: current.daysOfWeek.filter((d) => d !== day) }),
        });
    }
    for (const bucket of filters.timeBuckets) {
        const opt = TIME_BUCKETS.find((b) => b.value === bucket);
        chips.push({
            key: `time:${bucket}`,
            label: opt?.label ?? bucket,
            remove: (current) => ({ ...current, timeBuckets: current.timeBuckets.filter((t) => t !== bucket) }),
        });
    }
    if (filters.format) {
        const opt = MEETING_FORMATS.find((f) => f.value === filters.format);
        chips.push({
            key: 'format',
            label: opt?.label ?? filters.format,
            remove: (current) => ({ ...current, format: '' }),
        });
    }
    for (const type of filters.meetingTypes) {
        chips.push({
            key: `type:${type}`,
            label: type,
            remove: (current) => ({ ...current, meetingTypes: current.meetingTypes.filter((t) => t !== type) }),
        });
    }
    return chips;
}
