import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, RefreshControl, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Avatar } from '../../components/Avatar';
import * as api from '../../api/client';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';
import { formatUsername } from '../../utils/identity';

type SupportType = api.SupportRequest['type'];
type SupportAudience = api.SupportRequest['audience'];
type SupportResponseType = api.SupportResponse['response_type'];
type SupportSubView = 'open' | 'mine' | 'create';

interface SupportScreenProps {
  isActive: boolean;
  onOpenChat: (chat: api.Chat) => void;
  onOpenUserProfile: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
}

const SUPPORT_TYPE_LABELS: Record<SupportType, string> = {
  need_to_talk: 'Need to talk',
  need_distraction: 'Need distraction',
  need_encouragement: 'Need encouragement',
  need_company: 'Need company',
};

const SUPPORT_AUDIENCE_LABELS: Record<SupportAudience, string> = {
  friends: 'Friends',
  city: 'My city',
  community: 'Community',
};

const SUPPORT_DURATION_OPTIONS = [
  { label: '2h', hours: 2 },
  { label: '6h', hours: 6 },
  { label: '12h', hours: 12 },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function expiryFromHours(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

interface SupportRequestCardProps {
  request: api.SupportRequest;
  responsePending: boolean;
  closingPending: boolean;
  onRespond: (request: api.SupportRequest, responseType: SupportResponseType) => void;
  onClose: (request: api.SupportRequest) => void;
  onPressUser: () => void;
}

function SupportRequestCard({
  request,
  responsePending,
  closingPending,
  onRespond,
  onClose,
  onPressUser,
}: SupportRequestCardProps) {
  const isClosed = request.status !== 'open';

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <TouchableOpacity onPress={request.is_own_request ? undefined : onPressUser} disabled={request.is_own_request}>
          <Avatar username={request.username} avatarUrl={request.avatar_url ?? undefined} size={36} />
        </TouchableOpacity>
        <View style={styles.cardHeadBody}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardName}>{formatUsername(request.username)}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Needs Support</Text>
            </View>
          </View>
          <Text style={styles.cardMeta}>
            {SUPPORT_TYPE_LABELS[request.type]} · {timeAgo(request.created_at)}
          </Text>
        </View>
      </View>

      {!!request.message && (
        <Text style={styles.cardBody}>{request.message}</Text>
      )}

      <Text style={styles.cardFooterText}>
        {request.city ? `${request.city} · ` : ''}
        {request.response_count} response{request.response_count === 1 ? '' : 's'}
        {request.has_responded ? ' · You responded' : ''}
        {isClosed ? ` · ${request.status}` : ''}
      </Text>

      {request.is_own_request ? (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionSecondary, closingPending && styles.actionDisabled]}
            onPress={() => onClose(request)}
            disabled={closingPending || isClosed}
          >
            <Text style={styles.actionSecondaryText}>
              {closingPending ? 'Closing...' : isClosed ? 'Closed' : 'Close request'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionPrimary, (responsePending || request.has_responded || isClosed) && styles.actionDisabled]}
            onPress={() => onRespond(request, 'can_chat')}
            disabled={responsePending || request.has_responded || isClosed}
          >
            <Text style={styles.actionPrimaryText}>I can chat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionSecondary, (responsePending || request.has_responded || isClosed) && styles.actionDisabled]}
            onPress={() => onRespond(request, 'check_in_later')}
            disabled={responsePending || request.has_responded || isClosed}
          >
            <Text style={styles.actionSecondaryText}>Check in later</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export function SupportScreen({ isActive, onOpenChat, onOpenUserProfile }: SupportScreenProps) {
  const [subView, setSubView] = useState<SupportSubView>('open');
  const [requests, setRequests] = useState<api.SupportRequest[]>([]);
  const [myRequests, setMyRequests] = useState<api.SupportRequest[]>([]);
  const [isAvailableToSupport, setIsAvailableToSupport] = useState(false);
  const [loading, setLoading] = useState(isActive);
  const [refreshing, setRefreshing] = useState(false);
  const [myRefreshing, setMyRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [availabilityUpdating, setAvailabilityUpdating] = useState(false);
  const [responsePendingIds, setResponsePendingIds] = useState<Set<string>>(new Set());
  const [closingIds, setClosingIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    type: 'need_to_talk' as SupportType,
    message: '',
    audience: 'community' as SupportAudience,
    durationHours: 6,
  });
  const hasLoadedRef = useRef(false);
  const wasActiveRef = useRef(false);
  const openLoadRef = useRef<Promise<void> | null>(null);
  const myLoadRef = useRef<Promise<void> | null>(null);

  const loadOpen = useCallback(async () => {
    if (openLoadRef.current) return openLoadRef.current;
    const request = (async () => {
      try {
        const data = await api.getSupportRequests();
        setRequests(data ?? []);
      } catch {
        setRequests([]);
      }
    })();
    openLoadRef.current = request;
    try {
      await request;
    } finally {
      openLoadRef.current = null;
    }
  }, []);

  const loadMine = useCallback(async () => {
    if (myLoadRef.current) return myLoadRef.current;
    const request = (async () => {
      try {
        const data = await api.getMySupportRequests();
        setMyRequests(data ?? []);
      } catch {
        setMyRequests([]);
      }
    })();
    myLoadRef.current = request;
    try {
      await request;
    } finally {
      myLoadRef.current = null;
    }
  }, []);

  useEffect(() => {
    const becameActive = isActive && !wasActiveRef.current;
    wasActiveRef.current = isActive;
    if (!becameActive) return;

    const isFirstLoad = !hasLoadedRef.current;
    if (isFirstLoad) setLoading(true);
    Promise.all([
      loadOpen(),
      loadMine(),
      api.getMySupportProfile().then(profile => setIsAvailableToSupport(profile.is_available_to_support)).catch(() => {}),
    ]).finally(() => {
      hasLoadedRef.current = true;
      if (isFirstLoad) setLoading(false);
    });
  }, [isActive, loadMine, loadOpen]);

  const refreshOpen = async () => {
    setRefreshing(true);
    try {
      await loadOpen();
    } finally {
      setRefreshing(false);
    }
  };

  const refreshMine = async () => {
    setMyRefreshing(true);
    try {
      await loadMine();
    } finally {
      setMyRefreshing(false);
    }
  };

  const openChat = useCallback(async (request: api.SupportRequest) => {
    try {
      const chat = await api.createChat([request.requester_id]);
      onOpenChat({
        id: chat.id,
        is_group: false,
        username: request.username,
        avatar_url: request.avatar_url ?? undefined,
        created_at: new Date().toISOString(),
      });
    } catch (e: unknown) {
      Alert.alert('Could not open chat', e instanceof Error ? e.message : 'Something went wrong.');
    }
  }, [onOpenChat]);

  const handleRespond = async (request: api.SupportRequest, responseType: SupportResponseType) => {
    setResponsePendingIds(prev => new Set(prev).add(request.id));
    try {
      await api.createSupportResponse(request.id, { response_type: responseType });
      setRequests(prev => prev.map(item => item.id === request.id ? {
        ...item,
        has_responded: true,
        response_count: item.response_count + 1,
      } : item));
      await openChat(request);
    } catch (e: unknown) {
      Alert.alert('Could not respond', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setResponsePendingIds(prev => {
        const next = new Set(prev);
        next.delete(request.id);
        return next;
      });
    }
  };

  const handleClose = async (request: api.SupportRequest) => {
    setClosingIds(prev => new Set(prev).add(request.id));
    try {
      await api.updateSupportRequest(request.id, { status: 'closed' });
      setMyRequests(prev => prev.filter(item => item.id !== request.id));
    } catch (e: unknown) {
      Alert.alert('Could not close request', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setClosingIds(prev => {
        const next = new Set(prev);
        next.delete(request.id);
        return next;
      });
    }
  };

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      const created = await api.createSupportRequest({
        type: form.type,
        message: form.message.trim() || null,
        audience: form.audience,
        expires_at: expiryFromHours(form.durationHours),
      });
      setMyRequests(prev => [created, ...prev.filter(item => item.id !== created.id)]);
      setSubView('mine');
      setForm({
        type: 'need_to_talk',
        message: '',
        audience: 'community',
        durationHours: 6,
      });
    } catch (e: unknown) {
      Alert.alert('Could not create support request', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleAvailability = async () => {
    const next = !isAvailableToSupport;
    setIsAvailableToSupport(next);
    setAvailabilityUpdating(true);
    try {
      const profile = await api.updateMySupportProfile({
        is_available_to_support: next,
      });
      setIsAvailableToSupport(profile.is_available_to_support);
    } catch (e: unknown) {
      setIsAvailableToSupport(!next);
      Alert.alert('Could not update support availability', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setAvailabilityUpdating(false);
    }
  };

  const availabilityCard = (
    <View style={styles.availabilityCard}>
      <View style={styles.availabilityBody}>
        <Text style={styles.availabilityTitle}>Available to support</Text>
        <Text style={styles.availabilityText}>
          Let people know you are open to chatting, checking in, or showing up for someone today.
        </Text>
      </View>
      <TouchableOpacity
        style={[
          styles.availabilityToggle,
          isAvailableToSupport && styles.availabilityToggleActive,
          availabilityUpdating && styles.actionDisabled,
        ]}
        onPress={handleToggleAvailability}
        disabled={availabilityUpdating}
      >
        <Text style={[
          styles.availabilityToggleText,
          isAvailableToSupport && styles.availabilityToggleTextActive,
        ]}>
          {availabilityUpdating ? 'Saving...' : isAvailableToSupport ? 'On' : 'Off'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
  }

  if (subView === 'create') {
    return (
      <ScrollView contentContainerStyle={styles.list}>
        <View style={styles.segmentRow}>
          <TouchableOpacity style={styles.segmentButton} onPress={() => setSubView('open')}>
            <Text style={styles.segmentLabel}>Open</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.segmentButton} onPress={() => setSubView('mine')}>
            <Text style={styles.segmentLabel}>My requests</Text>
          </TouchableOpacity>
          <View style={[styles.segmentButton, styles.segmentButtonActive]}>
            <Text style={[styles.segmentLabel, styles.segmentLabelActive]}>Create</Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>SUPPORT</Text>
          <Text style={styles.heroTitle}>Ask the community for support.</Text>
          <Text style={styles.heroText}>Keep it short and specific so people know how to show up for you.</Text>
        </View>

        <Text style={styles.formLabel}>What do you need?</Text>
        <View style={styles.selectorWrap}>
          {(Object.keys(SUPPORT_TYPE_LABELS) as SupportType[]).map(type => (
            <TouchableOpacity
              key={type}
              style={[styles.selectorChip, form.type === type && styles.selectorChipActive]}
              onPress={() => setForm(prev => ({ ...prev, type }))}
            >
              <Text style={[styles.selectorChipText, form.type === type && styles.selectorChipTextActive]}>
                {SUPPORT_TYPE_LABELS[type]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={form.message}
          onChangeText={message => setForm(prev => ({ ...prev, message }))}
          placeholder="Optional note"
          placeholderTextColor={Colors.light.textTertiary}
          multiline
        />

        <Text style={styles.formLabel}>Who should see this?</Text>
        <View style={styles.selectorWrap}>
          {(Object.keys(SUPPORT_AUDIENCE_LABELS) as SupportAudience[]).map(audience => (
            <TouchableOpacity
              key={audience}
              style={[styles.selectorChip, form.audience === audience && styles.selectorChipActive]}
              onPress={() => setForm(prev => ({ ...prev, audience }))}
            >
              <Text style={[styles.selectorChipText, form.audience === audience && styles.selectorChipTextActive]}>
                {SUPPORT_AUDIENCE_LABELS[audience]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.formLabel}>How long should it stay open?</Text>
        <View style={styles.selectorWrap}>
          {SUPPORT_DURATION_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.hours}
              style={[styles.selectorChip, form.durationHours === option.hours && styles.selectorChipActive]}
              onPress={() => setForm(prev => ({ ...prev, durationHours: option.hours }))}
            >
              <Text style={[styles.selectorChipText, form.durationHours === option.hours && styles.selectorChipTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={[styles.submitButton, submitting && styles.actionDisabled]} onPress={handleCreate} disabled={submitting}>
          {submitting ? <ActivityIndicator color={Colors.textOn.primary} /> : <Text style={styles.submitButtonText}>Post support request</Text>}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  const isMineView = subView === 'mine';
  const data = isMineView ? myRequests : requests;
  const openRequestCount = requests.filter(request => request.status === 'open').length;

  return (
    <FlatList
      data={data}
      keyExtractor={item => item.id}
      refreshControl={
        <RefreshControl
          refreshing={isMineView ? myRefreshing : refreshing}
          onRefresh={isMineView ? refreshMine : refreshOpen}
          tintColor={Colors.primary}
        />
      }
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <>
          <View style={styles.segmentRow}>
            <TouchableOpacity style={[styles.segmentButton, !isMineView && styles.segmentButtonActive]} onPress={() => setSubView('open')}>
              <Text style={[styles.segmentLabel, !isMineView && styles.segmentLabelActive]}>Open</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.segmentButton, isMineView && styles.segmentButtonActive]} onPress={() => setSubView('mine')}>
              <Text style={[styles.segmentLabel, isMineView && styles.segmentLabelActive]}>My requests</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.segmentButton} onPress={() => setSubView('create')}>
              <Text style={styles.segmentLabel}>Create</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>SUPPORT</Text>
            <Text style={styles.heroTitle}>{isMineView ? 'Requests you created.' : 'Open support requests from the community.'}</Text>
            <Text style={styles.heroText}>
              {isMineView
                ? 'Close requests once you are okay or once someone has connected with you.'
                : 'Respond quickly when you can genuinely show up for someone.'}
            </Text>
          </View>
          {!isMineView ? (
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{openRequestCount}</Text>
                <Text style={styles.statLabel}>Open requests</Text>
              </View>
            </View>
          ) : null}
          {!isMineView ? availabilityCard : null}
        </>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{isMineView ? 'No support requests yet.' : 'No open requests right now.'}</Text>
          <Text style={styles.emptySubtext}>{isMineView ? 'Create one when you need the community.' : 'Check back later or turn on availability in your profile.'}</Text>
        </View>
      }
        renderItem={({ item }) => (
          <SupportRequestCard
            request={item}
            responsePending={responsePendingIds.has(item.id)}
            closingPending={closingIds.has(item.id)}
            onRespond={handleRespond}
            onClose={handleClose}
            onPressUser={() => onOpenUserProfile({
              userId: item.requester_id,
              username: item.username,
              avatarUrl: item.avatar_url ?? undefined,
          })}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.background },
  list: { padding: Spacing.md, paddingBottom: 32 },
  segmentRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  segmentButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radii.full,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundSecondary,
  },
  segmentButtonActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  segmentLabel: { fontSize: Typography.sizes.sm, fontWeight: '600', color: Colors.light.textSecondary },
  segmentLabelActive: { color: Colors.textOn.primary },
  heroCard: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  heroEyebrow: { fontSize: Typography.sizes.xs, fontWeight: '700', color: Colors.primary, letterSpacing: 0.8, marginBottom: 6 },
  heroTitle: { fontSize: Typography.sizes.xl, fontWeight: '600', color: Colors.light.textPrimary },
  heroText: { fontSize: Typography.sizes.sm, color: Colors.light.textSecondary, lineHeight: 19, marginTop: Spacing.sm },
  statsRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.md,
  },
  statValue: {
    fontSize: Typography.sizes.xl,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  statLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.light.textTertiary,
    marginTop: 4,
  },
  availabilityCard: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  availabilityBody: { flex: 1 },
  availabilityTitle: { fontSize: Typography.sizes.md, fontWeight: '600', color: Colors.light.textPrimary, marginBottom: 4 },
  availabilityText: { fontSize: Typography.sizes.sm, color: Colors.light.textSecondary, lineHeight: 19 },
  availabilityToggle: {
    minWidth: 72,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.light.background,
  },
  availabilityToggleActive: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  availabilityToggleText: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  availabilityToggleTextActive: {
    color: Colors.textOn.primary,
  },
  formLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  selectorWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  selectorChip: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    backgroundColor: Colors.light.backgroundSecondary,
  },
  selectorChipActive: { backgroundColor: Colors.success, borderColor: Colors.success },
  selectorChipText: { fontSize: Typography.sizes.sm, color: Colors.light.textSecondary },
  selectorChipTextActive: { color: Colors.textOn.primary, fontWeight: '600' },
  input: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    fontSize: Typography.sizes.md,
    color: Colors.light.textPrimary,
    borderWidth: 0.5,
    borderColor: Colors.light.border,
    marginTop: Spacing.md,
  },
  inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
  submitButton: {
    backgroundColor: Colors.success,
    borderRadius: Radii.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  submitButtonText: { color: Colors.textOn.primary, fontWeight: '600', fontSize: Typography.sizes.md },
  card: {
    backgroundColor: Colors.light.backgroundSecondary,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardHeadBody: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  cardName: { fontSize: Typography.sizes.md, fontWeight: '600', color: Colors.light.textPrimary },
  badge: { backgroundColor: Colors.successSubtle, borderRadius: Radii.full, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: Typography.sizes.xs, fontWeight: '700', color: Colors.success },
  cardMeta: { fontSize: Typography.sizes.sm, color: Colors.light.textTertiary, marginTop: 4 },
  cardBody: { fontSize: Typography.sizes.base, lineHeight: 19, color: Colors.light.textSecondary, marginTop: Spacing.md },
  cardFooterText: { fontSize: Typography.sizes.sm, color: Colors.light.textTertiary, marginTop: Spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
  actionPrimary: { backgroundColor: Colors.success, borderRadius: Radii.full, paddingHorizontal: Spacing.md, paddingVertical: 10 },
  actionPrimaryText: { color: Colors.textOn.primary, fontSize: Typography.sizes.sm, fontWeight: '600' },
  actionSecondary: {
    backgroundColor: Colors.light.background,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  actionSecondaryText: { color: Colors.light.textSecondary, fontSize: Typography.sizes.sm, fontWeight: '600' },
  actionDisabled: { opacity: 0.6 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: Typography.sizes.lg, fontWeight: '500', color: Colors.light.textPrimary },
  emptySubtext: { fontSize: Typography.sizes.base, color: Colors.light.textTertiary, marginTop: Spacing.sm, textAlign: 'center' },
});
