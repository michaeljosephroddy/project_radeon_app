import * as api from '../../../api/client';
import { REFLECTION_QUESTIONS } from '../../../utils/reflections';

export type ReflectionView = 'write' | 'review' | 'history' | 'detail';

export interface GroupedReflections {
    monthKey: string;
    monthLabel: string;
    items: api.DailyReflection[];
}

export function composeReflectionBody(
    gratefulFor: string,
    onMind: string,
    blockingToday: string,
): string {
    const parts: string[] = [];
    const grateful = gratefulFor.trim();
    const mind = onMind.trim();
    const blocking = blockingToday.trim();
    if (grateful) parts.push(`${REFLECTION_QUESTIONS.gratefulFor}\n${grateful}`);
    if (mind) parts.push(`${REFLECTION_QUESTIONS.onMind}\n${mind}`);
    if (blocking) parts.push(`${REFLECTION_QUESTIONS.blockingToday}\n${blocking}`);
    return parts.join('\n\n');
}

export function getGratefulFor(reflection?: api.DailyReflection | null): string {
    return reflection?.grateful_for ?? '';
}

export function getOnMind(reflection?: api.DailyReflection | null): string {
    if (!reflection) return '';
    if (reflection.on_mind) return reflection.on_mind;
    if (!reflection.grateful_for && !reflection.blocking_today) return reflection.body;
    return '';
}

export function getBlockingToday(reflection?: api.DailyReflection | null): string {
    return reflection?.blocking_today ?? '';
}

export function groupReflectionsByMonth(
    items: api.DailyReflection[],
): GroupedReflections[] {
    const groups = new Map<string, GroupedReflections>();
    for (const item of items) {
        const date = new Date(`${item.reflection_date}T12:00:00`);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = date.toLocaleDateString([], { month: 'long', year: 'numeric' });
        const existing = groups.get(monthKey);
        if (existing) {
            existing.items.push(item);
        } else {
            groups.set(monthKey, { monthKey, monthLabel, items: [item] });
        }
    }
    return Array.from(groups.values());
}

export function getBackHandler(
    view: ReflectionView,
    detailBackCloses: boolean,
    onBack: () => void,
    setView: (next: ReflectionView) => void,
): () => void {
    switch (view) {
        case 'detail':
            return detailBackCloses ? onBack : () => setView('history');
        case 'review':
        case 'history':
            return () => setView('write');
        case 'write':
            return onBack;
    }
}
