import React from 'react';
import {
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRecoveryMeeting } from '../../../hooks/queries/useRecoveryMeetings';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { screenStandards } from '../../../styles/screenStandards';
import { Colors, Radius, Spacing, TextStyles, Typography } from '../../../theme';
import {
    RecoveryMeeting,
    formatAddressLine,
    formatLocationLine,
    formatOccurrenceDay,
    formatOccurrenceTime,
    getConnectionSummary,
    getFellowshipLabel,
    getMeetingTypeLabel,
} from './recoveryMeetings';

interface RecoveryMeetingDetailScreenProps {
    meeting: RecoveryMeeting;
    onBack: () => void;
}

function joinLines(values: Array<string | null | undefined>): string {
    return values.map((value) => value?.trim()).filter(Boolean).join('\n');
}

function openURL(url: string | null | undefined): void {
    if (!url?.trim()) return;
    void Linking.openURL(url.trim());
}

function openMaps(address: string | null): void {
    if (!address) return;
    const encodedAddress = encodeURIComponent(address);
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`);
}

function modeIcon(type: RecoveryMeeting['meeting_type']): keyof typeof Ionicons.glyphMap {
    switch (type) {
        case 'online':
            return 'videocam-outline';
        case 'phone':
            return 'call-outline';
        case 'hybrid':
            return 'sync-outline';
        default:
            return 'location-outline';
    }
}

interface DetailRowProps {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
}

function DetailRow({ icon, label, value }: DetailRowProps): React.ReactElement {
    return (
        <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
                <Ionicons name={icon} size={17} color={Colors.primary} />
            </View>
            <View style={styles.infoBody}>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={styles.bodyText}>{value}</Text>
            </View>
        </View>
    );
}

interface SectionProps {
    title: string;
    children: React.ReactNode;
}

function Section({ title, children }: SectionProps): React.ReactElement {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {children}
        </View>
    );
}

export function RecoveryMeetingDetailScreen({
    meeting,
    onBack,
}: RecoveryMeetingDetailScreenProps): React.ReactElement {
    const insets = useSafeAreaInsets();
    const detailQuery = useRecoveryMeeting(meeting.id, true);
    const detail = detailQuery.data ?? meeting;
    const locationLine = formatLocationLine(detail);
    const addressLine = formatAddressLine(detail);
    const occurrences = detail.occurrences.length ? detail.occurrences : meeting.occurrences;
    const primaryOccurrence = occurrences[0] ?? null;
    const connectionSummary = getConnectionSummary(detail);
    const connectionDetails = joinLines([
        detail.online_url ? detail.online_url : null,
        detail.phone_join_info ? detail.phone_join_info : null,
    ]);

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScreenHeader onBack={onBack} title="Meeting details" />

            {detailQuery.isLoading && !detail ? (
                <View style={styles.centered}>
                    <Text style={styles.loadingText}>Loading meeting...</Text>
                </View>
            ) : detailQuery.isError && !detail ? (
                <View style={styles.centered}>
                    <EmptyState title="Could not load this meeting" description="Check your connection, then try again." />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={[
                        screenStandards.detailContent,
                        screenStandards.scrollContent,
                        { paddingBottom: Math.max(insets.bottom + Spacing.xs, Spacing.lg) },
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.hero}>
                        <View style={styles.badgeRow}>
                            <View style={styles.fellowshipPill}>
                                <Text style={styles.fellowshipPillText}>{getFellowshipLabel(detail.fellowship)}</Text>
                            </View>
                            <View style={styles.modePill}>
                                <Ionicons name={modeIcon(detail.meeting_type)} size={13} color={Colors.text.secondary} />
                                <Text style={styles.modePillText}>{getMeetingTypeLabel(detail.meeting_type)}</Text>
                            </View>
                        </View>
                        <Text style={styles.heroTitle}>{detail.name}</Text>
                        <View style={styles.heroMetaGrid}>
                            <View style={styles.heroMetaRow}>
                                <Ionicons name="calendar-outline" size={16} color={Colors.text.muted} />
                                <Text style={styles.heroMeta}>{formatOccurrenceDay(primaryOccurrence)}</Text>
                            </View>
                            <View style={styles.heroMetaRow}>
                                <Ionicons name="time-outline" size={16} color={Colors.text.muted} />
                                <Text style={styles.heroMeta}>{formatOccurrenceTime(primaryOccurrence)}</Text>
                            </View>
                            <View style={styles.heroMetaRow}>
                                <Ionicons name={detail.meeting_type === 'online' ? 'videocam-outline' : 'business-outline'} size={16} color={Colors.text.muted} />
                                <Text style={styles.heroMeta}>{locationLine}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.actionRow}>
                        {detail.online_url ? (
                            <PrimaryButton
                                label="Open online link"
                                onPress={() => openURL(detail.online_url)}
                                leftAdornment={<Ionicons name="open-outline" size={18} color={Colors.textOn.primary} />}
                                style={styles.actionButton}
                            />
                        ) : null}
                        {addressLine ? (
                            <PrimaryButton
                                label="Open maps"
                                variant="secondary"
                                onPress={() => openMaps(addressLine)}
                                leftAdornment={<Ionicons name="map-outline" size={18} color={Colors.primary} />}
                                style={styles.actionButton}
                            />
                        ) : null}
                    </View>

                    <Section title="Schedule">
                        <View style={styles.rowStack}>
                            {occurrences.map((occurrence) => (
                                <DetailRow
                                    key={occurrence.id}
                                    icon="time-outline"
                                    label={formatOccurrenceDay(occurrence)}
                                    value={formatOccurrenceTime(occurrence)}
                                />
                            ))}
                        </View>
                    </Section>

                    <Section title="Location">
                        <DetailRow icon={detail.meeting_type === 'online' ? 'videocam-outline' : 'business-outline'} label="Place" value={locationLine} />
                        {addressLine ? <DetailRow icon="map-outline" label="Address" value={addressLine} /> : null}
                    </Section>

                    {connectionDetails ? (
                        <Section title="Connection">
                            {detail.online_url ? <DetailRow icon="link-outline" label="Online link" value={detail.online_url} /> : null}
                            {connectionSummary && detail.phone_join_info ? (
                                <DetailRow icon="key-outline" label="Credentials" value={connectionSummary} />
                            ) : null}
                        </Section>
                    ) : null}

                    {detail.formats.length ? (
                        <Section title="Formats">
                            <View style={styles.tagRow}>
                                {detail.formats.map((format) => (
                                    <View key={format} style={styles.tag}>
                                        <Text style={styles.tagText}>{format}</Text>
                                    </View>
                                ))}
                            </View>
                        </Section>
                    ) : null}

                    {(detail.accessibility_notes || detail.language || detail.last_verified_at || detail.source_url) ? (
                        <Section title="Source details">
                            {detail.accessibility_notes ? <Text style={styles.subtleText}>{detail.accessibility_notes}</Text> : null}
                            {detail.language ? <Text style={styles.subtleText}>Language: {detail.language}</Text> : null}
                            {detail.last_verified_at ? <Text style={styles.subtleText}>Verified: {new Date(detail.last_verified_at).toLocaleDateString()}</Text> : null}
                            {detail.source_url ? (
                                <TouchableOpacity onPress={() => openURL(detail.source_url)} activeOpacity={0.8}>
                                    <Text style={styles.linkText}>Open source</Text>
                                </TouchableOpacity>
                            ) : null}
                        </Section>
                    ) : null}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.xl,
    },
    loadingText: {
        ...TextStyles.secondary,
    },
    hero: {
        gap: Spacing.md,
        paddingBottom: Spacing.xs,
    },
    badgeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs,
    },
    fellowshipPill: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: Radius.pill,
        backgroundColor: Colors.primarySubtle,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    fellowshipPillText: {
        color: Colors.primary,
        fontSize: TextStyles.caption.fontSize,
        fontWeight: TextStyles.caption.fontWeight,
    },
    modePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: Radius.pill,
        backgroundColor: Colors.bg.raised,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    modePillText: {
        ...TextStyles.caption,
    },
    heroTitle: {
        ...TextStyles.displayTitle,
        fontSize: Typography.sizes.xxl,
        lineHeight: 31,
    },
    heroMetaGrid: {
        gap: Spacing.xs,
    },
    heroMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    heroMeta: {
        ...TextStyles.bodyEmphasis,
        flex: 1,
    },
    actionRow: {
        gap: Spacing.sm,
    },
    actionButton: {
        width: '100%',
    },
    section: {
        gap: Spacing.sm,
        padding: Spacing.md,
        borderRadius: Radius.lg,
        backgroundColor: Colors.bg.surface,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    sectionTitle: {
        ...TextStyles.cardTitle,
    },
    rowStack: {
        gap: Spacing.sm,
    },
    infoRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        alignItems: 'flex-start',
    },
    infoIcon: {
        width: 30,
        height: 30,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primarySubtle,
    },
    infoBody: {
        flex: 1,
        gap: 2,
    },
    infoLabel: {
        ...TextStyles.caption,
        color: Colors.text.secondary,
        textTransform: 'uppercase',
    },
    bodyText: {
        ...TextStyles.body,
        color: Colors.text.primary,
        flex: 1,
    },
    subtleText: {
        ...TextStyles.secondary,
    },
    tagRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs,
    },
    tag: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: Radius.pill,
        backgroundColor: Colors.bg.raised,
    },
    tagText: {
        ...TextStyles.caption,
    },
    linkText: {
        ...TextStyles.bodyEmphasis,
        color: Colors.primary,
    },
});
