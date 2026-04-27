import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as api from '../../api/client';
import { MeetupEventTypeBadge, formatMeetupEventTypeLabel } from '../../components/events/MeetupEventTypeBadge';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { MeetupFormValues } from '../../components/events/MeetupFormState';
import { Colors, Radii, Spacing, Typography } from '../../utils/theme';
import { screenStandards } from '../../styles/screenStandards';

interface MeetupReviewScreenProps {
    title: string;
    values: MeetupFormValues;
    categories: api.MeetupCategory[];
    friends: api.FriendUser[];
    coverPreviewUri?: string | null;
    loading: boolean;
    primaryActionLabel: string;
    primaryActionVariant?: 'primary' | 'success' | 'warning';
    secondaryActionLabel?: string;
    destructiveActionLabel?: string;
    error?: string;
    onBack: () => void;
    onPrimaryAction: () => void;
    onSecondaryAction?: () => void;
    onDestructiveAction?: () => void;
}

function formatVisibilityLabel(visibility: api.MeetupVisibility): string {
    switch (visibility) {
        case 'public':
            return 'Public';
        case 'unlisted':
            return 'Unlisted';
        default:
            return visibility;
    }
}

function formatDateRange(values: MeetupFormValues): string {
    const start = new Date(`${values.starts_on.trim()}T${values.starts_at.trim() || '00:00'}:00`);
    if (Number.isNaN(start.getTime())) {
        return 'Choose a valid start date and time';
    }
    const startLabel = start.toLocaleString('default', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
    if (!values.ends_on.trim() || !values.ends_at.trim()) {
        return startLabel;
    }
    const end = new Date(`${values.ends_on.trim()}T${values.ends_at.trim()}:00`);
    if (Number.isNaN(end.getTime())) {
        return startLabel;
    }
    const endLabel = end.toLocaleString('default', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
    return `${startLabel} — ${endLabel}`;
}

function SummaryItem({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{label}</Text>
            <Text style={styles.summaryValue}>{value}</Text>
        </View>
    );
}

export function MeetupReviewScreen({
    title,
    values,
    categories,
    friends,
    coverPreviewUri,
    loading,
    primaryActionLabel,
    primaryActionVariant = 'success',
    secondaryActionLabel,
    destructiveActionLabel,
    error,
    onBack,
    onPrimaryAction,
    onSecondaryAction,
    onDestructiveAction,
}: MeetupReviewScreenProps) {
    const categoryLabel = categories.find((category) => category.slug === values.category_slug)?.label ?? 'No category selected';
    const selectedCoHosts = friends.filter((friend) => values.co_host_ids.includes(friend.user_id));
    const locationSummary = values.event_type === 'online'
        ? [
            values.city.trim(),
            values.country.trim(),
            values.online_url.trim(),
        ].filter(Boolean).join(' • ') || 'No online details added yet'
        : [
            values.venue_name.trim(),
            values.address_line_1.trim(),
            values.address_line_2.trim(),
            [values.city.trim(), values.country.trim()].filter(Boolean).join(', '),
            values.event_type === 'hybrid' ? values.online_url.trim() : '',
        ].filter(Boolean).join(' • ') || 'No venue details added yet';
    const attendanceSummary = !values.capacity.trim()
        ? values.waitlist_enabled ? 'No capacity set. Waitlist enabled.' : 'No capacity set.'
        : `${values.capacity.trim()} spots${values.waitlist_enabled ? ' with waitlist' : ''}`;
    const coHostSummary = selectedCoHosts.length ? selectedCoHosts.map((friend) => friend.username).join(', ') : 'No co-hosts selected';
    const coordinateSummary = values.lat.trim() && values.lng.trim()
        ? `${values.lat.trim()}, ${values.lng.trim()}`
        : '';

    return (
        <View style={styles.container}>
            <ScreenHeader onBack={onBack} title="Review event" />

            <ScrollView contentContainerStyle={[screenStandards.detailContent, screenStandards.scrollContent]} showsVerticalScrollIndicator={false}>
                {!!error && (
                    <View style={styles.errorCard}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                <View style={styles.heroCard}>
                    {coverPreviewUri ? (
                        <Image source={{ uri: coverPreviewUri }} style={styles.coverImage} />
                    ) : (
                        <View style={styles.coverFallback}>
                            <Text style={styles.coverFallbackText}>{categoryLabel}</Text>
                        </View>
                    )}
                    <View style={styles.heroContent}>
                        <Text style={styles.heroTitle}>{values.title || 'Untitled event'}</Text>
                        <Text style={styles.heroMeta}>
                            {[categoryLabel, formatMeetupEventTypeLabel(values.event_type), formatVisibilityLabel(values.visibility)].filter(Boolean).join(' · ')}
                        </Text>
                        <View style={styles.heroBadgeRow}>
                            <View style={styles.categoryPill}>
                                <Text style={styles.categoryPillText}>{categoryLabel}</Text>
                            </View>
                            <MeetupEventTypeBadge eventType={values.event_type} />
                        </View>
                        <Text style={styles.heroSchedule}>{formatDateRange(values)}</Text>
                        <Text style={styles.heroLocation}>{locationSummary}</Text>
                        <Text style={styles.heroDescription}>
                            {values.description.trim() || title}
                        </Text>
                    </View>
                </View>

                <SummaryItem label="Timezone" value={values.timezone.trim() || 'UTC'} />
                <SummaryItem label="Attendance" value={attendanceSummary} />
                <SummaryItem label="Co-hosts" value={coHostSummary} />
                {coordinateSummary ? <SummaryItem label="Coordinates" value={coordinateSummary} /> : null}

                <View style={styles.actionStack}>
                    {secondaryActionLabel && onSecondaryAction ? (
                        <TouchableOpacity style={styles.secondaryAction} onPress={onSecondaryAction} activeOpacity={0.82} disabled={loading}>
                            <Text style={styles.secondaryActionText}>{secondaryActionLabel}</Text>
                        </TouchableOpacity>
                    ) : null}
                    <PrimaryButton
                        label={primaryActionLabel}
                        onPress={onPrimaryAction}
                        loading={loading}
                        variant={primaryActionVariant}
                    />
                    {destructiveActionLabel && onDestructiveAction ? (
                        <TouchableOpacity style={styles.destructiveAction} onPress={onDestructiveAction} activeOpacity={0.82} disabled={loading}>
                            <Text style={styles.destructiveActionText}>{destructiveActionLabel}</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    errorCard: {
        borderRadius: Radii.lg,
        backgroundColor: Colors.dangerSubtle,
        borderWidth: 1,
        borderColor: Colors.danger,
        padding: Spacing.md,
        marginBottom: Spacing.md,
    },
    errorText: {
        color: Colors.danger,
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
    },
    heroCard: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.xl,
        borderWidth: 1,
        borderColor: Colors.light.borderSecondary,
        overflow: 'hidden',
        marginBottom: Spacing.md,
    },
    coverImage: {
        width: '100%',
        height: 220,
        backgroundColor: Colors.light.background,
    },
    coverFallback: {
        height: 180,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primarySubtle,
    },
    coverFallbackText: {
        color: Colors.primary,
        fontSize: Typography.sizes.lg,
        fontWeight: '800',
    },
    heroContent: {
        gap: Spacing.sm,
        padding: Spacing.md,
    },
    heroTitle: {
        color: Colors.light.textPrimary,
        fontSize: Typography.sizes.xxl,
        fontWeight: '800',
    },
    heroMeta: {
        color: Colors.light.textSecondary,
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
    },
    heroBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        flexWrap: 'wrap',
    },
    categoryPill: {
        backgroundColor: Colors.primarySubtle,
        borderRadius: Radii.full,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    categoryPillText: {
        color: Colors.primary,
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
    },
    heroSchedule: {
        color: Colors.light.textPrimary,
        fontSize: Typography.sizes.md,
        fontWeight: '600',
    },
    heroLocation: {
        color: Colors.light.textSecondary,
        fontSize: Typography.sizes.sm,
        lineHeight: 20,
    },
    heroDescription: {
        color: Colors.light.textSecondary,
        fontSize: Typography.sizes.sm,
        lineHeight: 20,
    },
    summaryCard: {
        gap: Spacing.xs,
        padding: Spacing.md,
        borderRadius: Radii.xl,
        borderWidth: 1,
        borderColor: Colors.light.borderSecondary,
        backgroundColor: Colors.light.backgroundSecondary,
        marginBottom: Spacing.md,
    },
    summaryLabel: {
        color: Colors.light.textTertiary,
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    summaryValue: {
        color: Colors.light.textPrimary,
        fontSize: Typography.sizes.sm,
        lineHeight: 20,
    },
    actionStack: {
        gap: Spacing.sm,
        paddingBottom: Spacing.xl,
    },
    secondaryAction: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
        borderRadius: Radii.md,
        borderWidth: 1,
        borderColor: Colors.primary,
        backgroundColor: Colors.primarySubtle,
        paddingHorizontal: Spacing.md,
    },
    secondaryActionText: {
        color: Colors.primary,
        fontSize: Typography.sizes.md,
        fontWeight: '700',
    },
    destructiveAction: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
        borderRadius: Radii.md,
        borderWidth: 1,
        borderColor: Colors.danger,
        backgroundColor: Colors.dangerSubtle,
        paddingHorizontal: Spacing.md,
    },
    destructiveActionText: {
        color: Colors.danger,
        fontSize: Typography.sizes.md,
        fontWeight: '700',
    },
});
