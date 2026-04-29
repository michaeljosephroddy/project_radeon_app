import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Persister, PersistedClient } from '@tanstack/query-persist-client-core';
import { trimPersistedInfiniteQueries } from './infiniteQueryPolicy';

const CACHE_KEY = 'react_query_cache';
const PERSIST_THROTTLE_MS = 1000;

let pendingClient: PersistedClient | undefined;
let persistTimer: ReturnType<typeof setTimeout> | undefined;

function schedulePersist(client: PersistedClient): void {
    pendingClient = client;
    if (persistTimer) return;

    persistTimer = setTimeout(() => {
        persistTimer = undefined;
        const nextClient = pendingClient;
        pendingClient = undefined;
        if (!nextClient) return;

        const trimmed = trimPersistedInfiniteQueries(nextClient);
        void AsyncStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
    }, PERSIST_THROTTLE_MS);
}

export const asyncStoragePersister: Persister = {
    persistClient: async (client: PersistedClient): Promise<void> => {
        schedulePersist(client);
    },
    restoreClient: async (): Promise<PersistedClient | undefined> => {
        const cachedState = await AsyncStorage.getItem(CACHE_KEY);
        if (!cachedState) return undefined;
        return trimPersistedInfiniteQueries(JSON.parse(cachedState) as PersistedClient);
    },
    removeClient: async (): Promise<void> => {
        pendingClient = undefined;
        if (persistTimer) {
            clearTimeout(persistTimer);
            persistTimer = undefined;
        }
        await AsyncStorage.removeItem(CACHE_KEY);
    },
};
