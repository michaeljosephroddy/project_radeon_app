import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PostDraft } from "../../../hooks/useCreatePostDrafts";
import { Colors, Radius, Spacing, Typography } from "../../../theme";

interface DraftsSheetProps {
  drafts: PostDraft[];
  onClose: () => void;
  onDeleteDraft: (draftId: string) => void;
  onLoadDraft: (draftId: string) => void;
}

export function DraftsSheet({
  drafts,
  onClose,
  onDeleteDraft,
  onLoadDraft,
}: DraftsSheetProps): React.ReactElement {
  return (
    <View style={styles.overlay}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close drafts"
      />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>Drafts</Text>
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close drafts"
            hitSlop={8}
          >
            <Text style={styles.doneLink}>Done</Text>
          </TouchableOpacity>
        </View>

        {drafts.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No drafts yet</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {drafts.map((draft) => (
              <DraftRow
                key={draft.id}
                draft={draft}
                onDeleteDraft={onDeleteDraft}
                onLoadDraft={onLoadDraft}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

interface DraftRowProps {
  draft: PostDraft;
  onDeleteDraft: (draftId: string) => void;
  onLoadDraft: (draftId: string) => void;
}

function DraftRow({
  draft,
  onDeleteDraft,
  onLoadDraft,
}: DraftRowProps): React.ReactElement {
  const title = draft.body.trim() || "Photo post";
  const metaParts = [
    formatRelativeTime(draft.updatedAt),
    draft.image ? "1 image" : null,
    ...draft.tags.map((tag) => `#${tag}`),
  ].filter((part): part is string => Boolean(part));

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onLoadDraft(draft.id)}
      accessibilityRole="button"
      accessibilityLabel={`Load draft ${title}`}
    >
      <View style={styles.rowText}>
        <Text style={styles.preview} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {metaParts.join(" · ")}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onDeleteDraft(draft.id)}
        accessibilityRole="button"
        accessibilityLabel="Delete draft"
        hitSlop={8}
      >
        <Ionicons name="close" size={18} color={Colors.text.secondary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function formatRelativeTime(updatedAt: number): string {
  const seconds = Math.max(1, Math.floor((Date.now() - updatedAt) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.scrim,
  },
  sheet: {
    maxHeight: "70%",
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    backgroundColor: Colors.bg.page,
    borderTopWidth: 1,
    borderColor: Colors.border.default,
    overflow: "hidden",
  },
  header: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  title: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: Typography.sizes.xl,
    fontWeight: "700",
  },
  doneLink: {
    color: Colors.primary,
    fontSize: Typography.sizes.md,
    fontWeight: "700",
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: Spacing.md,
  },
  row: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  rowText: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  preview: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.md,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  meta: {
    color: Colors.text.muted,
    fontSize: Typography.sizes.sm,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyWrap: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  emptyText: {
    color: Colors.text.muted,
    fontSize: Typography.sizes.md,
  },
});
