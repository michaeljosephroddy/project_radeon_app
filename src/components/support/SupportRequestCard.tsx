import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../api/client';
import { Avatar } from '../Avatar';
import { Colors, ControlSizes, Radius, Spacing, TextStyles, Typography } from '../../theme';
import { formatReadableTimestamp } from '../../utils/date';
import { formatUsername } from '../../utils/identity';
import { CardActionMenu, type CardActionMenuAction } from '../ui/CardActionMenu';
import {
    getSupportPrimaryActionLabel,
    getSupportRequestLocationLabel,
    SUPPORT_TOPIC_LABELS,
    SUPPORT_TYPE_LABELS,
    SUPPORT_URGENCY_LABELS,
} from './supportRequestPresentation';

export interface SupportRequestCardProps {
    request: api.SupportRequest;
    pending?: boolean;
    onPressUser?: (request: api.SupportRequest) => void;
    onOpenComments: (request: api.SupportRequest) => void;
    onPrimaryAction?: (request: api.SupportRequest) => void;
    onClose?: (request: api.SupportRequest) => void;
}

export const SupportRequestCard = React.memo(function SupportRequestCard({
    request,
    pending = false,
    onPressUser,
    onOpenComments,
    onPrimaryAction,
    onClose,
}: SupportRequestCardProps): React.ReactElement {
    const locationLabel = getSupportRequestLocationLabel(request);
    const canPressUser = Boolean(onPressUser) && !request.is_own_request;
    const canClose = Boolean(onClose) && request.is_own_request && request.status !== 'closed';
    const canManage = Boolean(onPrimaryAction) && request.is_own_request;
    const replyLabel = request.reply_count > 0
        ? `${request.reply_count} repl${request.reply_count === 1 ? 'y' : 'ies'}`
        : 'Reply';

    const handlePressUser = useCallback((): void => {
        if (canPressUser) onPressUser?.(request);
    }, [canPressUser, onPressUser, request]);

    const handleViewReplies = useCallback((): void => {
        onOpenComments(request);
    }, [onOpenComments, request]);

    const handleManage = useCallback((): void => {
        onPrimaryAction?.(request);
    }, [onPrimaryAction, request]);

    const handleCloseRequest = useCallback((): void => {
        onClose?.(request);
    }, [onClose, request]);

    const cardActions: CardActionMenuAction[] = [
        { label: 'View replies', onPress: handleViewReplies },
    ];
    if (canManage) {
        cardActions.push({ label: 'Manage', onPress: handleManage });
    }
    if (canClose) {
        cardActions.push({ label: 'Close request', destructive: true, onPress: handleCloseRequest });
    }

    return (
        <View style={styles.card}>
            <View style={styles.head}>
                <TouchableOpacity onPress={handlePressUser} disabled={!canPressUser}>
                    <Avatar username={request.username} avatarUrl={request.avatar_url ?? undefined} size={44} />
                </TouchableOpacity>
                <View style={styles.headBody}>
                    <View style={styles.titleRow}>
                        <Text style={styles.name}>{formatUsername(request.username)}</Text>
                        <Text style={styles.meta}>{formatReadableTimestamp(request.created_at)}</Text>
                    </View>
                    <View style={styles.badgeRow}>
                        <View style={[styles.badge, request.urgency === 'high' && styles.urgentBadge]}>
                            <Text style={[styles.badgeText, request.urgency === 'high' && styles.urgentBadgeText]}>
                                {SUPPORT_URGENCY_LABELS[request.urgency]}
                            </Text>
                        </View>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{SUPPORT_TYPE_LABELS[request.support_type]}</Text>
                        </View>
                        <View style={styles.statusBadge}>
                            <Text style={styles.statusBadgeText}>{request.status}</Text>
                        </View>
                    </View>
                </View>
                <CardActionMenu actions={cardActions} disabled={pending} />
            </View>

            {locationLabel ? (
                <Text style={styles.locationText}>{locationLabel}</Text>
            ) : null}

            {request.topics.length > 0 ? (
                <View style={styles.topicRow}>
                    {request.topics.slice(0, 4).map((topic) => (
                        <View key={topic} style={styles.topicChip}>
                            <Text style={styles.topicChipText}>{SUPPORT_TOPIC_LABELS[topic]}</Text>
                        </View>
                    ))}
                </View>
            ) : null}

            {request.message ? (
                <Text style={styles.body}>{request.message}</Text>
            ) : null}

            <Text style={styles.footerText}>
                {request.offer_count} offer{request.offer_count === 1 ? '' : 's'}
                {request.has_replied ? ' · You replied' : ''}
                {request.has_offered ? ' · You offered' : ''}
            </Text>

            <View style={styles.actions}>
                {onPrimaryAction && !request.is_own_request ? (
                    <TouchableOpacity
                        style={[styles.primaryAction, pending && styles.actionDisabled]}
                        onPress={() => onPrimaryAction(request)}
                        disabled={pending}
                    >
                        <Text style={styles.primaryActionText}>
                            {pending ? 'Working...' : getSupportPrimaryActionLabel(request)}
                        </Text>
                    </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.commentAction} onPress={() => onOpenComments(request)}>
                    <Ionicons name="chatbubble-outline" size={15} color={Colors.text.muted} />
                    <Text style={styles.commentActionText}>{replyLabel}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    card: {
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.default,
        backgroundColor: Colors.bg.page,
        padding: Spacing.md,
        gap: Spacing.sm,
    },
    head: {
        flexDirection: 'row',
        gap: Spacing.sm,
        position: 'relative',
    },
    headBody: {
        flex: 1,
        minWidth: 0,
        gap: Spacing.xs,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: Spacing.sm,
    },
    name: {
        ...TextStyles.bodyEmphasis,
    },
    meta: {
        flexShrink: 0,
        ...TextStyles.caption,
    },
    badgeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs,
    },
    badge: {
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
    },
    badgeText: {
        ...TextStyles.badge,
        color: Colors.text.secondary,
    },
    urgentBadge: {
        borderColor: Colors.danger,
        backgroundColor: Colors.dangerSubtle,
    },
    urgentBadgeText: {
        color: Colors.danger,
    },
    statusBadge: {
        borderRadius: Radius.pill,
        backgroundColor: Colors.bg.raised,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
    },
    statusBadgeText: {
        ...TextStyles.badge,
        color: Colors.text.muted,
        textTransform: 'capitalize',
    },
    locationText: {
        ...TextStyles.caption,
    },
    topicRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs,
    },
    topicChip: {
        borderRadius: Radius.pill,
        backgroundColor: Colors.bg.surface,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
    },
    topicChipText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.text.secondary,
    },
    body: {
        ...TextStyles.postBody,
    },
    footerText: {
        ...TextStyles.caption,
    },
    actions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    primaryAction: {
        minHeight: ControlSizes.iconButton,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.pill,
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.md,
    },
    primaryActionText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '800',
        color: Colors.textOn.primary,
    },
    commentAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        minHeight: ControlSizes.chipMinHeight,
    },
    commentActionText: {
        ...TextStyles.secondary,
        color: Colors.text.muted,
    },
    actionDisabled: {
        opacity: 0.5,
    },
});
