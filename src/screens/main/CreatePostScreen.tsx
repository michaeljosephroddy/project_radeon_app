import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TextInput,
  TextInputContentSizeChangeEventData,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  KeyboardAwareScrollView,
  KeyboardProvider,
} from "react-native-keyboard-controller";
import type { KeyboardAwareScrollViewRef } from "react-native-keyboard-controller";
import * as ImagePicker from "expo-image-picker";
import { Avatar } from "../../components/Avatar";
import * as api from "../../api/client";
import {
  Colors,
  ContentInsets,
  Radius,
  Spacing,
  Typography,
} from "../../theme";
import { formatUsername } from "../../utils/identity";
import { useAuth } from "../../hooks/useAuth";
import { useCreatePostMutation } from "../../hooks/queries/useCreatePostMutation";

interface CreatePostScreenProps {
  onBack: () => void;
}

interface SelectedPostImage {
  uri: string;
  mimeType: string;
  fileName: string;
  width: number | null;
  height: number | null;
}

interface ComposerImageState {
  localImage: SelectedPostImage;
  status: "uploading" | "uploaded" | "failed";
  uploadedImage?: api.PostImage;
}

interface CreatePostHeaderProps {
  canSubmit: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
}

interface AuthorRowProps {
  user: api.User;
}

interface BodyInputProps {
  height: number;
  onChangeText: (value: string) => void;
  onContentSizeChange: (
    event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>,
  ) => void;
}

interface ImagePreviewProps {
  image: ComposerImageState;
  onRemove: () => void;
}

interface TagEditorProps {
  customTag: string;
  error: string | null;
  tags: string[];
  onAddTag: (tag: string) => void;
  onChangeCustomTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

interface ImageUploadButtonProps {
  hasImage: boolean;
  onPickImage: () => void;
}

const SUGGESTED_TAGS = [
  "check-in",
  "question",
  "milestone",
  "craving",
  "gratitude",
  "support",
];
const MAX_POST_TAGS = 5;
const HEADER_HEIGHT = 56;
const TAG_PATTERN = /^[a-z0-9_-]+$/;
const MIN_BODY_INPUT_HEIGHT = 112;
const MIN_IMAGE_PREVIEW_HEIGHT = 120;
const MAX_IMAGE_PREVIEW_HEIGHT = 340;

export function CreatePostScreen({
  onBack,
}: CreatePostScreenProps): React.ReactElement | null {
  const { user } = useAuth();
  const createPostMutation = useCreatePostMutation();
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const bodyRef = useRef("");
  const [hasBodyText, setHasBodyText] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);
  const [bodyInputHeight, setBodyInputHeight] = useState(
    MIN_BODY_INPUT_HEIGHT,
  );
  const [selectedImage, setSelectedImage] = useState<ComposerImageState | null>(
    null,
  );
  const uploadPromiseRef = useRef<Promise<api.PostImage> | null>(null);

  const beginImageUpload = useCallback(
    (image: SelectedPostImage): Promise<api.PostImage> => {
      const uploadPromise = api.uploadPostImage({
        uri: image.uri,
        mimeType: image.mimeType,
        fileName: image.fileName,
      });
      uploadPromiseRef.current = uploadPromise;

      void uploadPromise
        .then((uploadedImage) => {
          setSelectedImage((current) => {
            if (!current || current.localImage.uri !== image.uri) {
              return current;
            }
            return { ...current, status: "uploaded", uploadedImage };
          });
        })
        .catch(() => {
          setSelectedImage((current) => {
            if (!current || current.localImage.uri !== image.uri) {
              return current;
            }
            return { ...current, status: "failed" };
          });
        });

      return uploadPromise;
    },
    [],
  );

