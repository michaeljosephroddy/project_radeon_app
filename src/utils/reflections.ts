import * as api from '../api/client';

export const REFLECTION_QUESTIONS = {
    gratefulFor: "Today I'm grateful for",
    onMind: "What's on my mind?",
    blockingToday: "What's blocking me today?",
} as const;

export interface ReflectionAnswerEntry {
    question: string;
    answer: string;
}

export function getReflectionAnswerEntries(reflection: api.DailyReflection): ReflectionAnswerEntry[] {
    return [
        {
            question: REFLECTION_QUESTIONS.gratefulFor,
            answer: reflection.grateful_for ?? '',
        },
        {
            question: REFLECTION_QUESTIONS.onMind,
            answer: reflection.on_mind ?? '',
        },
        {
            question: REFLECTION_QUESTIONS.blockingToday,
            answer: reflection.blocking_today ?? '',
        },
    ];
}
