import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as api from '../api/client';

interface AuthContextType {
    user: api.User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (data: Parameters<typeof api.register>[0]) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Provides app-wide auth state and auth actions to the component tree.
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<api.User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Rehydrate the session once on app launch. If the token is stale we clear
        // it here so the rest of the app can treat auth failures as logged out.
        (async () => {
            try {
                const token = await api.getToken();
                if (token) {
                    const me = await api.getMe();
                    setUser(me);
                }
            } catch {
                await api.clearToken();
            } finally {
                setIsLoading(false);
            }
        })();
    }, []);

    // Signs a user in, persists the token, and hydrates the full profile.
    const login = useCallback(async (email: string, password: string) => {
        const { token } = await api.login(email, password);
        await api.setToken(token);
        // Always fetch /me after auth so React state reflects canonical server data
        // instead of the partial fields returned by auth endpoints.
        const me = await api.getMe();
        setUser(me);
    }, []);

    // Registers a new user, persists the token, and hydrates the full profile.
    const register = useCallback(async (data: Parameters<typeof api.register>[0]) => {
        const { token } = await api.register(data);
        await api.setToken(token);
        const me = await api.getMe();
        setUser(me);
    }, []);

    // Clears local auth state and removes the current user from context.
    const logout = useCallback(async () => {
        await api.logout();
        setUser(null);
    }, []);

    // Refreshes the current user's profile from the API.
    const refreshUser = useCallback(async () => {
        const me = await api.getMe();
        setUser(me);
    }, []);

    return (
        <AuthContext.Provider value={{
            user,
            isLoading,
            isAuthenticated: !!user,
            login,
            register,
            logout,
            refreshUser,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

// Reads the auth context and ensures it is only used inside AuthProvider.
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