  const handlePickImage = useCallback(async (): Promise<void> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission required",
        "Allow access to your photo library to attach a post image.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const nextImage: SelectedPostImage = {
      uri: asset.uri,
      mimeType: asset.mimeType ?? inferMimeType(asset.uri),
      fileName: asset.fileName ?? inferFileName(asset.uri, "post.jpg"),
      width: asset.width,
      height: asset.height,
    };
    setSelectedImage({ localImage: nextImage, status: "uploading" });
    beginImageUpload(nextImage).catch(() => {});
  }, [beginImageUpload]);

  const handleRemoveImage = useCallback((): void => {
    uploadPromiseRef.current = null;
    setSelectedImage(null);
  }, []);

  const addTag = useCallback((rawTag: string): void => {
    const validation = validateTag(rawTag);
    if (!validation.ok) {
      setTagError(validation.error);
      return;
    }

    setTags((current) => {
      if (current.includes(validation.tag)) return current;
      if (current.length >= MAX_POST_TAGS) {
        setTagError(`Add up to ${MAX_POST_TAGS} tags.`);
        return current;
      }
      return [...current, validation.tag];
    });
    setCustomTag("");
    setTagError(null);
  }, []);

  const removeTag = useCallback((tag: string): void => {
    setTags((current) => current.filter((currentTag) => currentTag !== tag));
    setTagError(null);
  }, []);

  const handleBodyChangeText = useCallback((nextBody: string): void => {
    bodyRef.current = nextBody;
    const nextHasBodyText = nextBody.trim().length > 0;
    setHasBodyText((current) =>
      current === nextHasBodyText ? current : nextHasBodyText,
    );
  }, []);

  const handleBodyContentSizeChange = useCallback(
    (
      event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>,
    ): void => {
      const nextHeight = Math.max(
        Math.ceil(event.nativeEvent.contentSize.height),
        MIN_BODY_INPUT_HEIGHT,
      );
      setBodyInputHeight((current) =>
        current === nextHeight ? current : nextHeight,
      );
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 0);
    },
    [],
  );

  const isSubmitting = createPostMutation.isPending;
  const canSubmit = (hasBodyText || selectedImage !== null) && !isSubmitting;

  const handleSubmit = useCallback((): void => {
    if (!canSubmit) return;
    const trimmedBody = bodyRef.current.trim();
    const currentImage = selectedImage;

    void (async () => {
      try {
        let images: api.PostImage[] = [];
        if (currentImage) {
          if (currentImage.uploadedImage) {
            images = [currentImage.uploadedImage];
          } else if (uploadPromiseRef.current) {
            images = [await uploadPromiseRef.current];
          } else {
            images = [await beginImageUpload(currentImage.localImage)];
          }
        }

        await createPostMutation.mutateAsync({
          body: trimmedBody || undefined,
          images,
          tags,
        });
        onBack();
      } catch (e: unknown) {
        Alert.alert(
          "Error",
          e instanceof Error ? e.message : "Something went wrong.",
        );
      }
    })();
  }, [
    beginImageUpload,
    canSubmit,
    createPostMutation,
    onBack,
    selectedImage,
    tags,
  ]);

  if (!user) return null;

  return (
    <View style={styles.container}>
      <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
        <CreatePostHeader
          canSubmit={canSubmit}
          isSubmitting={isSubmitting}
          onBack={onBack}
          onSubmit={handleSubmit}
        />

        <KeyboardAwareScrollView
          ref={scrollRef}
          style={styles.body}
          contentContainerStyle={styles.composerScroll}
          keyboardShouldPersistTaps="handled"
          bottomOffset={Spacing.lg}
          extraKeyboardSpace={Spacing.xl}
        >
          <View style={styles.composerPost}>
            <AuthorRow user={user} />
            <TagEditor
              customTag={customTag}
              error={tagError}
              tags={tags}
              onAddTag={addTag}
              onChangeCustomTag={setCustomTag}
              onRemoveTag={removeTag}
            />
            <BodyInput
              height={bodyInputHeight}
              onChangeText={handleBodyChangeText}
              onContentSizeChange={handleBodyContentSizeChange}
            />
            <View style={styles.composerToolbar}>
              <ImageUploadButton
                hasImage={selectedImage !== null}
                onPickImage={handlePickImage}
              />
            </View>
            {selectedImage ? (
              <ImagePreview image={selectedImage} onRemove={handleRemoveImage} />
            ) : null}
          </View>
        </KeyboardAwareScrollView>
      </KeyboardProvider>
    </View>
  );
}

