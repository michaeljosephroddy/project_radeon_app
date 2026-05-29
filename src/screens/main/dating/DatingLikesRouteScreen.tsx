import React, { useCallback, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { appAlert } from '../../../components/ui/appAlert';
import { DiscoverEmptyState } from '../../../components/discover/DiscoverEmptyState';
import { DatingLikesScreen } from '../../../components/discover/DatingLikesScreen';
import * as api from '../../../api/client';
import { queryClient } from '../../../query/queryClient';
import { useDatingLikes } from '../../../hooks/queries/useDatingLikes';
import { useDatingLikesPreview } from '../../../hooks/queries/useDatingLikesPreview';
import { useAuth } from '../../../hooks/useAuth';
import type { RootStackParamList } from '../../../navigation/types';

export function DatingLikesRouteScreen(): React.ReactElement {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { user } = useAuth();
    const likesEntitled = user?.is_plus === true;
    const likesQuery = useDatingLikes({ limit: 20 }, likesEntitled);
    const likesPreviewQuery = useDatingLikesPreview(!likesEntitled);
    const [pendingActionIds, setPendingActionIds] = useState<Set<string>>(new Set());
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
    const profiles = (likesQuery.profiles ?? []).filter((profile) => !dismissedIds.has(profile.id));
    const previewCount = likesPreviewQuery.data?.exact_count ?? 0;

    const logDatingEvent = useCallback((event: api.DatingEventInput): void => {
        void api.logDatingEvents([{ ...event, event_at: new Date().toISOString() }]).catch(() => {});
    }, []);

    const handleDatingAction = useCallback(async (profile: api.DatingProfile, action: api.DatingAction): Promise<void> => {
        if (pendingActionIds.has(profile.id)) return;

        setPendingActionIds((current) => new Set([...current, profile.id]));
        setDismissedIds((current) => new Set([...current, profile.id]));
        logDatingEvent({ event_type: action, profile_id: profile.id });

        try {
            const result = await api.recordDatingAction(profile.id, action);
            if (result.matched && result.match) {
                logDatingEvent({ event_type: 'match_created', profile_id: result.match.profile.id, match_id: result.match.id });
                void queryClient.invalidateQueries({ queryKey: ['dating-matches'] });
                void queryClient.invalidateQueries({ queryKey: ['chats'] });
            }
            void queryClient.invalidateQueries({ queryKey: ['dating-likes'] });
            void queryClient.invalidateQueries({ queryKey: ['dating-likes-preview'] });
            void queryClient.invalidateQueries({ queryKey: ['dating-discover'] });
        } catch (error: unknown) {
            setDismissedIds((current) => {
                const next = new Set(current);
                next.delete(profile.id);
                return next;
            });
            appAlert.alert(
                action === 'like' ? 'Could not like profile' : 'Could not pass profile',
                error instanceof Error ? error.message : 'Please try again.',
            );
        } finally {
            setPendingActionIds((current) => {
                const next = new Set(current);
                next.delete(profile.id);
                return next;
            });
        }
    }, [logDatingEvent, pendingActionIds]);

    const handleOpenProfile = useCallback((profile: api.DatingProfile): void => {
        if (!profile.user_id) return;
        logDatingEvent({ event_type: 'profile_opened', profile_id: profile.id });
        navigation.navigate('UserProfile', {
            userId: profile.user_id,
            username: profile.username,
            avatarUrl: profile.photos[0]?.image_url,
        });
    }, [logDatingEvent, navigation]);

    if (!likesEntitled) {
        return (
            <DiscoverEmptyState
                title={previewCount > 0 ? `${previewCount} liked you` : 'See who likes you'}
                description="Likes You is ready for SoberSpace Plus. You can keep discovering matches now, and this list unlocks when Plus is active."
                primaryLabel="Back to Dating"
                onPrimaryPress={() => navigation.goBack()}
            />
        );
    }

    return (
        <DatingLikesScreen
            likes={profiles}
            loading={likesQuery.isLoading}
            fetchingNext={likesQuery.isFetchingNextPage}
            hasNextPage={Boolean(likesQuery.hasNextPage)}
            pendingActionIds={pendingActionIds}
            onBack={() => navigation.goBack()}
            onLike={(profile) => void handleDatingAction(profile, 'like')}
            onPass={(profile) => void handleDatingAction(profile, 'pass')}
            onOpenProfile={handleOpenProfile}
            onLoadMore={() => {
                if (likesQuery.hasNextPage && !likesQuery.isFetchingNextPage) {
                    void likesQuery.fetchNextPage();
                }
            }}
        />
    );
}
