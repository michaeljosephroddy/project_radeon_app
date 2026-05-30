import { appAlert } from '@/components/ui/appAlert';
import React, {
  useCallback,
  useRef,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import * as api from "../../../api/client";
import { Colors, Spacing } from "../../../theme";
import { useAuth } from "../../../hooks/useAuth";
import { CREATE_SURFACE_HEADER_HEIGHT } from "../../../components/ui/CreateSurfaceHeader";
import { KEYBOARD_STICKY_FOOTER_KEYBOARD_GAP } from "../../../components/ui/KeyboardStickyFooter";
import { COMPOSER_CANVAS_BOTTOM_RESERVE, ComposerCanvas } from "./ComposerCanvas";
import { ComposerToolbar } from "./ComposerToolbar";
import { CreatePostHeader } from "./CreatePostHeader";
import { ImagePreviewSource } from "./ImagePreviewCard";

export interface PostComposerSubmitInput {
  body?: string;
  images: api.PostImage[];
  tags: string[];
}

interface PostComposerProps {
  title?: string;
  isSubmitting: boolean;
  closeOnSubmit?: boolean;
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

const MAX_BODY_LENGTH = 500;

export function PostComposer({
  title,
  isSubmitting,
  closeOnSubmit = true,
  onBack,
  onSubmit,
}: PostComposerProps): React.ReactElement | null {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [body, setBody] = useState("");
  const [selectedImage, setSelectedImage] = useState<ComposerImageState | null>(
    null,
  );
  const uploadPromiseRef = useRef<Promise<api.PostImage> | null>(null);
  const bottomSafeSpace = Math.max(insets.bottom, Spacing.sm);

  const hasContent =
    body.trim().length > 0 || selectedImage !== null;
  const canSubmit =
    (body.trim().length > 0 || selectedImage !== null) &&
    body.length <= MAX_BODY_LENGTH &&
    !isSubmitting;

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
      appAlert.alert(
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

  const handleBack = useCallback((): void => {
    if (!hasContent) {
      onBack();
      return;
    }

    appAlert.alert("Discard post?", "Your current post will be lost.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: onBack,
      },
    ]);
  }, [hasContent, onBack]);

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
          tags: [],
        });
        if (closeOnSubmit) onBack();
      } catch (e: unknown) {
        appAlert.alert(
          "Error",
          e instanceof Error ? e.message : "Something went wrong.",
        );
      }
    })();
  }, [
    beginImageUpload,
    body,
    canSubmit,
    closeOnSubmit,
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
          bottomInset={COMPOSER_CANVAS_BOTTOM_RESERVE}
          image={previewImage}
          imageStatus={selectedImage?.status ?? null}
          maxBodyLength={MAX_BODY_LENGTH}
          onBodyChange={setBody}
          onRemoveImage={handleRemoveImage}
          onRetryImage={handleRetryImageUpload}
        />

        <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom - KEYBOARD_STICKY_FOOTER_KEYBOARD_GAP }}>
          <View style={[styles.footerSurface, { paddingBottom: bottomSafeSpace }]}>
            <ComposerToolbar
              hasImage={selectedImage !== null}
              onPickImage={handlePickImage}
            />
          </View>
        </KeyboardStickyView>
      </View>

      <CreatePostHeader
        bodyLength={body.length}
        canSubmit={canSubmit}
        isSubmitting={isSubmitting}
        maxLength={MAX_BODY_LENGTH}
        postType={selectedImage ? "photo" : "text"}
        title={title}
        onBack={handleBack}
        onSubmit={handleSubmit}
      />
    </View>
  );
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
  footerSurface: {
    backgroundColor: Colors.bg.page,
  },
});