function CreatePostHeader({
  canSubmit,
  isSubmitting,
  onBack,
  onSubmit,
}: CreatePostHeaderProps): React.ReactElement {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.headerButton}
        onPress={onBack}
        disabled={isSubmitting}
      >
        <Ionicons name="close" size={24} color={Colors.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Create post</Text>
      <TouchableOpacity
        style={[styles.postButton, !canSubmit && styles.postButtonDisabled]}
        onPress={onSubmit}
        disabled={!canSubmit}
      >
        <Text style={styles.postButtonText}>
          {isSubmitting ? "Posting" : "Post"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function AuthorRow({ user }: AuthorRowProps): React.ReactElement {
  return (
    <View style={styles.authorRow}>
      <Avatar username={user.username} avatarUrl={user.avatar_url} size={42} />
      <View style={styles.authorText}>
        <Text style={styles.authorName}>{formatUsername(user.username)}</Text>
        <Text style={styles.authorMeta}>Community post</Text>
      </View>
    </View>
  );
}

function BodyInput({
  height,
  onChangeText,
  onContentSizeChange,
}: BodyInputProps): React.ReactElement {
  return (
    <TextInput
      style={[styles.bodyInput, { height }]}
      onChangeText={onChangeText}
      onContentSizeChange={onContentSizeChange}
      placeholder="What do you want to share?"
      placeholderTextColor={Colors.text.muted}
      multiline
      scrollEnabled={false}
      textAlignVertical="top"
    />
  );
}

function ImagePreview({
  image,
  onRemove,
}: ImagePreviewProps): React.ReactElement {
  const { width: windowWidth } = useWindowDimensions();
  const previewWidth = windowWidth - Spacing.md * 2;
  const previewHeight = getImagePreviewHeight(image.localImage, previewWidth);

  return (
    <View style={[styles.imagePreviewWrap, { height: previewHeight }]}>
      <Image
        source={{ uri: image.localImage.uri }}
        style={styles.imagePreview}
        resizeMode="contain"
      />
      <TouchableOpacity style={styles.removeImageButton} onPress={onRemove}>
        <Ionicons name="close" size={16} color={Colors.textOn.primary} />
      </TouchableOpacity>
      <View style={styles.imageStatusBadge}>
        <Text style={styles.imageStatusText}>
          {imageStatusLabel(image.status)}
        </Text>
      </View>
    </View>
  );
}

function TagEditor({
  customTag,
  error,
  tags,
  onAddTag,
  onChangeCustomTag,
  onRemoveTag,
}: TagEditorProps): React.ReactElement {
  return (
    <View style={styles.tagsSection}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>Tags</Text>
        <Text style={styles.tagLimitText}>
          {tags.length}/{MAX_POST_TAGS}
        </Text>
      </View>
      {tags.length > 0 ? (
        <View style={styles.selectedTags}>
          {tags.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={styles.selectedTag}
              onPress={() => onRemoveTag(tag)}
            >
              <Text style={styles.selectedTagText}>#{tag}</Text>
              <Ionicons name="close" size={14} color={Colors.primary} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      <View style={styles.tagInputRow}>
        <TextInput
          style={styles.tagInput}
          value={customTag}
          onChangeText={onChangeCustomTag}
          placeholder="Add a tag"
          placeholderTextColor={Colors.text.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => onAddTag(customTag)}
        />
        <TouchableOpacity
          style={styles.addTagButton}
          onPress={() => onAddTag(customTag)}
        >
          <Ionicons name="add" size={20} color={Colors.textOn.primary} />
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.tagError}>{error}</Text> : null}
      <View style={styles.suggestedTags}>
        {SUGGESTED_TAGS.map((tag) => {
          const selected = tags.includes(tag);
          return (
            <TouchableOpacity
              key={tag}
              style={[
                styles.suggestedTag,
                selected && styles.suggestedTagSelected,
              ]}
              onPress={() => (selected ? onRemoveTag(tag) : onAddTag(tag))}
            >
              <Text
                style={[
                  styles.suggestedTagText,
                  selected && styles.suggestedTagTextSelected,
                ]}
              >
                #{tag}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function ImageUploadButton({
  hasImage,
  onPickImage,
}: ImageUploadButtonProps): React.ReactElement {
  return (
    <TouchableOpacity style={styles.imageUploadButton} onPress={onPickImage}>
      <Ionicons name="image-outline" size={20} color={Colors.primary} />
      <Text style={styles.imageUploadButtonText}>
        {hasImage ? "Replace" : "Photo"}
      </Text>
    </TouchableOpacity>
  );
}

interface TagValidationResult {
  ok: boolean;
  tag: string;
  error: string | null;
}

function validateTag(rawTag: string): TagValidationResult {
  const tag = normalizeTag(rawTag);
  if (!tag) {
    return { ok: false, tag, error: null };
  }
  if (!TAG_PATTERN.test(tag)) {
    return {
      ok: false,
      tag,
      error: "Use letters, numbers, hyphen, or underscore.",
    };
  }
  if (tag.length > 32) {
    return { ok: false, tag, error: "Tags must be 32 characters or fewer." };
  }
  return { ok: true, tag, error: null };
}

function normalizeTag(rawTag: string): string {
  return rawTag.trim().replace(/^#/, "").trim().toLowerCase();
}

function imageStatusLabel(status: ComposerImageState["status"]): string {
  switch (status) {
    case "uploading":
      return "Uploading";
    case "uploaded":
      return "Ready";
    case "failed":
      return "Retry on post";
  }
}

function inferMimeType(
  uri: string | undefined,
  fallback = "image/jpeg",
): string {
  const normalizedUri = uri?.toLowerCase() ?? "";
  if (normalizedUri.endsWith(".png")) return "image/png";
  if (normalizedUri.endsWith(".jpg") || normalizedUri.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  return fallback;
}

function inferFileName(uri: string | undefined, fallback: string): string {
  if (!uri) return fallback;
  const segment = uri.split("/").pop()?.split("?")[0];
  return segment && segment.includes(".") ? segment : fallback;
}

function getImagePreviewHeight(
  image: SelectedPostImage,
  previewWidth: number,
): number {
  const safeWidth = Math.max(previewWidth, 1);
  if (!image.width || !image.height || image.width <= 0 || image.height <= 0) {
    return MIN_IMAGE_PREVIEW_HEIGHT;
  }

  const naturalHeight = safeWidth * (image.height / image.width);
  return Math.min(
    Math.max(naturalHeight, MIN_IMAGE_PREVIEW_HEIGHT),
    MAX_IMAGE_PREVIEW_HEIGHT,
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.page,
  },
  header: {
    height: HEADER_HEIGHT,
    paddingHorizontal: ContentInsets.screenHorizontal,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
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
  headerTitle: {
    flex: 1,
    fontSize: Typography.sizes.lg,
    lineHeight: 20,
    fontWeight: "700",
    color: Colors.text.primary,
  },
  postButton: {
    minWidth: 76,
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
  body: {
    flex: 1,
    minHeight: 0,
  },
  composerScroll: {
    paddingBottom: Spacing.xl,
  },
  composerPost: {
    backgroundColor: Colors.bg.page,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexShrink: 0,
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  authorText: {
    flex: 1,
    minWidth: 0,
  },
  authorName: {
    fontSize: Typography.sizes.md,
    fontWeight: "700",
    color: Colors.text.primary,
  },
  authorMeta: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.muted,
  },
  bodyInput: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.lg,
    lineHeight: 24,
    paddingHorizontal: Spacing.md,
    paddingTop: 0,
    paddingBottom: 0,
  },
  imagePreviewWrap: {
    position: "relative",
    alignSelf: "stretch",
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    borderRadius: Radius.md,
    overflow: "hidden",
    backgroundColor: Colors.bg.surface,
    flexShrink: 0,
  },
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  removeImageButton: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 30,
    height: 30,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
  },
  imageStatusBadge: {
    position: "absolute",
    left: Spacing.sm,
    bottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Colors.overlay,
  },
  imageStatusText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textOn.primary,
    fontWeight: "700",
  },
  tagsSection: {
    gap: Spacing.sm,
    flexShrink: 0,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.md,
    fontWeight: "700",
  },
  tagLimitText: {
    color: Colors.text.muted,
    fontSize: Typography.sizes.xs,
  },
  selectedTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  selectedTag: {
    minHeight: 30,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: Colors.primarySubtle,
  },
  selectedTagText: {
    color: Colors.primary,
    fontSize: Typography.sizes.sm,
    fontWeight: "700",
  },
  tagInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  tagInput: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    color: Colors.text.primary,
    fontSize: Typography.sizes.base,
    backgroundColor: Colors.bg.page,
  },
  addTagButton: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
  },
  tagError: {
    color: Colors.danger,
    fontSize: Typography.sizes.xs,
  },
  suggestedTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  suggestedTag: {
    minHeight: 30,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border.default,
    paddingHorizontal: Spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.bg.page,
  },
  suggestedTagSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySubtle,
  },
  suggestedTagText: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.sm,
    fontWeight: "600",
  },
  suggestedTagTextSelected: {
    color: Colors.primary,
  },
  composerToolbar: {
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    paddingTop: 0,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  imageUploadButton: {
    flexShrink: 0,
    alignSelf: "flex-start",
    minHeight: 36,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: Colors.primarySubtle,
  },
  imageUploadButtonText: {
    color: Colors.primary,
    fontSize: Typography.sizes.sm,
    fontWeight: "700",
  },
});
