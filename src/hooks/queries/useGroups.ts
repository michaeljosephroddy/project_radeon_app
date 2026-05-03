import { InfiniteData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/client';
import { getInfiniteQueryPolicy } from '../../query/queryPolicies';
import { queryKeys } from '../../query/queryKeys';

const GROUPS_STALE_TIME = 1000 * 30;

export function useGroups(params: api.ListGroupsParams, enabled = true) {
    const limit = params.limit ?? 20;
    const queryParams = { ...params, limit };
    const queryKey = queryKeys.groups(queryParams);
    const policy = getInfiniteQueryPolicy(queryKey);

    return useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam }) => api.listGroups({
            ...queryParams,
            cursor: pageParam as string | undefined,
        }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
        placeholderData: (previousData) => previousData,
        staleTime: GROUPS_STALE_TIME,
        refetchOnMount: policy?.refetchOnMount,
        enabled,
    });
}

export function useGroup(groupId: string | null, enabled = true) {
    return useQuery({
        queryKey: queryKeys.group(groupId ?? ''),
        queryFn: () => api.getGroup(groupId ?? ''),
        staleTime: GROUPS_STALE_TIME,
        enabled: enabled && Boolean(groupId),
    });
}

export function useGroupMembers(groupId: string | null, limit = 20, enabled = true) {
    const queryKey = queryKeys.groupMembers(groupId ?? '', { limit });
    const policy = getInfiniteQueryPolicy(queryKey);

    return useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam }) => api.listGroupMembers(
            groupId ?? '',
            pageParam as string | undefined,
            limit,
        ),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
        staleTime: GROUPS_STALE_TIME,
        refetchOnMount: policy?.refetchOnMount,
        enabled: enabled && Boolean(groupId),
    });
}

export function useGroupPosts(groupId: string | null, limit = 20, enabled = true) {
    const queryKey = queryKeys.groupPosts(groupId ?? '', { limit });
    const policy = getInfiniteQueryPolicy(queryKey);

    return useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam }) => api.listGroupPosts(
            groupId ?? '',
            pageParam as string | undefined,
            limit,
        ),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
        staleTime: GROUPS_STALE_TIME,
        refetchOnMount: policy?.refetchOnMount,
        enabled: enabled && Boolean(groupId),
    });
}

export function useGroupMedia(groupId: string | null, limit = 30, enabled = true) {
    const queryKey = queryKeys.groupMedia(groupId ?? '', { limit });
    const policy = getInfiniteQueryPolicy(queryKey);

    return useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam }) => api.listGroupMedia(
            groupId ?? '',
            pageParam as string | undefined,
            limit,
        ),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
        staleTime: GROUPS_STALE_TIME,
        refetchOnMount: policy?.refetchOnMount,
        enabled: enabled && Boolean(groupId),
    });
}

export function useGroupJoinRequests(groupId: string | null, enabled = true) {
    return useQuery({
        queryKey: queryKeys.groupJoinRequests(groupId ?? ''),
        queryFn: () => api.listGroupJoinRequests(groupId ?? ''),
        staleTime: GROUPS_STALE_TIME,
        enabled: enabled && Boolean(groupId),
    });
}

export function useGroupAdminInbox(groupId: string | null, limit = 20, enabled = true) {
    const queryKey = queryKeys.groupAdminInbox(groupId ?? '', { limit });
    const policy = getInfiniteQueryPolicy(queryKey);

    return useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam }) => api.listGroupAdminThreads(
            groupId ?? '',
            pageParam as string | undefined,
            limit,
        ),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
        staleTime: GROUPS_STALE_TIME,
        refetchOnMount: policy?.refetchOnMount,
        enabled: enabled && Boolean(groupId),
    });
}

export function useGroupReports(groupId: string | null, limit = 20, enabled = true) {
    const queryKey = queryKeys.groupReports(groupId ?? '', { limit });
    const policy = getInfiniteQueryPolicy(queryKey);

    return useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam }) => api.listGroupReports(
            groupId ?? '',
            pageParam as string | undefined,
            limit,
        ),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
        staleTime: GROUPS_STALE_TIME,
        refetchOnMount: policy?.refetchOnMount,
        enabled: enabled && Boolean(groupId),
    });
}


