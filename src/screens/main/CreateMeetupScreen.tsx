import React, { useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/client';
import { MeetupForm } from '../../components/events/MeetupForm';
import { MeetupFormValues } from '../../components/events/MeetupFormState';
import { CREATE_SURFACE_HEADER_HEIGHT, CreateSurfaceHeader } from '../../components/ui/CreateSurfaceHeader';
import { useAuth } from '../../hooks/useAuth';
import { useFriends } from '../../hooks/queries/useFriends';
import { useMeetupCategories } from '../../hooks/queries/useMeetups';
import { Colors, Spacing } from '../../theme';
import { MeetupReviewScreen } from './MeetupReviewScreen';

interface CreateMeetupScreenProps {
    onBack: () => void;
    onCreated: (meetup: api.Meetup) => void;
}

type CreateStage = 'form' | 'review';

function formatDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatTimeInput(date: Date): string {
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    return `${hours}:${minutes}`;
}

function defaultFormValues(user: api.User | null): MeetupFormValues {
    const start = new Date();
    start.setDate(start.getDate() + 7);
    start.setHours(19, 0, 0, 0);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    return {
        title: '',
        description: '',
        category_slug: '',
        co_host_ids: [],
        event_type: 'in_person',
        visibility: 'public',
        city: user?.current_city ?? user?.city ?? '',
        country: user?.country ?? '',
        venue_name: '',
        address_line_1: '',
        address_line_2: '',
        how_to_find_us: '',
        online_url: '',
        cover_image_url: '',
        starts_on: formatDateInput(start),
        starts_at: formatTimeInput(start),
        ends_on: formatDateInput(end),
        ends_at: formatTimeInput(end),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        lat: '',
        lng: '',
        capacity: '',
        waitlist_enabled: true,
    };
}

function buildStartsAt(dateInput: string, timeInput: string): string | null {
    const date = dateInput.trim();
    const time = timeInput.trim();
    if (!date || !time) return null;
    const parsed = new Date(`${date}T${time}:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
}

function parseOptionalCoordinate(
    value: string,
    label: 'Latitude' | 'Longitude',
    min: number,
    max: number,
): { value: number | null } | { error: string } {
    const trimmed = value.trim();
    if (!trimmed) {
        return { value: null };
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
        return { error: `${label} must be a valid number.` };
    }
    if (parsed < min || parsed > max) {
        return { error: `${label} must be between ${min} and ${max}.` };
    }

    return { value: parsed };
}

function validateMeetupForm(form: MeetupFormValues, status: Extract<api.MeetupStatus, 'draft' | 'published'>): { error: string } | { values: api.MeetupUpsertInput } {
    const starts_at = buildStartsAt(form.starts_on, form.starts_at);
    const ends_at = buildStartsAt(form.ends_on, form.ends_at);
    if (!form.title.trim()) return { error: 'Title is required.' };
    if (!form.category_slug) return { error: 'Choose a category.' };
    if (!form.city.trim()) return { error: 'City is required.' };
    if (!starts_at) return { error: 'Enter a valid start date and time.' };
    if (form.ends_on.trim() || form.ends_at.trim()) {
        if (!ends_at) return { error: 'Enter a valid end date and time.' };
        if (new Date(ends_at) <= new Date(starts_at)) return { error: 'End time must be after the start time.' };
    }
    if (form.event_type === 'online' && !form.online_url.trim()) return { error: 'Online events need a link.' };
    if (form.capacity.trim()) {
        const capacity = Number(form.capacity);
        if (!Number.isFinite(capacity) || capacity < 1) {
            return { error: 'Capacity must be empty or greater than 0.' };
        }
    }
    const parsedLat = parseOptionalCoordinate(form.lat, 'Latitude', -90, 90);
    if ('error' in parsedLat) return { error: parsedLat.error };
    const parsedLng = parseOptionalCoordinate(form.lng, 'Longitude', -180, 180);
    if ('error' in parsedLng) return { error: parsedLng.error };
    if ((parsedLat.value === null) !== (parsedLng.value === null)) {
        return { error: 'Latitude and longitude must be provided together.' };
    }

    return {
        values: {
            title: form.title.trim(),
            description: form.description.trim() || null,
            category_slug: form.category_slug,
            co_host_ids: form.co_host_ids,
            event_type: form.event_type,
            status,
            visibility: form.visibility,
            city: form.city.trim(),
            country: form.country.trim() || null,
            venue_name: form.venue_name.trim() || null,
            address_line_1: form.address_line_1.trim() || null,
            address_line_2: form.address_line_2.trim() || null,
            how_to_find_us: form.how_to_find_us.trim() || null,
            online_url: form.online_url.trim() || null,
            cover_image_url: form.cover_image_url.trim() || null,
            starts_at,
            ends_at: ends_at ?? null,
            timezone: form.timezone.trim() || 'UTC',
            lat: parsedLat.value,
            lng: parsedLng.value,
            capacity: form.capacity.trim() ? Number(form.capacity) : null,
            waitlist_enabled: form.waitlist_enabled,
        },
    };
}

export function CreateMeetupScreen({
    onBack,
    onCreated,
}: CreateMeetupScreenProps): React.ReactElement | null {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const coverUploadRef = useRef<Promise<string> | null>(null);
    const coverUploadTokenRef = useRef(0);
    const [formValues, setFormValues] = useState<MeetupFormValues>(() => defaultFormValues(user));
    const [createStage, setCreateStage] = useState<CreateStage>('form');
    const [submitting, setSubmitting] = useState(false);
    const [uploadingCover, setUploadingCover] = useState(false);
    const [localCoverPreviewUri, setLocalCoverPreviewUri] = useState<string | null>(null);
    const [formError, setFormError] = useState('');

    const categoriesQuery = useMeetupCategories(true);
    const friendsQuery = useFriends(true, 100);
    const categories = categoriesQuery.data ?? [];
    const friends = friendsQuery.data ?? [];
    const activeCoverPreviewUri = localCoverPreviewUri ?? formValues.cover_image_url;
    const formSecondaryActionLabel = 'Save draft';
    const formPrimaryActionLabel = 'Publish event';

    const handleChangeFormValue = (key: keyof MeetupFormValues, value: string | boolean | string[]) => {
        setFormValues((current) => ({ ...current, [key]: value } as MeetupFormValues));
        if (formError) setFormError('');
    };

    const handlePickCoverImage = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('Permission required', 'Allow access to your photo library to upload a cover image.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.85,
        });
        if (result.canceled) return;

        const asset = result.assets[0];
        const previousPreview = localCoverPreviewUri;
        const previousCoverURL = formValues.cover_image_url;
        setLocalCoverPreviewUri(asset.uri);
        setUploadingCover(true);
        if (formError) setFormError('');
        const uploadToken = coverUploadTokenRef.current + 1;
        coverUploadTokenRef.current = uploadToken;
        const uploadPromise = api.uploadMeetupCoverImage({
            uri: asset.uri,
            mimeType: asset.mimeType ?? 'image/jpeg',
            fileName: asset.fileName ?? 'meetup-cover.jpg',
        }).then(({ cover_image_url }) => cover_image_url);
        coverUploadRef.current = uploadPromise;
        try {
            const cover_image_url = await uploadPromise;
            if (coverUploadTokenRef.current !== uploadToken) return;
            setFormValues((current) => ({ ...current, cover_image_url }));
            setLocalCoverPreviewUri(null);
        } catch (error: unknown) {
            if (coverUploadTokenRef.current !== uploadToken) return;
            setLocalCoverPreviewUri(previousPreview);
            setFormValues((current) => ({ ...current, cover_image_url: previousCoverURL }));
            Alert.alert('Upload failed', error instanceof Error ? error.message : 'Something went wrong.');
        } finally {
            if (coverUploadTokenRef.current === uploadToken) {
                coverUploadRef.current = null;
                setUploadingCover(false);
            }
        }
    };

    const handleRemoveCoverImage = () => {
        coverUploadTokenRef.current += 1;
        coverUploadRef.current = null;
        setUploadingCover(false);
        setLocalCoverPreviewUri(null);
        setFormValues((current) => ({ ...current, cover_image_url: '' }));
    };

    const resolveCoverImageURLForSubmit = async (
        pendingCoverUpload: Promise<string> | null,
        fallbackCoverImageURL: string,
    ): Promise<string | null> => {
        if (!pendingCoverUpload) {
            return fallbackCoverImageURL.trim() || null;
        }

        try {
            const coverImageURL = await pendingCoverUpload;
            return coverImageURL.trim() || null;
        } catch {
            throw new Error('Cover image upload failed. Choose another image or try again.');
        }
    };

    const submitMeetup = async (status: Extract<api.MeetupStatus, 'draft' | 'published'>) => {
        if (!user) {
            setFormError('Sign in before saving this event.');
            return;
        }

        const validated = validateMeetupForm(formValues, status);
        if ('error' in validated) {
            setFormError(validated.error);
            return;
        }

        const pendingCoverUpload = coverUploadRef.current;
        const fallbackCoverImageURL = formValues.cover_image_url;
        setSubmitting(true);
        if (pendingCoverUpload) {
            coverUploadTokenRef.current += 1;
            coverUploadRef.current = null;
            setUploadingCover(false);
        }

        try {
            const coverImageURL = await resolveCoverImageURLForSubmit(pendingCoverUpload, fallbackCoverImageURL);
            const savedMeetup = await api.createMeetup({
                ...validated.values,
                cover_image_url: coverImageURL,
            });
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['meetups'] }),
                queryClient.invalidateQueries({ queryKey: ['my-meetups'] }),
            ]);
            onCreated(savedMeetup);
        } catch (error: unknown) {
            Alert.alert('Error', error instanceof Error ? error.message : 'Unable to save this event right now.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!user) return null;

    return (
        <View style={styles.container}>
            {createStage === 'form' ? (
                <>
                    <CreateSurfaceHeader onBack={onBack} title="Create meetup" />
                    <MeetupForm
                        title="Build a polished meetup your community will actually want to join."
                        values={formValues}
                        categories={categories}
                        friends={friends}
                        mode="create"
                        loading={submitting}
                        coverUploading={uploadingCover}
                        coverPreviewUri={activeCoverPreviewUri}
                        error={formError}
                        primaryActionLabel="Review"
                        primaryActionVariant="success"
                        secondaryActionLabel={formSecondaryActionLabel}
                        onChange={handleChangeFormValue}
                        onPickCover={handlePickCoverImage}
                        onRemoveCover={handleRemoveCoverImage}
                        onPrimaryAction={() => setCreateStage('review')}
                        onSecondaryAction={() => void submitMeetup('draft')}
                        contentStyle={styles.formContent}
                    />
                </>
            ) : (
                <MeetupReviewScreen
                    title="Review everything before this event goes live."
                    values={formValues}
                    categories={categories}
                    friends={friends}
                    coverPreviewUri={activeCoverPreviewUri}
                    loading={submitting}
                    error={formError}
                    primaryActionLabel={formPrimaryActionLabel}
                    primaryActionVariant="success"
                    secondaryActionLabel={formSecondaryActionLabel}
                    onBack={() => setCreateStage('form')}
                    onPrimaryAction={() => void submitMeetup('published')}
                    onSecondaryAction={() => void submitMeetup('draft')}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    formContent: {
        paddingTop: CREATE_SURFACE_HEADER_HEIGHT + Spacing.sm,
    },
});
