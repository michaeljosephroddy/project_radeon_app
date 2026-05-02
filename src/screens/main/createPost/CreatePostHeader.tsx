import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Colors,
  ContentInsets,
  Radius,
  Spacing,
  Typography,
} from "../../../theme";
import { CharacterCounterRing } from "./CharacterCounterRing";

interface CreatePostHeaderProps {
  bodyLength: number;
  canSubmit: boolean;
  draftCount: number;
  isSubmitting: boolean;
  maxLength: number;
  postType: "text" | "photo";
  onBack: () => void;
  onOpenDrafts: () => void;
  onSubmit: () => void;
}

export function CreatePostHeader({
  bodyLength,
  canSubmit,
  draftCount,
  isSubmitting,
  maxLength,
  postType,
  onBack,
  onOpenDrafts,
  onSubmit,
}: CreatePostHeaderProps): React.ReactElement {
  const subtitle = postType === "photo" ? "Photo post" : "Text post";

  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.headerButton}
        onPress={onBack}
        disabled={isSubmitting}
        accessibilityRole="button"
        accessibilityLabel="Discard or save draft"
        hitSlop={8}
      >
        <Ionicons name="close" size={24} color={Colors.text.primary} />
      </TouchableOpacity>

      <View style={styles.center}>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
        {draftCount > 0 ? (
          <TouchableOpacity
            onPress={onOpenDrafts}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel={`Open ${draftCount} saved drafts`}
            hitSlop={8}
          >
            <Text style={styles.draftsLink}>Drafts·{draftCount}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.right}>
        <CharacterCounterRing count={bodyLength} max={maxLength} />
        <TouchableOpacity
          style={[styles.postButton, !canSubmit && styles.postButtonDisabled]}
          onPress={onSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel="Post"
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={Colors.textOn.primary} />
          ) : (
            <Text style={styles.postButtonText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 56,
    paddingHorizontal: ContentInsets.screenHorizontal,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
    backgroundColor: Colors.bg.page,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.muted,
    fontWeight: "600",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  draftsLink: {
    fontSize: Typography.sizes.sm,
    color: Colors.primary,
    fontWeight: "600",
    marginTop: 2,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  postButton: {
    minWidth: 72,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    color: Colors.textOn.primary,
    fontSize: Typography.sizes.sm,
    fontWeight: "700",
  },
});
