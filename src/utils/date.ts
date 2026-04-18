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
