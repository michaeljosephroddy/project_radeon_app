import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import * as api from "../../../api/client";
import { Colors, Spacing } from "../../../theme";
import { useAuth } from "../../../hooks/useAuth";
import {
  DraftPayload,
  useCreatePostDrafts,
} from "../../../hooks/useCreatePostDrafts";
import { useGradualKeyboardInset } from "../../../hooks/useGradualKeyboardInset";
import { useRecentTags } from "../../../hooks/useRecentTags";
import { CREATE_SURFACE_HEADER_HEIGHT } from "../../../components/ui/CreateSurfaceHeader";
import { ComposerCanvas } from "./ComposerCanvas";
import { ComposerToolbar } from "./ComposerToolbar";
import { CreatePostHeader } from "./CreatePostHeader";
import { DraftsSheet } from "./DraftsSheet";
import { ImagePreviewSource } from "./ImagePreviewCard";
import {
  TagCategory,
  TagPickerPanel,
} from "./TagPickerPanel";

export interface PostComposerSubmitInput {
  body?: string;
  images: api.PostImage[];
  tags: string[];
}

interface PostComposerProps {
  title?: string;
  isSubmitting: boolean;
  tagsEnabled?: boolean;
  draftsEnabled?: boolean;
  onBack: () => void;
  onSubmit: (input: PostComposerSubmitInput) => Promise<void>;
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

interface TagValidationResult {
  ok: boolean;
  tag: string;
  error: string | null;
}

const TAG_CATEGORIES: TagCategory[] = [
  { label: "Status", tags: ["check-in", "milestone", "day1"] },
  { label: "Asking for", tags: ["support", "question", "craving"] },
  { label: "Sharing", tags: ["gratitude", "win"] },
];
const MAX_POST_TAGS = 5;
const MAX_BODY_LENGTH = 500;
const TAG_PATTERN = /^[a-z0-9_-]+$/;

export function PostComposer({
  title,
  isSubmitting,
  tagsEnabled = true,
  draftsEnabled = true,
  onBack,
  onSubmit,
}: PostComposerProps): React.ReactElement | null {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<ComposerImageState | null>(
    null,
  );
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
  const [isDraftsOpen, setIsDraftsOpen] = useState(false);
  const [draftSessionId, setDraftSessionId] = useState(() => createDraftId());
  const uploadPromiseRef = useRef<Promise<api.PostImage> | null>(null);
  const bottomSafeSpace = Math.max(insets.bottom, Spacing.sm);
  const { height: keyboardInsetHeight } = useGradualKeyboardInset({
    closedHeight: bottomSafeSpace,
    openedOffset: Spacing.sm,
  });
  const keyboardSpacerStyle = useAnimatedStyle(
    (): { height: number } => ({
      height: keyboardInsetHeight.value,
    }),
  );

  const userId = user?.id ?? null;
  const {
    drafts,
    isHydrated: draftsHydrated,
    saveCurrent,
    commitCurrent,
    removeDraft,
    loadDraft,
    clearCurrent,
  } = useCreatePostDrafts(userId);
  const { recentTags, recordTag } = useRecentTags(userId);
  const activeTags = tagsEnabled ? tags : [];

  const draftPayload = useMemo<DraftPayload>(
    () => ({
      body,
      tags: activeTags,
      image: selectedImage ? selectedImage.localImage : null,
    }),
    [activeTags, body, selectedImage],
  );

  const hasContent =
    body.trim().length > 0 || activeTags.length > 0 || selectedImage !== null;
  const canSubmit =
    (body.trim().length > 0 || selectedImage !== null) &&
    body.length <= MAX_BODY_LENGTH &&
    !isSubmitting;

  useEffect(() => {
    if (!draftsEnabled) return;
    if (!draftsHydrated) return;
    saveCurrent(draftSessionId, draftPayload);
  }, [draftPayload, draftSessionId, draftsEnabled, draftsHydrated, saveCurrent]);

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

  const handleRetryImageUpload = useCallback((): void => {
    setSelectedImage((current) => {
      if (!current) return current;
      beginImageUpload(current.localImage).catch(() => {});
      return { ...current, status: "uploading" };
    });
  }, [beginImageUpload]);

  const addTag = useCallback(
    (rawTag: string): void => {
      if (!tagsEnabled) return;
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
        triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
        recordTag(validation.tag);
        return [...current, validation.tag];
      });
      setCustomTag("");
      setTagError(null);
    },
    [recordTag, tagsEnabled],
  );

  const removeTag = useCallback((tag: string): void => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setTags((current) => current.filter((currentTag) => currentTag !== tag));
    setTagError(null);
  }, []);

  const toggleTag = useCallback(
    (tag: string): void => {
      if (tags.includes(tag)) {
        removeTag(tag);
      } else {
        addTag(tag);
      }
    },
    [addTag, removeTag, tags],
  );

  const handleBack = useCallback((): void => {
    if (!draftsEnabled) {
      onBack();
      return;
    }

    if (!hasContent) {
      void clearCurrent(draftSessionId).finally(onBack);
      return;
    }

    Alert.alert("Save draft?", "Keep this post in drafts or discard it?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          void clearCurrent(draftSessionId).finally(onBack);
        },
      },
      {
        text: "Save",
        onPress: () => {
          triggerHaptic(Haptics.ImpactFeedbackStyle.Soft);
          void commitCurrent(draftSessionId, draftPayload).finally(onBack);
        },
      },
    ]);
  }, [
    clearCurrent,
    commitCurrent,
    draftPayload,
    draftSessionId,
    draftsEnabled,
    hasContent,
    onBack,
  ]);

  const handleLoadDraft = useCallback(
    (draftId: string): void => {
      const draft = loadDraft(draftId);
      if (!draft) return;

      uploadPromiseRef.current = null;
      setBody(draft.body);
      setTags(tagsEnabled ? draft.tags : []);
      setCustomTag("");
      setTagError(null);
      setIsDraftsOpen(false);
      setIsTagPickerOpen(false);
      setDraftSessionId(createDraftId());

      if (draft.image) {
        const image = {
          uri: draft.image.uri,
          mimeType: draft.image.mimeType,
          fileName: draft.image.fileName,
          width: draft.image.width,
          height: draft.image.height,
        };
        setSelectedImage({ localImage: image, status: "uploading" });
        beginImageUpload(image).catch(() => {});
      } else {
        setSelectedImage(null);
      }

      void removeDraft(draftId);
    },
    [beginImageUpload, loadDraft, removeDraft, tagsEnabled],
  );

  const handleDeleteDraft = useCallback(
    (draftId: string): void => {
      void removeDraft(draftId);
    },
    [removeDraft],
  );

  const handleSubmit = useCallback((): void => {
    if (!canSubmit) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    const trimmedBody = body.trim();
    const currentImage = selectedImage;

    void (async () => {
      try {
        let images: api.PostImage[] = [];
        if (currentImage) {
          if (currentImage.uploadedImage) {
            images = [currentImage.uploadedImage];
          } else if (
            currentImage.status === "uploading" &&
            uploadPromiseRef.current
          ) {
            images = [await uploadPromiseRef.current];
          } else {
            images = [await beginImageUpload(currentImage.localImage)];
          }
        }

        await onSubmit({
          body: trimmedBody || undefined,
          images,
          tags: activeTags,
        });
        if (draftsEnabled) {
          await clearCurrent(draftSessionId);
        }
        onBack();
      } catch (e: unknown) {
        Alert.alert(
          "Error",
          e instanceof Error ? e.message : "Something went wrong.",
        );
      }
    })();
  }, [
    activeTags,
    beginImageUpload,
    body,
    canSubmit,
    clearCurrent,
    draftSessionId,
    draftsEnabled,
    onBack,
    onSubmit,
    selectedImage,
  ]);

  if (!user) return null;

  const previewImage: ImagePreviewSource | null = selectedImage
    ? {
        uri: selectedImage.localImage.uri,
        width: selectedImage.localImage.width,
        height: selectedImage.localImage.height,
      }
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.bodyWrap}>
        <ComposerCanvas
          body={body}
          image={previewImage}
          imageStatus={selectedImage?.status ?? null}
          tags={activeTags}
          user={user}
          maxBodyLength={MAX_BODY_LENGTH}
          onBodyChange={setBody}
          onRemoveImage={handleRemoveImage}
          onRemoveTag={removeTag}
          onRetryImage={handleRetryImageUpload}
        />

        {isTagPickerOpen && tagsEnabled ? (
          <TagPickerPanel
            categories={TAG_CATEGORIES}
            customTag={customTag}
            error={tagError}
            recentTags={recentTags}
            selectedTags={activeTags}
            tagCount={activeTags.length}
            maxTags={MAX_POST_TAGS}
            onAddTag={addTag}
            onChangeCustomTag={setCustomTag}
            onClose={() => setIsTagPickerOpen(false)}
            onRemoveTag={removeTag}
            onToggleTag={toggleTag}
          />
        ) : (
          <ComposerToolbar
            hasImage={selectedImage !== null}
            tagCount={activeTags.length}
            maxTags={MAX_POST_TAGS}
            tagsEnabled={tagsEnabled}
            onPickImage={handlePickImage}
            onOpenTagPicker={() => setIsTagPickerOpen(true)}
          />
        )}

        <Animated.View style={[styles.keyboardSpacer, keyboardSpacerStyle]} />
      </View>

      <CreatePostHeader
        bodyLength={body.length}
        canSubmit={canSubmit}
        draftCount={draftsEnabled ? drafts.length : 0}
        isSubmitting={isSubmitting}
        maxLength={MAX_BODY_LENGTH}
        postType={selectedImage ? "photo" : "text"}
        title={title}
        onBack={handleBack}
        onOpenDrafts={() => {
          if (draftsEnabled) {
            setIsDraftsOpen(true);
          }
        }}
        onSubmit={handleSubmit}
      />

      {draftsEnabled && isDraftsOpen ? (
        <DraftsSheet
          drafts={drafts}
          onClose={() => setIsDraftsOpen(false)}
          onDeleteDraft={handleDeleteDraft}
          onLoadDraft={handleLoadDraft}
        />
      ) : null}
    </View>
  );
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

function createDraftId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function triggerHaptic(style: Haptics.ImpactFeedbackStyle): void {
  try {
    Haptics.impactAsync(style).catch(() => {});
  } catch {
    /* Haptics are optional and may be unavailable in stale Android dev builds. */
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.page,
  },
  bodyWrap: {
    flex: 1,
    paddingTop: CREATE_SURFACE_HEADER_HEIGHT,
  },
  keyboardSpacer: {
    flexShrink: 0,
    backgroundColor: Colors.bg.page,
  },
});
