import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Colors,
  Radius,
  Spacing,
  Typography,
} from "../../../theme";

interface ComposerToolbarProps {
  hasImage: boolean;
  tagCount: number;
  maxTags: number;
  onPickImage: () => void;
  onOpenTagPicker: () => void;
}

export function ComposerToolbar({
  hasImage,
  tagCount,
  maxTags,
  onPickImage,
  onOpenTagPicker,
}: ComposerToolbarProps): React.ReactElement {
  return (
    <View style={styles.toolbar}>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={onPickImage}
        accessibilityRole="button"
        accessibilityLabel={hasImage ? "Replace photo" : "Add a photo"}
        hitSlop={4}
      >
        <Ionicons
          name={hasImage ? "image" : "image-outline"}
          size={22}
          color={Colors.primary}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.iconButton}
        onPress={onOpenTagPicker}
        accessibilityRole="button"
        accessibilityLabel={`Add tags. ${tagCount} of ${maxTags} selected`}
        hitSlop={4}
      >
        <Ionicons name="pricetag-outline" size={20} color={Colors.primary} />
        {tagCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{tagCount}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border.default,
    backgroundColor: Colors.bg.page,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primarySubtle,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: Colors.textOn.primary,
    fontSize: Typography.sizes.xs,
    fontWeight: "700",
  },
});