export function useGroupComments(
    groupId: string | null,
    postId: string | null,
    limit = 20,
    enabled = true,
) {
    const queryKey = queryKeys.groupComments(groupId ?? '', postId ?? '', { limit });
    const policy = getInfiniteQueryPolicy(queryKey);

    return useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam }) => api.listGroupComments(
            groupId ?? '',
            postId ?? '',
            pageParam as string | undefined,
            limit,
        ),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
        staleTime: GROUPS_STALE_TIME,
        refetchOnMount: policy?.refetchOnMount,
        enabled: enabled && Boolean(groupId) && Boolean(postId),
    });
}

export function useCreateGroupMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: api.createGroup,
        onSuccess: async (group) => {
            queryClient.setQueryData(queryKeys.group(group.id), group);
            await queryClient.invalidateQueries({ queryKey: ['groups'] });
        },
    });
}

export function useJoinGroupMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ groupId, message }: { groupId: string; message?: string }) =>
            api.joinGroup(groupId, message),
        onSuccess: async (result) => {
            if (result.group) {
                queryClient.setQueryData(queryKeys.group(result.group.id), result.group);
            }
            await queryClient.invalidateQueries({ queryKey: ['groups'] });
        },
    });
}

export function useLeaveGroupMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (groupId: string) => api.leaveGroup(groupId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['groups'] });
        },
    });
}

export function useCreateGroupPostMutation(groupId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: api.CreateGroupPostInput) => api.createGroupPost(groupId, input),
        onSuccess: async (post) => {
            queryClient.setQueriesData<InfiniteData<api.CursorResponse<api.GroupPost>>>(
                { queryKey: ['groups', 'posts', groupId] },
                (current) => prependGroupPost(current, post),
            );
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) }),
                post.images.length > 0
                    ? queryClient.invalidateQueries({ queryKey: ['groups', 'media', groupId] })
                    : Promise.resolve(),
            ]);
        },
    });
}

export function useToggleGroupPostReactionMutation(groupId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (postId: string) => api.toggleGroupPostReaction(groupId, postId),
        onMutate: async (postId) => {
            await queryClient.cancelQueries({ queryKey: ['groups', 'posts', groupId] });
            const previous = queryClient.getQueriesData<InfiniteData<api.CursorResponse<api.GroupPost>>>({
                queryKey: ['groups', 'posts', groupId],
            });
            queryClient.setQueriesData<InfiniteData<api.CursorResponse<api.GroupPost>>>(
                { queryKey: ['groups', 'posts', groupId] },
                (current) => updateGroupPost(current, postId, (post) => {
                    const viewerHasReacted = !post.viewer_has_reacted;
                    const reactionDelta = viewerHasReacted ? 1 : -1;
                    return {
                        ...post,
                        viewer_has_reacted: viewerHasReacted,
                        reaction_count: Math.max(post.reaction_count + reactionDelta, 0),
                    };
                }),
            );
            return { previous };
        },
        onError: (_error, _postId, context) => {
            context?.previous.forEach(([queryKey, data]) => {
                queryClient.setQueryData(queryKey, data);
            });
        },
        onSuccess: (post) => {
            queryClient.setQueriesData<InfiniteData<api.CursorResponse<api.GroupPost>>>(
                { queryKey: ['groups', 'posts', groupId] },
                (current) => updateGroupPost(current, post.id, () => post),
            );
        },
    });
}

export function useCreateGroupCommentMutation(groupId: string, postId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (body: string) => api.createGroupComment(groupId, postId, body),
        onSuccess: async (comment) => {
            queryClient.setQueriesData<InfiniteData<api.CursorResponse<api.GroupComment>>>(
                { queryKey: ['groups', 'comments', groupId, postId] },
                (current) => appendGroupComment(current, comment),
            );
            queryClient.setQueriesData<InfiniteData<api.CursorResponse<api.GroupPost>>>(
                { queryKey: ['groups', 'posts', groupId] },
                (current) => updateGroupPost(current, postId, (post) => ({
                    ...post,
                    comment_count: post.comment_count + 1,
                })),
            );
        },
    });
}

export function usePinGroupPostMutation(groupId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ postId, pinned }: { postId: string; pinned: boolean }) =>
            pinned ? api.pinGroupPost(groupId, postId) : api.unpinGroupPost(groupId, postId),
        onSuccess: (post) => {
            queryClient.setQueriesData<InfiniteData<api.CursorResponse<api.GroupPost>>>(
                { queryKey: ['groups', 'posts', groupId] },
                (current) => updateGroupPost(current, post.id, () => post),
            );
        },
    });
}

