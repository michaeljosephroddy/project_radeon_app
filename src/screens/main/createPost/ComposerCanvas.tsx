import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as api from "../../../api/client";
import { Colors, ControlSizes, Radius, Spacing, TextStyles, Typography } from "../../../theme";
import {
  ImagePreviewCard,
  ImagePreviewSource,
  ImagePreviewStatus,
} from "./ImagePreviewCard";

interface ComposerCanvasProps {
  body: string;
  image: ImagePreviewSource | null;
  imageStatus: ImagePreviewStatus | null;
  maxBodyLength: number;
  tags: string[];
  user: api.User;
  onBodyChange: (body: string) => void;
  onRemoveImage: () => void;
  onRemoveTag: (tag: string) => void;
  onRetryImage: () => void;
}

export function ComposerCanvas({
  body,
  image,
  imageStatus,
  maxBodyLength,
  tags,
  user,
  onBodyChange,
  onRemoveImage,
  onRemoveTag,
  onRetryImage,
}: ComposerCanvasProps): React.ReactElement {
  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustContentInsets={false}
      automaticallyAdjustKeyboardInsets={false}
      contentInsetAdjustmentBehavior="never"
    >
      {tags.length > 0 ? (
        <View style={styles.selectedTags}>
          {tags.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={styles.selectedTag}
              onPress={() => onRemoveTag(tag)}
              accessibilityRole="button"
              accessibilityLabel={`Remove tag ${tag}`}
            >
              <Text style={styles.selectedTagText}>#{tag}</Text>
              <Ionicons name="close" size={14} color={Colors.primary} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {image && imageStatus ? (
        <ImagePreviewCard
          image={image}
          status={imageStatus}
          onRemove={onRemoveImage}
          onRetry={onRetryImage}
        />
      ) : null}

      <TextInput
        style={styles.bodyInput}
        value={body}
        onChangeText={onBodyChange}
        placeholder="What's on your mind?"
        placeholderTextColor={Colors.text.muted}
        multiline
        maxLength={maxBodyLength}
        scrollEnabled={false}
        textAlignVertical="top"
        accessibilityLabel="Post text"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  bodyInput: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.composer,
    lineHeight: 28,
    minHeight: 180,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  selectedTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
  },
  selectedTag: {
    minHeight: ControlSizes.chipMinHeight,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: Colors.primarySubtle,
  },
  selectedTagText: {
    ...TextStyles.chip,
    color: Colors.primary,
    fontWeight: "700",
  },
});
