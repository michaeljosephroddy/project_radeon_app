import React from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, ControlSizes, Spacing, TextStyles } from "../../../theme";

export interface ImagePreviewSource {
  uri: string;
  width: number | null;
  height: number | null;
}

export type ImagePreviewStatus = "uploading" | "uploaded" | "failed";

interface ImagePreviewCardProps {
  image: ImagePreviewSource;
  status: ImagePreviewStatus;
  onRemove: () => void;
  onRetry: () => void;
}

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 340;

export function ImagePreviewCard({
  image,
  status,
  onRemove,
  onRetry,
}: ImagePreviewCardProps): React.ReactElement {
  const { width: windowWidth } = useWindowDimensions();
  const previewHeight = computeHeight(image, windowWidth);

  return (
    <View style={[styles.wrap, { width: windowWidth, height: previewHeight }]}>
      <Image
        source={{ uri: image.uri }}
        style={styles.image}
        resizeMode="cover"
      />
      <TouchableOpacity
        style={styles.removeButton}
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel="Remove image"
        hitSlop={6}
      >
        <Ionicons name="close" size={16} color={Colors.textOn.primary} />
      </TouchableOpacity>

      {status === "uploading" ? (
        <View style={styles.overlay}>
          <ActivityIndicator color={Colors.textOn.primary} />
        </View>
      ) : null}

      {status === "failed" ? (
        <TouchableOpacity
          style={styles.failOverlay}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry image upload"
        >
          <Ionicons name="refresh" size={20} color={Colors.textOn.primary} />
          <Text style={styles.failText}>Tap to retry</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function computeHeight(
  image: ImagePreviewSource,
  width: number,
): number {
  const safeWidth = Math.max(width, 1);
  if (!image.width || !image.height || image.width <= 0 || image.height <= 0) {
    return MIN_HEIGHT;
  }
  const natural = safeWidth * (image.height / image.width);
  return Math.min(Math.max(natural, MIN_HEIGHT), MAX_HEIGHT);
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    alignSelf: "stretch",
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    overflow: "hidden",
    backgroundColor: Colors.bg.surface,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  removeButton: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: ControlSizes.chipMinHeight,
    height: ControlSizes.chipMinHeight,
    borderRadius: ControlSizes.chipMinHeight / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  failOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  failText: {
    ...TextStyles.button,
    color: Colors.textOn.primary,
    fontSize: TextStyles.chip.fontSize,
  },
});
