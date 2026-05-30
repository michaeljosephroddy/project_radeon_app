import React, { useSyncExternalStore } from 'react';
import * as api from '../api/client';
import type { DiscoverDraftFilters } from '../hooks/useDiscoverFilters';
import type { MeetupDraftFilters } from '../hooks/useMeetupFilters';
import type { RecoveryMeetingFilters } from '../screens/main/support/recoveryMeetings';

interface Store<T> {
    current: T | null;
    listeners: Set<() => void>;
}

function createStore<T>() {
    const store: Store<T> = {
        current: null,
        listeners: new Set(),
    };

    const subscribe = (listener: () => void): (() => void) => {
        store.listeners.add(listener);
        return () => {
            store.listeners.delete(listener);
        };
    };

    const set = (value: T | null): void => {
        store.current = value;
        store.listeners.forEach((listener) => listener());
    };

    const useValue = (): T | null => useSyncExternalStore(
        subscribe,
        () => store.current,
        () => store.current,
    );

    const get = (): T | null => store.current;

    return { set, useValue, get };
}

export interface DiscoverFiltersRouteState {
    draftFilters: DiscoverDraftFilters;
    onChangeFilters: React.Dispatch<React.SetStateAction<DiscoverDraftFilters>>;
    preview?: api.DiscoverPreviewResponse;
    previewLoading: boolean;
    validationError?: string;
    interestOptions: string[];
    onClose: () => void;
    onReset: () => void;
    onApply: () => boolean | void;
}

export interface MeetupFiltersRouteState {
    draftFilters: MeetupDraftFilters;
    categories: api.MeetupCategory[];
    onChangeFilters: React.Dispatch<React.SetStateAction<MeetupDraftFilters>>;
    onClose: () => void;
    onReset: () => void;
    onApply: () => boolean | void;
}

export interface RecoveryMeetingFiltersRouteState {
    draftFilters: RecoveryMeetingFilters;
    onChangeFilters: React.Dispatch<React.SetStateAction<RecoveryMeetingFilters>>;
    onClose: () => void;
    onReset: () => void;
    onApply: () => boolean | void;
}

export interface GroupFiltersRouteState {
    draftChip: { label: string; tag?: string; recoveryPathway?: string } | null;
    setDraftChip: React.Dispatch<React.SetStateAction<{ label: string; tag?: string; recoveryPathway?: string } | null>>;
    draftGroupType: 'all' | 'standard' | 'support';
    setDraftGroupType: React.Dispatch<React.SetStateAction<'all' | 'standard' | 'support'>>;
    draftCountry: string;
    setDraftCountry: React.Dispatch<React.SetStateAction<string>>;
    draftCity: string;
    setDraftCity: React.Dispatch<React.SetStateAction<string>>;
    onClose: () => void;
    onReset: () => void;
    onApply: () => boolean | void;
}

const discoverFiltersStore = createStore<DiscoverFiltersRouteState>();
const meetupFiltersStore = createStore<MeetupFiltersRouteState>();
const recoveryMeetingFiltersStore = createStore<RecoveryMeetingFiltersRouteState>();
const groupFiltersStore = createStore<GroupFiltersRouteState>();

export const setDiscoverFiltersRouteState = discoverFiltersStore.set;
export const useDiscoverFiltersRouteState = discoverFiltersStore.useValue;
export const getDiscoverFiltersRouteState = discoverFiltersStore.get;

export const setMeetupFiltersRouteState = meetupFiltersStore.set;
export const useMeetupFiltersRouteState = meetupFiltersStore.useValue;
export const getMeetupFiltersRouteState = meetupFiltersStore.get;

export const setRecoveryMeetingFiltersRouteState = recoveryMeetingFiltersStore.set;
export const useRecoveryMeetingFiltersRouteState = recoveryMeetingFiltersStore.useValue;
export const getRecoveryMeetingFiltersRouteState = recoveryMeetingFiltersStore.get;

export const setGroupFiltersRouteState = groupFiltersStore.set;
export const useGroupFiltersRouteState = groupFiltersStore.useValue;
export const getGroupFiltersRouteState = groupFiltersStore.get;
