import React from "react";
import {
  StyleSheet,
  TextInput,
} from "react-native";
import { AppKeyboardAwareScrollView } from "../../../components/ui/AppKeyboardAwareScrollView";
import { KEYBOARD_STICKY_FOOTER_SINGLE_ACTION_RESERVE } from "../../../components/ui/KeyboardStickyFooter";
import { Colors, Spacing, Typography } from "../../../theme";
import {
  ImagePreviewCard,
  ImagePreviewSource,
  ImagePreviewStatus,
} from "./ImagePreviewCard";

interface ComposerCanvasProps {
  body: string;
  bottomInset: number;
  image: ImagePreviewSource | null;
  imageStatus: ImagePreviewStatus | null;
  maxBodyLength: number;
  onBodyChange: (body: string) => void;
  onRemoveImage: () => void;
  onRetryImage: () => void;
}

export function ComposerCanvas({
  body,
  bottomInset,
  image,
  imageStatus,
  maxBodyLength,
  onBodyChange,
  onRemoveImage,
  onRetryImage,
}: ComposerCanvasProps): React.ReactElement {
  return (
    <AppKeyboardAwareScrollView
      style={styles.fill}
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      bottomOffset={bottomInset}
      extraKeyboardSpace={Spacing.md}
      automaticallyAdjustContentInsets={false}
      automaticallyAdjustKeyboardInsets={false}
      contentInsetAdjustmentBehavior="never"
    >
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
    </AppKeyboardAwareScrollView>
  );
}

export const COMPOSER_CANVAS_BOTTOM_RESERVE = KEYBOARD_STICKY_FOOTER_SINGLE_ACTION_RESERVE + Spacing.md;

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  bodyInput: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.composer,
    lineHeight: 28,
    minHeight: 160,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
});
