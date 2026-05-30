import { appAlert } from '@/components/ui/appAlert';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Avatar } from '../../components/Avatar';
import { OnboardingProgressHeader } from '../../components/onboarding/OnboardingProgressHeader';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { useAuth } from '../../hooks/useAuth';
import * as api from '../../api/client';
import { AvatarSizes, Colors, IconSizes, Typography, Spacing, TextStyles } from '../../theme';
import type { OnboardingStepProps } from '../../navigation/OnboardingNavigator';

type PhotoStepProps = OnboardingStepProps;

export function PhotoStep({ onNext, onBack, dotIndex, dotTotal }: PhotoStepProps) {
    const { user, refreshUser } = useAuth();
    const [uploading, setUploading] = useState(false);
    const [localAvatarUrl, setLocalAvatarUrl] = useState(user?.avatar_url);

    const handlePickPhoto = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            appAlert.alert('Permission required', 'Allow access to your photo library to upload a photo.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (result.canceled) return;

        const localUri = result.assets[0].uri;
        const previousUrl = localAvatarUrl;
        setLocalAvatarUrl(localUri);
        setUploading(true);
        try {
            await api.uploadAvatar(localUri);
            await refreshUser();
        } catch (e: unknown) {
            setLocalAvatarUrl(previousUrl);
            appAlert.alert('Upload failed', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <StatusBar style="light" />
            <OnboardingProgressHeader dotIndex={dotIndex} dotTotal={dotTotal} onBack={onBack} />

            <View style={styles.inner}>
                <Text style={styles.title}>Add a photo</Text>
                <Text style={styles.subtitle}>Help people recognise you in the community.</Text>

                <TouchableOpacity style={styles.avatarWrap} onPress={handlePickPhoto} disabled={uploading}>
                    {localAvatarUrl ? (
                        <Image source={{ uri: localAvatarUrl }} style={styles.avatarImage} />
                    ) : (
                        <Avatar
                            username={user?.username ?? ''}
                            size={AvatarSizes.onboarding}
                            fontSize={TextStyles.displayTitle.fontSize}
                        />
                    )}
                    <View style={styles.cameraButton}>
                        {uploading
                            ? <ActivityIndicator size="small" color={Colors.textOn.primary} />
                            : <Ionicons name="camera" size={IconSizes.row} color={Colors.textOn.primary} />
                        }
                    </View>
                </TouchableOpacity>

                <Text style={styles.hint}>Tap to choose a photo</Text>
            </View>

            <View style={styles.footer}>
                <PrimaryButton label="Continue" onPress={onNext} disabled={!localAvatarUrl || uploading} />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.page },
    topBar: {
        alignItems: 'center',
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    dots: { flexDirection: 'row', gap: Spacing.sm },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.border.default,
    },
    dotActive: { backgroundColor: Colors.primary },
    inner: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.xxl,
    },
    title: {
        fontSize: Typography.sizes.xxl,
        fontWeight: '600',
        color: Colors.text.primary,
        marginBottom: Spacing.sm,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: Typography.sizes.lg,
        color: Colors.text.secondary,
        textAlign: 'center',
        marginBottom: Spacing.xxl,
    },
    avatarWrap: {
        position: 'relative',
        marginBottom: Spacing.md,
    },
    avatarImage: {
        width: 120,
        height: 120,
        borderRadius: 60,
    },
    cameraButton: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    hint: {
        fontSize: Typography.sizes.base,
        color: Colors.text.muted,
    },
    footer: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.lg,
    },
});
