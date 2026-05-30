import React, { createContext, useContext, useMemo } from 'react';
import * as api from '../api/client';
import { useActiveSupportSignals, useMySupportSignal } from '../hooks/queries/useSupport';
import { useAuth } from '../hooks/useAuth';

interface ReachOutStatusContextValue {
    getSignalForIdentity: (identity: { userId?: string | null; username?: string | null }) => api.SupportSignal | null;
    focusSignalId: string | null;
}

const ReachOutStatusContext = createContext<ReachOutStatusContextValue>({
    getSignalForIdentity: () => null,
    focusSignalId: null,
});

interface ReachOutStatusProviderProps {
    children: React.ReactNode;
    focusSignalId?: string | null;
}

export function ReachOutStatusProvider({
    children,
    focusSignalId = null,
}: ReachOutStatusProviderProps): React.ReactElement {
    const { isAuthenticated, isNewUser } = useAuth();
    const enabled = isAuthenticated && !isNewUser;
    const activeSignalsQuery = useActiveSupportSignals(100, enabled);
    const mySignalQuery = useMySupportSignal(enabled);

    const value = useMemo<ReachOutStatusContextValue>(() => {
        const signals = activeSignalsQuery.data?.pages.flatMap((page) => page.items ?? []) ?? [];
        const allSignals = mySignalQuery.data ? [mySignalQuery.data, ...signals] : signals;
        const byUserId = new Map<string, api.SupportSignal>();
        const byUsername = new Map<string, api.SupportSignal>();

        for (const signal of allSignals) {
            byUserId.set(signal.user_id, signal);
            byUsername.set(normalizeUsername(signal.username), signal);
        }

        return {
            focusSignalId,
            getSignalForIdentity: ({ userId, username }) => {
                if (userId && byUserId.has(userId)) {
                    return byUserId.get(userId) ?? null;
                }
                if (username) {
                    return byUsername.get(normalizeUsername(username)) ?? null;
                }
                return null;
            },
        };
    }, [activeSignalsQuery.data, focusSignalId, mySignalQuery.data]);

    return (
        <ReachOutStatusContext.Provider value={value}>
            {children}
        </ReachOutStatusContext.Provider>
    );
}

export function useReachOutStatus(): ReachOutStatusContextValue {
    return useContext(ReachOutStatusContext);
}

function normalizeUsername(value: string): string {
    return value.replace(/^@+/, '').trim().toLowerCase();
}
