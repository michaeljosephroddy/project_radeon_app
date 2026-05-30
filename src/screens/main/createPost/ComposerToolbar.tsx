import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Colors,
  ControlSizes,
  Radius,
  Spacing,
} from "../../../theme";

interface ComposerToolbarProps {
  hasImage: boolean;
  onPickImage: () => void;
}

export function ComposerToolbar({
  hasImage,
  onPickImage,
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
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border.emphasis,
    backgroundColor: Colors.bg.page,
  },
  iconButton: {
    width: ControlSizes.iconButton,
    height: ControlSizes.iconButton,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primarySubtle,
  },
});
