import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { appAlert } from '../../../components/ui/appAlert';
import { DatingProfileEditorScreen } from '../../../components/discover/DatingProfileEditorScreen';
import * as api from '../../../api/client';
import {
    useDatingProfile,
    useDeleteDatingProfilePhoto,
    useReorderDatingProfilePhotos,
    useUpdateDatingProfile,
    useUploadDatingProfilePhoto,
} from '../../../hooks/queries/useDatingProfile';
import type { RootStackParamList } from '../../../navigation/types';

const OPTIMISTIC_DATING_PHOTO_ID_PREFIX = 'optimistic-dating-photo-';

function createOptimisticDatingPhotoId(): string {
    return `${OPTIMISTIC_DATING_PHOTO_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function findUploadedDatingPhoto(profile: api.DatingProfile, previousPhotoIds: Set<string>, optimisticPosition: number): api.DatingPhoto | null {
    return profile.photos.find((photo) => !previousPhotoIds.has(photo.id))
        ?? profile.photos.find((photo) => photo.position === optimisticPosition)
        ?? profile.photos[profile.photos.length - 1]
        ?? null;
}

export function DatingProfileEditorRouteScreen(): React.ReactElement {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const profileQuery = useDatingProfile(true);
    const updateMutation = useUpdateDatingProfile();
    const uploadMutation = useUploadDatingProfilePhoto();
    const deletePhotoMutation = useDeleteDatingProfilePhoto();
    const reorderPhotosMutation = useReorderDatingProfilePhotos();
    const [deletingPhotoIds, setDeletingPhotoIds] = useState<Set<string>>(new Set());
    const [photoPreviewUris, setPhotoPreviewUris] = useState<Record<string, string>>({});
    const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
    const saveSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (saveSuccessTimerRef.current) {
            clearTimeout(saveSuccessTimerRef.current);
        }
    }, []);

    const showSaveSuccess = useCallback((message: string): void => {
        if (saveSuccessTimerRef.current) {
            clearTimeout(saveSuccessTimerRef.current);
        }
        setSaveSuccessMessage(message);
        saveSuccessTimerRef.current = setTimeout(() => {
            setSaveSuccessMessage(null);
            saveSuccessTimerRef.current = null;
        }, 3500);
    }, []);

    const logDatingEvent = useCallback((event: api.DatingEventInput): void => {
        void api.logDatingEvents([{ ...event, event_at: new Date().toISOString() }]).catch(() => {});
    }, []);

    const handleSave = useCallback((input: api.UpdateDatingProfileInput): void => {
        setSaveSuccessMessage(null);
        updateMutation.mutate(input, {
            onSuccess: (profile) => {
                if (input.complete && profile.completed_at) {
                    logDatingEvent({ event_type: 'setup_completed' });
                    showSaveSuccess('Dating profile complete. You are now visible in Dating.');
                    return;
                }
                showSaveSuccess(input.paused === undefined ? 'Dating profile saved.' : 'Dating profile updated.');
            },
            onError: (error: unknown) => {
                appAlert.alert('Could not save Dating profile', error instanceof Error ? error.message : 'Please try again.');
            },
        });
    }, [logDatingEvent, showSaveSuccess, updateMutation]);

    const handlePickPhoto = useCallback(async (): Promise<void> => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            appAlert.alert('Permission required', 'Allow photo library access to add a Dating photo.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
        });
        if (result.canceled || !result.assets[0]) return;
        const asset = result.assets[0];
        const currentPhotos = profileQuery.data?.photos ?? [];
        const previousPhotoIds = new Set(currentPhotos.map((photo) => photo.id));
        const optimisticPhotoId = createOptimisticDatingPhotoId();
        const optimisticPosition = currentPhotos.reduce((max, photo) => Math.max(max, photo.position), -1) + 1;

        uploadMutation.mutate({
            uri: asset.uri,
            mimeType: asset.mimeType ?? 'image/jpeg',
            fileName: asset.fileName ?? 'dating-photo.jpg',
            width: asset.width,
            height: asset.height,
            optimisticPhotoId,
        }, {
            onError: (error: unknown) => {
                appAlert.alert('Could not upload photo', error instanceof Error ? error.message : 'Please try again.');
            },
            onSuccess: (profile) => {
                const uploadedPhoto = findUploadedDatingPhoto(profile, previousPhotoIds, optimisticPosition);
                if (!uploadedPhoto) return;
                setPhotoPreviewUris((current) => ({
                    ...current,
                    [uploadedPhoto.id]: asset.uri,
                }));
                void Image.prefetch(uploadedPhoto.image_url).finally(() => {
                    setPhotoPreviewUris((current) => {
                        const next = { ...current };
                        delete next[uploadedPhoto.id];
                        return next;
                    });
                });
            },
        });
    }, [profileQuery.data?.photos, uploadMutation]);

    const handleDeletePhoto = useCallback((photoId: string): void => {
        setDeletingPhotoIds((current) => new Set([...current, photoId]));
        deletePhotoMutation.mutate(photoId, {
            onError: (error: unknown) => {
                appAlert.alert('Could not remove photo', error instanceof Error ? error.message : 'Please try again.');
            },
            onSettled: () => {
                setDeletingPhotoIds((current) => {
                    const next = new Set(current);
                    next.delete(photoId);
                    return next;
                });
            },
        });
    }, [deletePhotoMutation]);

    const handleReorderPhotos = useCallback((photoIds: string[]): void => {
        reorderPhotosMutation.mutate(photoIds, {
            onError: (error: unknown) => {
                appAlert.alert('Could not reorder photos', error instanceof Error ? error.message : 'Please try again.');
            },
        });
    }, [reorderPhotosMutation]);

    return (
        <DatingProfileEditorScreen
            profile={profileQuery.data ?? null}
            loading={profileQuery.isLoading}
            saving={updateMutation.isPending}
            photoPreviewUris={photoPreviewUris}
            reorderingPhotos={reorderPhotosMutation.isPending}
            deletingPhotoIds={deletingPhotoIds}
            saveSuccessMessage={saveSuccessMessage}
            onBack={() => navigation.goBack()}
            onSave={handleSave}
            onPickPhoto={() => void handlePickPhoto()}
            onDeletePhoto={handleDeletePhoto}
            onReorderPhotos={handleReorderPhotos}
        />
    );
}
