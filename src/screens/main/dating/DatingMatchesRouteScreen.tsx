import React, { useCallback, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { appAlert } from '../../../components/ui/appAlert';
import { DatingMatchesScreen } from '../../../components/discover/DatingMatchesScreen';
import * as api from '../../../api/client';
import { useDatingMatches, useMarkDatingMatchesSeen, useUnmatchDatingMatch } from '../../../hooks/queries/useDatingMatches';
import type { RootStackParamList } from '../../../navigation/types';

export function DatingMatchesRouteScreen(): React.ReactElement {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const matchesQuery = useDatingMatches({ limit: 20 }, true);
    const markSeenMutation = useMarkDatingMatchesSeen();
    const unmatchMutation = useUnmatchDatingMatch();
    const [unmatchingIds, setUnmatchingIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        markSeenMutation.mutate();
    }, []);

    const logDatingEvent = useCallback((event: api.DatingEventInput): void => {
        void api.logDatingEvents([{ ...event, event_at: new Date().toISOString() }]).catch(() => {});
    }, []);

    const handleOpenChat = useCallback(async (match: api.DatingMatch): Promise<void> => {
        if (!match.chat_id) return;

        try {
            const chat = await api.getChat(match.chat_id);
            logDatingEvent({ event_type: 'chat_opened', match_id: match.id, profile_id: match.profile.id });
            navigation.navigate('Chat', { chat });
        } catch (error: unknown) {
            appAlert.alert('Could not open chat', error instanceof Error ? error.message : 'Please try again.');
        }
    }, [logDatingEvent, navigation]);

    const handleOpenProfile = useCallback((profile: api.DatingProfile): void => {
        logDatingEvent({ event_type: 'profile_opened', profile_id: profile.id });
        navigation.navigate('DatingProfileDetail', {
            profileId: profile.id,
            initialProfile: profile,
        });
    }, [logDatingEvent, navigation]);

    const handleUnmatch = useCallback((match: api.DatingMatch): void => {
        setUnmatchingIds((current) => new Set([...current, match.id]));
        logDatingEvent({ event_type: 'unmatch', match_id: match.id, profile_id: match.profile.id });
        unmatchMutation.mutate(match.id, {
            onError: (error: unknown) => {
                appAlert.alert('Could not unmatch', error instanceof Error ? error.message : 'Please try again.');
            },
            onSettled: () => {
                setUnmatchingIds((current) => {
                    const next = new Set(current);
                    next.delete(match.id);
                    return next;
                });
            },
        });
    }, [logDatingEvent, unmatchMutation]);

    return (
        <DatingMatchesScreen
            matches={matchesQuery.matches ?? []}
            loading={matchesQuery.isLoading}
            fetchingNext={matchesQuery.isFetchingNextPage}
            hasNextPage={Boolean(matchesQuery.hasNextPage)}
            unmatchingIds={unmatchingIds}
            onBack={() => navigation.goBack()}
            onOpenChat={(match) => void handleOpenChat(match)}
            onOpenProfile={handleOpenProfile}
            onUnmatch={handleUnmatch}
            onLoadMore={() => {
                if (matchesQuery.hasNextPage && !matchesQuery.isFetchingNextPage) {
                    void matchesQuery.fetchNextPage();
                }
            }}
        />
    );
}
