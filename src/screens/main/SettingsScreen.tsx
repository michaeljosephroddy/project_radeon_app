import React, { useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import * as api from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';

interface SettingsScreenProps {
    onBack: () => void;
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
    const { user } = useAuth();
    const [discoveryRadius, setDiscoveryRadius] = useState(user?.discovery_radius_km ?? 50);

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.headerSide}>
                    <Text style={styles.backIcon}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={styles.headerSide} />
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                <Text style={styles.sectionLabel}>DISCOVERY</Text>
                <View style={styles.fieldGroup}>
                    <View style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>Radius</Text>
                        <Text style={styles.radiusValue}>{discoveryRadius} km</Text>
                    </View>
                    <View style={styles.sliderRow}>
                        <Slider
                            style={styles.slider}
                            minimumValue={10}
                            maximumValue={300}
                            step={10}
                            value={discoveryRadius}
                            onValueChange={setDiscoveryRadius}
                            onSlidingComplete={async (value: number) => {
                                try {
                                    await api.updateMe({ discovery_radius_km: value });
                                } catch { }
                            }}
                            minimumTrackTintColor={Colors.primary}
                            maximumTrackTintColor={Colors.light.border}
                            thumbTintColor={Colors.primary}
                        />
                    </View>
                    <View style={styles.sliderLabels}>
                        <Text style={styles.sliderLabelText}>10 km</Text>
                        <Text style={styles.sliderLabelText}>300 km</Text>
                    </View>
                </View>
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

    content: { padding: Spacing.md, paddingBottom: 40 },

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
    fieldLabel: {
        width: 90,
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
    },
    radiusValue: {
        flex: 1,
        fontSize: Typography.sizes.base,
        color: Colors.light.textPrimary,
        textAlign: 'right',
    },
    sliderRow: {
        paddingHorizontal: Spacing.sm,
        paddingBottom: Spacing.sm,
    },
    slider: {
        width: '100%',
        height: 36,
    },
    sliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    sliderLabelText: {
        fontSize: Typography.sizes.xs,
        color: Colors.light.textTertiary,
    },
});
