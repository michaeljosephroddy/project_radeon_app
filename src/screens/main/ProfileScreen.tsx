import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Avatar } from '../../components/Avatar';
import * as api from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';

interface Props {
    onBack: () => void;
}

export function ProfileScreen({ onBack }: Props) {
    const { user, refreshUser } = useAuth();

    const [firstName, setFirstName]   = useState(user?.first_name ?? '');
    const [lastName, setLastName]     = useState(user?.last_name ?? '');
    const [city, setCity]             = useState(user?.city ?? '');
    const [country, setCountry]       = useState(user?.country ?? '');
    const [soberSince, setSoberSince] = useState(user?.sober_since ?? '');

    const [allInterests, setAllInterests]         = useState<api.Interest[]>([]);
    const [selectedIds, setSelectedIds]           = useState<string[]>([]);
    const [interestsLoading, setInterestsLoading] = useState(true);

    const [saving, setSaving]               = useState(false);
    const [dirty, setDirty]                 = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [localAvatarUrl, setLocalAvatarUrl]   = useState(user?.avatar_url);

    useEffect(() => {
        api.getInterests()
            .then(interests => {
                setAllInterests(interests ?? []);
                const userNames = new Set(user?.interests ?? []);
                setSelectedIds(
                    (interests ?? []).filter(i => userNames.has(i.name)).map(i => i.id)
                );
            })
            .catch(() => { })
            .finally(() => setInterestsLoading(false));
    }, []);

    const mark = (setter: (v: string) => void) => (v: string) => {
        setter(v);
        setDirty(true);
    };

    const toggleInterest = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
        setDirty(true);
    };

    const handlePickAvatar = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('Permission required', 'Allow access to your photo library to upload an avatar.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (result.canceled) return;
        setUploadingAvatar(true);
        try {
            const { avatar_url } = await api.uploadAvatar(result.assets[0].uri);
            setLocalAvatarUrl(`${avatar_url}?t=${Date.now()}`);
            refreshUser().catch(() => {});
        } catch (e: unknown) {
            Alert.alert('Upload failed', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await Promise.all([
                api.updateMe({
                    first_name: firstName.trim(),
                    last_name: lastName.trim(),
                    city: city.trim() || undefined,
                    country: country.trim() || undefined,
                    sober_since: soberSince.trim() || undefined,
                }),
                api.setInterests(selectedIds),
            ]);
            await refreshUser();
            setDirty(false);
        } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setSaving(false);
        }
    };

    if (!user) return null;

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            {/* Header — fixed layout, never shifts */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.headerSide}>
                    <Text style={styles.backIcon}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile</Text>
                <View style={styles.headerSide}>
                    {dirty && (
                        <TouchableOpacity
                            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Text style={styles.saveBtnText}>Save</Text>
                            }
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                {/* Avatar */}
                <View style={styles.avatarSection}>
                    <TouchableOpacity onPress={handlePickAvatar} disabled={uploadingAvatar} style={styles.avatarWrap}>
                        <Avatar
                            firstName={firstName || user.first_name}
                            lastName={lastName || user.last_name}
                            avatarUrl={localAvatarUrl}
                            size={80}
                            fontSize={28}
                        />
                        <View style={styles.avatarEditBadge}>
                            {uploadingAvatar
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Text style={styles.avatarEditIcon}>✎</Text>
                            }
                        </View>
                    </TouchableOpacity>
                    <Text style={styles.avatarName}>{firstName} {lastName}</Text>
                    {city ? <Text style={styles.avatarSub}>{city}{country ? `, ${country}` : ''}</Text> : null}
                </View>

                {/* Name */}
                <Text style={styles.sectionLabel}>NAME</Text>
                <View style={styles.fieldGroup}>
                    <View style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>First name</Text>
                        <TextInput
                            style={styles.fieldInput}
                            value={firstName}
                            onChangeText={mark(setFirstName)}
                            placeholder="First name"
                            placeholderTextColor={Colors.light.textTertiary}
                        />
                    </View>
                    <View style={styles.fieldDivider} />
                    <View style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>Last name</Text>
                        <TextInput
                            style={styles.fieldInput}
                            value={lastName}
                            onChangeText={mark(setLastName)}
                            placeholder="Last name"
                            placeholderTextColor={Colors.light.textTertiary}
                        />
                    </View>
                </View>

                {/* Location */}
                <Text style={styles.sectionLabel}>LOCATION</Text>
                <View style={styles.fieldGroup}>
                    <View style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>City</Text>
                        <TextInput
                            style={styles.fieldInput}
                            value={city}
                            onChangeText={mark(setCity)}
                            placeholder="City"
                            placeholderTextColor={Colors.light.textTertiary}
                        />
                    </View>
                    <View style={styles.fieldDivider} />
                    <View style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>Country</Text>
                        <TextInput
                            style={styles.fieldInput}
                            value={country}
                            onChangeText={mark(setCountry)}
                            placeholder="Country"
                            placeholderTextColor={Colors.light.textTertiary}
                        />
                    </View>
                </View>

                {/* Sobriety */}
                <Text style={styles.sectionLabel}>SOBRIETY</Text>
                <View style={styles.fieldGroup}>
                    <View style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>Sober since</Text>
                        <TextInput
                            style={styles.fieldInput}
                            value={soberSince}
                            onChangeText={mark(setSoberSince)}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor={Colors.light.textTertiary}
                        />
                    </View>
                </View>

                {/* Interests */}
                <Text style={styles.sectionLabel}>INTERESTS</Text>
                {interestsLoading ? (
                    <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.sm }} />
                ) : (
                    <View style={styles.interestGrid}>
                        {allInterests.map(interest => {
                            const selected = selectedIds.includes(interest.id);
                            return (
                                <TouchableOpacity
                                    key={interest.id}
                                    style={[styles.interestPill, selected && styles.interestPillSelected]}
                                    onPress={() => toggleInterest(interest.id)}
                                >
                                    <Text style={[styles.interestPillText, selected && styles.interestPillTextSelected]}>
                                        {interest.name}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.light.background },
    scroll: { flex: 1 },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: Colors.light.border,
    },
    headerSide: {
        width: 64,
        alignItems: 'flex-end',
    },
    backIcon: { fontSize: 20, color: Colors.primary, width: 64 },
    headerTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: '500',
        color: Colors.light.textPrimary,
    },
    saveBtn: {
        backgroundColor: Colors.primary,
        borderRadius: Radii.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveBtnText: { color: '#fff', fontSize: Typography.sizes.sm, fontWeight: '600' },

    content: { padding: Spacing.md, paddingBottom: 40 },

    avatarSection: {
        alignItems: 'center',
        paddingVertical: Spacing.md,
        marginBottom: Spacing.sm,
        gap: 4,
    },
    avatarWrap: {
        position: 'relative',
    },
    avatarEditBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: Colors.light.background,
    },
    avatarEditIcon: {
        fontSize: 12,
        color: '#fff',
    },
    avatarName: {
        fontSize: Typography.sizes.lg,
        fontWeight: '600',
        color: Colors.light.textPrimary,
        marginTop: Spacing.sm,
    },
    avatarSub: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
    },

    sectionLabel: {
        fontSize: Typography.sizes.xs,
        fontWeight: '500',
        color: Colors.light.textTertiary,
        letterSpacing: 0.7,
        marginBottom: Spacing.sm,
        marginTop: Spacing.md,
    },
    fieldGroup: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.md,
        overflow: 'hidden',
    },
    fieldRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: 13,
        gap: Spacing.sm,
    },
    fieldDivider: {
        height: 0.5,
        backgroundColor: Colors.light.border,
        marginLeft: Spacing.md,
    },
    fieldLabel: {
        width: 90,
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
    },
    fieldInput: {
        flex: 1,
        fontSize: Typography.sizes.base,
        color: Colors.light.textPrimary,
        textAlign: 'right',
        padding: 0,
    },

    interestGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    interestPill: {
        borderRadius: Radii.full,
        borderWidth: 1,
        borderColor: Colors.light.border,
        paddingHorizontal: 14,
        paddingVertical: 7,
        backgroundColor: Colors.light.backgroundSecondary,
    },
    interestPillSelected: {
        backgroundColor: Colors.primaryLight,
        borderColor: Colors.primary,
    },
    interestPillText: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
    },
    interestPillTextSelected: {
        color: Colors.primaryDark,
        fontWeight: '500',
    },
});
