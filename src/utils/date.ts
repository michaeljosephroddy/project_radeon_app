// Formats timestamps into compact readable labels with 24-hour time.
export function formatReadableTimestamp(dateStr?: string): string {
    if (!dateStr) return '';

    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '';

    const now = new Date();
    const sameYear = date.getFullYear() === now.getFullYear();
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const time = date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    if (isToday) return `Today, ${time}`;
    if (isYesterday) return `Yesterday, ${time}`;

    const dateLabel = date.toLocaleDateString([], {
        day: 'numeric',
        month: 'short',
        ...(sameYear ? {} : { year: 'numeric' }),
    });

    return `${dateLabel}, ${time}`;
}

interface RecoveryMilestone {
    days: number;
    label: string;
}

const RECOVERY_MILESTONES: RecoveryMilestone[] = [
    { days: 1, label: '24 Hours' },
    { days: 7, label: '7 Days' },
    { days: 30, label: '30 Days' },
    { days: 60, label: '60 Days' },
    { days: 90, label: '90 Days' },
    { days: 180, label: '180 Days' },
    { days: 270, label: '9 Months' },
    { days: 365, label: '1 Year' },
    { days: 730, label: '2 Years' },
    { days: 1825, label: '5 Years' },
];

function parseDateOnly(dateStr?: string): Date | null {
    if (!dateStr) return null;

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
    if (!match) {
        const parsed = new Date(dateStr);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const [, year, month, day] = match;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day), 12);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDayDifference(start: Date, end: Date): number {
    const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    return Math.floor((endUtc - startUtc) / 86400000);
}

export function formatSobrietyDate(dateStr?: string): string {
    const date = parseDateOnly(dateStr);
    if (!date) return '';

    return date.toLocaleDateString([], {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });
}

export function getRecoveryMilestone(dateStr?: string): {
    daysSober: number;
    currentLabel: string;
    nextLabel: string | null;
    daysToNext: number | null;
} | null {
    const date = parseDateOnly(dateStr);
    if (!date) return null;

    const daysSober = getDayDifference(date, new Date());
    if (daysSober < 0) return null;

    const current = [...RECOVERY_MILESTONES].reverse().find(milestone => daysSober >= milestone.days);
    const next = RECOVERY_MILESTONES.find(milestone => daysSober < milestone.days) ?? null;

    return {
        daysSober,
        currentLabel: current?.label ?? 'Day 0',
        nextLabel: next?.label ?? null,
        daysToNext: next ? next.days - daysSober : null,
    };
}

export function formatRecoveryDuration(daysSober: number): string {
    if (daysSober <= 0) return 'Day 0 in recovery';
    if (daysSober === 1) return '1 day in recovery';
    return `${daysSober} days in recovery`;
}

export function getSoberDayCount(dateStr?: string): number | null {
    const date = parseDateOnly(dateStr);
    if (!date) return null;

    const daysSober = getDayDifference(date, new Date());
    return daysSober < 0 ? null : daysSober;
}

export function formatSoberCounter(dateStr?: string): string {
    const start = parseDateOnly(dateStr);
    if (!start) return '';

    const now = new Date();
    const daysSober = getDayDifference(start, now);
    if (daysSober < 0) return '';
    if (daysSober === 0) return 'Sober today';
    if (daysSober === 1) return '1 day';
    if (daysSober < 31) return `${daysSober} days`;

    const duration = getCalendarDuration(start, now);
    const parts: string[] = [];
    if (duration.years > 0) parts.push(`${duration.years} ${duration.years === 1 ? 'year' : 'years'}`);
    if (duration.months > 0) parts.push(`${duration.months} ${duration.months === 1 ? 'month' : 'months'}`);
    if (duration.days > 0 && parts.length < 2) parts.push(`${duration.days} ${duration.days === 1 ? 'day' : 'days'}`);

    return parts.length > 0 ? parts.join(', ') : `${daysSober} days`;
}

export function formatSoberSinceLine(dateStr?: string): string {
    const formatted = formatSobrietyDate(dateStr);
    return formatted ? `Since ${formatted}` : '';
}

function getCalendarDuration(start: Date, end: Date): { years: number; months: number; days: number } {
    let years = end.getFullYear() - start.getFullYear();
    let anchor = addCalendarMonths(start, years * 12);
    if (anchor > end) {
        years -= 1;
        anchor = addCalendarMonths(start, years * 12);
    }

    let months = (end.getFullYear() - anchor.getFullYear()) * 12 + end.getMonth() - anchor.getMonth();
    let monthAnchor = addCalendarMonths(anchor, months);
    if (monthAnchor > end) {
        months -= 1;
        monthAnchor = addCalendarMonths(anchor, months);
    }

    return {
        years,
        months,
        days: Math.max(0, getDayDifference(monthAnchor, end)),
    };
}

function addCalendarMonths(date: Date, months: number): Date {
    const result = new Date(date.getFullYear(), date.getMonth() + months, 1, 12);
    const maxDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    result.setDate(Math.min(date.getDate(), maxDay));
    return result;
}
