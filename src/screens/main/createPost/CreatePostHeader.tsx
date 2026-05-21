import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Colors,
  ControlSizes,
  Radius,
  Spacing,
  TextStyles,
} from "../../../theme";
import { CreateSurfaceHeader } from "../../../components/ui/CreateSurfaceHeader";
import { CharacterCounterRing } from "./CharacterCounterRing";

interface CreatePostHeaderProps {
  bodyLength: number;
  canSubmit: boolean;
  isSubmitting: boolean;
  maxLength: number;
  postType: "text" | "photo";
  title?: string;
  onBack: () => void;
  onSubmit: () => void;
}

export function CreatePostHeader({
  bodyLength,
  canSubmit,
  isSubmitting,
  maxLength,
  postType,
  title,
  onBack,
  onSubmit,
}: CreatePostHeaderProps): React.ReactElement {
  const subtitle = title ?? (postType === "photo" ? "Photo post" : "Text post");

  return (
    <CreateSurfaceHeader
      onBack={onBack}
      backDisabled={isSubmitting}
      centerContent={(
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      )}
      trailing={(
        <View style={styles.right}>
          <CharacterCounterRing count={bodyLength} max={maxLength} />
          <TouchableOpacity
            style={[
              styles.postButton,
              !canSubmit && styles.postButtonDisabled,
            ]}
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
      )}
    />
  );
}

const styles = StyleSheet.create({
  subtitle: {
    ...TextStyles.caption,
    letterSpacing: 0.2,
    textTransform: "uppercase",
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
