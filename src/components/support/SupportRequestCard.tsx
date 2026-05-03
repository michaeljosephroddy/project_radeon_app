import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../api/client';
import { Avatar } from '../Avatar';
import { Colors, Radius, Spacing, TextStyles, Typography } from '../../theme';
import { formatReadableTimestamp } from '../../utils/date';
import { formatUsername } from '../../utils/identity';
import { CardActionMenu, type CardActionMenuAction } from '../ui/CardActionMenu';
import {
    getSupportIntentLine,
    getSupportPrimaryActionLabel,
    getSupportRequestLocationLabel,
    getSupportTopicLabel,
    getSupportTypeLabel,
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
    const intentLine = getSupportIntentLine(request, locationLabel);

    const isOfferedByMe = !request.is_own_request && request.has_offered;
    const showAcceptedActivity = request.status === 'active';

    const canPressUser = Boolean(onPressUser) && !request.is_own_request;
    const canClose = Boolean(onClose) && request.is_own_request && request.status !== 'closed';
    const canManage = Boolean(onPrimaryAction) && request.is_own_request;
    const primaryActionDisabled = request.is_own_request
        ? pending
        : pending || request.has_offered || request.already_chatting;

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

    const urgencyBadgeStyle = request.urgency === 'high'
        ? styles.urgencyHighBadge
        : request.urgency === 'medium'
            ? styles.urgencyMediumBadge
            : styles.urgencyLowBadge;
    const urgencyBadgeTextStyle = request.urgency === 'high'
        ? styles.urgencyHighText
        : request.urgency === 'medium'
            ? styles.urgencyMediumText
            : styles.urgencyLowText;
    const urgencyRailStyle = request.urgency === 'high'
        ? styles.urgencyHighRail
        : request.urgency === 'medium'
            ? styles.urgencyMediumRail
            : styles.urgencyLowRail;
    const viewerStateLabel = getViewerStateLabel(request);
    const isShortMessage = Boolean(request.message && request.message.trim().length <= 96);
    const topicLabels = request.topics
        .map(getSupportTopicLabel)
        .filter((label): label is string => Boolean(label))
        .slice(0, 4);

    return (
        <View style={styles.card}>
            <View style={[styles.urgencyRail, urgencyRailStyle]} />
            <View style={styles.head}>
                <TouchableOpacity onPress={handlePressUser} disabled={!canPressUser}>
                    <Avatar username={request.username} avatarUrl={request.avatar_url ?? undefined} size={44} />
                </TouchableOpacity>
                <View style={styles.headBody}>
                    <View style={styles.titleRow}>
                        <Text style={styles.name} numberOfLines={1}>{formatUsername(request.username)}</Text>
                        <Text style={styles.meta}>{formatReadableTimestamp(request.created_at)}</Text>
                    </View>
                    {intentLine ? (
                        <View style={styles.locationRow}>
                            <Ionicons name="location-outline" size={13} color={Colors.text.muted} />
                            <Text style={styles.locationText} numberOfLines={1}>{intentLine}</Text>
                        </View>
                    ) : null}
                </View>
                <CardActionMenu actions={cardActions} disabled={pending} />
            </View>

            <View style={styles.context}>
                <View style={styles.badgeRow}>
                    <View style={[styles.badge, styles.typeBadge]}>
                        <Text style={[styles.badgeText, styles.typeBadgeText]}>
                            {getSupportTypeLabel(request.support_type)}
                        </Text>
                    </View>
                    <View style={[styles.badge, urgencyBadgeStyle]}>
                        <Text style={[styles.badgeText, urgencyBadgeTextStyle]}>
                            {SUPPORT_URGENCY_LABELS[request.urgency]} need
                        </Text>
                    </View>
                    {topicLabels.map((topicLabel) => (
                        <View key={topicLabel} style={styles.topicBadge}>
                            <Text style={styles.topicBadgeText}>{topicLabel}</Text>
                        </View>
                    ))}
                </View>
            </View>

            {request.message ? (
                <View style={styles.content}>
                    <Text style={[styles.body, isShortMessage && styles.shortBody]}>{request.message}</Text>
                </View>
            ) : null}

            <View style={styles.foot}>
                <View style={styles.footBody}>
                    {viewerStateLabel ? (
                        <Text style={styles.viewerState}>{viewerStateLabel}</Text>
                    ) : null}
                    <View style={styles.footActions}>
                        <TouchableOpacity style={styles.footAction} onPress={handleViewReplies}>
                            <Ionicons name="chatbubble-outline" size={15} color={Colors.text.muted} />
                            <Text style={styles.footActionText}>{replyLabel}</Text>
                        </TouchableOpacity>
                        {request.offer_count > 0 ? (
                            <View style={styles.footAction}>
                                <Ionicons name="people-outline" size={16} color={Colors.text.muted} />
                                <Text style={styles.footActionText}>
                                    {request.offer_count} offer{request.offer_count === 1 ? '' : 's'}
                                </Text>
                            </View>
                        ) : null}
                        {showAcceptedActivity ? (
                            <View style={styles.footAction}>
                                <Ionicons name="checkmark-circle-outline" size={16} color={Colors.success} />
                                <Text style={styles.acceptedActionText}>1 accepted</Text>
                            </View>
                        ) : null}
                    </View>
                </View>

                {onPrimaryAction ? (
                    <TouchableOpacity
                        style={[
                            styles.primaryAction,
                            isOfferedByMe && styles.primaryActionOffered,
                            pending && styles.actionDisabled,
                        ]}
                        onPress={() => onPrimaryAction(request)}
                        disabled={primaryActionDisabled}
                    >
                        {isOfferedByMe ? (
                            <Ionicons name="checkmark" size={14} color={Colors.textOn.primary} />
                        ) : null}
                        <Text style={styles.primaryActionText}>
                            {pending ? 'Working...' : request.has_offered ? 'Offered' : getSupportPrimaryActionLabel(request)}
                        </Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>
    );
});

function getViewerStateLabel(request: api.SupportRequest): string | null {
    return request.has_replied ? 'You replied' : null;
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.bg.page,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.default,
        position: 'relative',
    },
    urgencyRail: {
        position: 'absolute',
        top: Spacing.md,
        bottom: Spacing.md,
        left: 0,
        width: 3,
        borderTopRightRadius: Radius.pill,
        borderBottomRightRadius: Radius.pill,
    },
    urgencyHighRail: {
        backgroundColor: Colors.danger,
    },
    urgencyMediumRail: {
        backgroundColor: Colors.warning,
    },
    urgencyLowRail: {
        backgroundColor: Colors.secondary,
    },
    head: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
        padding: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    headBody: {
        flex: 1,
        minWidth: 0,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        flexWrap: 'wrap',
    },
    name: {
        ...TextStyles.cardTitle,
        flexShrink: 1,
    },
    meta: {
        ...TextStyles.meta,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginTop: 2,
    },
    locationText: {
        ...TextStyles.caption,
        color: Colors.text.muted,
        flex: 1,
        minWidth: 0,
    },
    context: {
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm,
        gap: Spacing.sm,
    },
    badgeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs,
        marginTop: Spacing.xs,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
    },
    badgeText: {
        fontSize: TextStyles.caption.fontSize,
        fontWeight: TextStyles.caption.fontWeight,
    },
    typeBadge: {
        backgroundColor: Colors.primarySubtle,
    },
    typeBadgeText: {
        color: Colors.primary,
    },
    urgencyHighBadge: {
        backgroundColor: Colors.dangerSubtle,
    },
    urgencyHighText: {
        color: Colors.danger,
    },
    urgencyMediumBadge: {
        backgroundColor: Colors.warningSubtle,
    },
    urgencyMediumText: {
        color: Colors.warning,
    },
    urgencyLowBadge: {
        backgroundColor: Colors.secondarySubtle,
    },
    urgencyLowText: {
        color: Colors.text.secondary,
    },
    content: {
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    body: {
        ...TextStyles.postBody,
    },
    shortBody: {
        ...TextStyles.bodyEmphasis,
    },
    topicBadge: {
        overflow: 'hidden',
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        backgroundColor: Colors.primarySubtle,
    },
    topicBadgeText: {
        color: Colors.primary,
        fontSize: TextStyles.caption.fontSize,
        fontWeight: TextStyles.caption.fontWeight,
    },
    foot: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        paddingTop: Spacing.sm,
    },
    footBody: {
        flex: 1,
        minWidth: 0,
        gap: 2,
    },
    footActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        flexShrink: 1,
        flexWrap: 'wrap',
    },
    footAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        minHeight: 32,
    },
    footActionText: {
        ...TextStyles.secondary,
        color: Colors.text.muted,
    },
    acceptedActionText: {
        ...TextStyles.secondary,
        color: Colors.success,
    },
    viewerState: {
        ...TextStyles.caption,
        color: Colors.text.muted,
    },
    primaryAction: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        borderRadius: Radius.pill,
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        minHeight: 36,
        flexShrink: 0,
    },
    primaryActionText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '800',
        color: Colors.textOn.primary,
    },
    primaryActionOffered: {
        backgroundColor: Colors.success,
    },
    actionDisabled: {
        opacity: 0.5,
    },
});