export function useDeleteGroupPostMutation(groupId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (postId: string) => api.deleteGroupPost(groupId, postId),
        onSuccess: async (_result, postId) => {
            queryClient.setQueriesData<InfiniteData<api.CursorResponse<api.GroupPost>>>(
                { queryKey: ['groups', 'posts', groupId] },
                (current) => removeGroupPost(current, postId),
            );
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) }),
                queryClient.invalidateQueries({ queryKey: ['groups', 'media', groupId] }),
            ]);
        },
    });
}

export function useCreateGroupInviteMutation(groupId: string) {
    return useMutation({
        mutationFn: (input: Parameters<typeof api.createGroupInvite>[1]) =>
            api.createGroupInvite(groupId, input),
    });
}

export function useReviewGroupJoinRequestMutation(groupId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ requestId, approve }: { requestId: string; approve: boolean }) =>
            approve
                ? api.approveGroupJoinRequest(groupId, requestId)
                : api.rejectGroupJoinRequest(groupId, requestId),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.groupJoinRequests(groupId) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) }),
                queryClient.invalidateQueries({ queryKey: queryKeys.groupMembers(groupId, { limit: 20 }) }),
            ]);
        },
    });
}

export function useContactGroupAdminsMutation(groupId: string) {
    return useMutation({
        mutationFn: (input: { subject?: string; body: string }) =>
            api.contactGroupAdmins(groupId, input),
    });
}

export function useReportGroupTargetMutation(groupId: string) {
    return useMutation({
        mutationFn: (input: Parameters<typeof api.reportGroupTarget>[1]) =>
            api.reportGroupTarget(groupId, input),
    });
}

export function useReplyGroupAdminThreadMutation(groupId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ threadId, body }: { threadId: string; body: string }) =>
            api.replyGroupAdminThread(groupId, threadId, body),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['groups', 'admin-inbox', groupId] });
        },
    });
}

export function useResolveGroupAdminThreadMutation(groupId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (threadId: string) => api.resolveGroupAdminThread(groupId, threadId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['groups', 'admin-inbox', groupId] });
        },
    });
}

export function useReviewGroupReportMutation(groupId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            reportId,
            status,
        }: {
            reportId: string;
            status: Extract<api.GroupReport['status'], 'reviewing' | 'resolved' | 'dismissed'>;
        }) => api.reviewGroupReport(groupId, reportId, status),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['groups', 'reports', groupId] });
        },
    });
}

function prependGroupPost(
    current: InfiniteData<api.CursorResponse<api.GroupPost>> | undefined,
    post: api.GroupPost,
): InfiniteData<api.CursorResponse<api.GroupPost>> | undefined {
    if (!current || current.pages.length === 0) {
        return current;
    }
    const [firstPage, ...restPages] = current.pages;
    return {
        ...current,
        pages: [
            {
                ...firstPage,
                items: [post, ...firstPage.items.filter((item) => item.id !== post.id)],
            },
            ...restPages,
        ],
    };
}

function updateGroupPost(
    current: InfiniteData<api.CursorResponse<api.GroupPost>> | undefined,
    postId: string,
    update: (post: api.GroupPost) => api.GroupPost,
): InfiniteData<api.CursorResponse<api.GroupPost>> | undefined {
    if (!current) {
        return current;
    }
    return {
        ...current,
        pages: current.pages.map((page) => ({
            ...page,
            items: page.items.map((post) => (post.id === postId ? update(post) : post)),
        })),
    };
}

function removeGroupPost(
    current: InfiniteData<api.CursorResponse<api.GroupPost>> | undefined,
    postId: string,
): InfiniteData<api.CursorResponse<api.GroupPost>> | undefined {
    if (!current) {
        return current;
    }
    return {
        ...current,
        pages: current.pages.map((page) => ({
            ...page,
            items: page.items.filter((post) => post.id !== postId),
        })),
    };
}

function appendGroupComment(
    current: InfiniteData<api.CursorResponse<api.GroupComment>> | undefined,
    comment: api.GroupComment,
): InfiniteData<api.CursorResponse<api.GroupComment>> | undefined {
    if (!current || current.pages.length === 0) {
        return current;
    }
    return {
        ...current,
        pages: current.pages.map((page, index) => (
            index === current.pages.length - 1
                ? {
                    ...page,
                    items: [...page.items.filter((item) => item.id !== comment.id), comment],
                }
                : page
        )),
    };
}
