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
  ControlSizes,
  ContentInsets,
  Radius,
  Spacing,
  TextStyles,
} from "../../../theme";
import { CharacterCounterRing } from "./CharacterCounterRing";

interface CreatePostHeaderProps {
  bodyLength: number;
  canSubmit: boolean;
  draftCount: number;
  isSubmitting: boolean;
  maxLength: number;
  postType: "text" | "photo";
  title?: string;
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
  title,
  onBack,
  onOpenDrafts,
  onSubmit,
}: CreatePostHeaderProps): React.ReactElement {
  const subtitle = title ?? (postType === "photo" ? "Photo post" : "Text post");

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
    width: ControlSizes.iconButton,
    height: ControlSizes.iconButton,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: {
    ...TextStyles.caption,
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  draftsLink: {
    ...TextStyles.chip,
    color: Colors.primary,
    marginTop: 2,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  postButton: {
    minWidth: 72,
    minHeight: ControlSizes.iconButton,
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
    ...TextStyles.button,
    color: Colors.textOn.primary,
    fontSize: TextStyles.chip.fontSize,
  },
});
