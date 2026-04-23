import { QueryKey } from '@tanstack/react-query';

export interface InfiniteQueryPolicy {
    persist: boolean;
    persistedPages: number;
    refetchOnMount?: boolean | 'always';
}

const INFINITE_QUERY_POLICIES: Record<string, InfiniteQueryPolicy> = {
    feed: {
        persist: true,
        persistedPages: 1,
        refetchOnMount: true,
    },
    discover: {
        persist: true,
        persistedPages: 1,
        refetchOnMount: true,
    },
    chats: {
        persist: true,
        persistedPages: 1,
        refetchOnMount: true,
    },
    meetups: {
        persist: true,
        persistedPages: 1,
        refetchOnMount: true,
    },
    'my-meetups': {
        persist: true,
        persistedPages: 1,
        refetchOnMount: true,
    },
    'support-requests': {
        persist: true,
        persistedPages: 1,
        refetchOnMount: true,
    },
    'user-posts': {
        persist: true,
        persistedPages: 1,
        refetchOnMount: true,
    },
    'chat-messages': {
        persist: true,
        persistedPages: 3,
        refetchOnMount: true,
    },
};

function getPolicyScope(queryKey: QueryKey): string | undefined {
    const [scope] = queryKey;
    return typeof scope === 'string' ? scope : undefined;
}

export function getInfiniteQueryPolicy(queryKey: QueryKey): InfiniteQueryPolicy | undefined {
    const scope = getPolicyScope(queryKey);
    return scope ? INFINITE_QUERY_POLICIES[scope] : undefined;
}
