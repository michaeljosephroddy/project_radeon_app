import { useQuery } from '@tanstack/react-query';
import * as api from '../../api/client';
import { queryKeys } from '../../query/queryKeys';

const NOTIFICATION_SUMMARY_STALE_TIME = 1000 * 20;

export function useNotificationSummary(enabled = true) {
    return useQuery({
        queryKey: queryKeys.notificationSummary(),
        queryFn: api.getNotificationSummary,
        staleTime: NOTIFICATION_SUMMARY_STALE_TIME,
        enabled,
    });
}
