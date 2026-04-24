import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radii, Spacing, Typography } from '../../utils/theme';

interface PlusFeatureSheetItem {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    description: string;
}

interface PlusFeatureSheetProps {
    visible: boolean;
    title: string;
    items: PlusFeatureSheetItem[];
    ctaLabel?: string;
    onClose: () => void;
    onContinueFree?: () => void;
}

export function PlusFeatureSheet({
    visible,
    title,
    items,
    ctaLabel = 'Upgrade to SoberSpace Plus',
    onClose,
    onContinueFree,
}: PlusFeatureSheetProps) {
    const translateY = useSharedValue(800);
    const backdropOpacity = useSharedValue(0);
    const onCloseRef = useRef(onClose);
    const onContinueFreeRef = useRef(onContinueFree);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        onContinueFreeRef.current = onContinueFree;
    }, [onContinueFree]);

    useEffect(() => {
        if (visible) {
            translateY.value = withTiming(0, { duration: 320 });
            backdropOpacity.value = withTiming(1, { duration: 320 });
        }
    }, [backdropOpacity, translateY, visible]);

    const stableClose = useCallback(() => {
        onCloseRef.current();
    }, []);

    const animateClose = useCallback(() => {
        translateY.value = withTiming(800, { duration: 280 });
        backdropOpacity.value = withTiming(0, { duration: 280 }, (finished) => {
            if (finished) runOnJS(stableClose)();
        });
    }, [backdropOpacity, stableClose, translateY]);

    const stableContinueFree = useCallback(() => {
        onContinueFreeRef.current?.();
    }, []);

    const animateContinueFree = useCallback(() => {
        translateY.value = withTiming(800, { duration: 280 });
        backdropOpacity.value = withTiming(0, { duration: 280 }, (finished) => {
            if (finished) runOnJS(stableContinueFree)();
        });
    }, [backdropOpacity, stableContinueFree, translateY]);

    const panGesture = useMemo(() => Gesture.Pan()
        .activeOffsetY(10)
        .onUpdate((event) => {
            translateY.value = Math.max(0, event.translationY);
        })
        .onEnd((event) => {
            if (event.translationY > 80 || event.velocityY > 800) {
                runOnJS(animateClose)();
            } else {
                translateY.value = withTiming(0, { duration: 200 });
            }
        }), [animateClose, translateY]);

    const sheetAnimStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const backdropAnimStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={animateClose}>
            <GestureHandlerRootView style={styles.modalGestureRoot}>
                <Animated.View style={[styles.modalContainer, backdropAnimStyle]}>
                    <Pressable style={styles.backdropArea} onPress={animateClose} />
                    <GestureDetector gesture={panGesture}>
                        <Animated.View style={[styles.sheet, sheetAnimStyle]}>
                            <View style={styles.sheetHandle} />
                            <View style={styles.sheetHeader}>
                                <Text style={styles.sheetTitle}>{title}</Text>
                                <View style={styles.sheetPlusBadge}>
                                    <Ionicons name="star" size={11} color={Colors.warning} />
                                    <Text style={styles.sheetPlusBadgeText}>SoberSpace Plus</Text>
                                </View>
                            </View>
                            <View style={styles.itemList}>
                                {items.map((item) => (
                                    <View key={item.label} style={styles.item}>
                                        <View style={styles.itemIcon}>
                                            <Ionicons name={item.icon} size={18} color={Colors.primary} />
                                        </View>
                                        <View style={styles.itemInfo}>
                                            <Text style={styles.itemLabel}>{item.label}</Text>
                                            <Text style={styles.itemDesc}>{item.description}</Text>
                                        </View>
                                        <Ionicons name="lock-closed" size={14} color={Colors.light.textTertiary} />
                                    </View>
                                ))}
                            </View>
                            <SafeAreaView edges={['bottom']} style={styles.sheetFooter}>
                                <TouchableOpacity style={styles.upgradeCTA} onPress={animateClose}>
                                    <Ionicons name="star" size={16} color={Colors.textOn.warning} />
                                    <Text style={styles.upgradeCTAText}>{ctaLabel}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.dismissBtn}
                                    onPress={onContinueFree ? animateContinueFree : animateClose}
                                >
                                    <Text style={styles.dismissText}>
                                        {onContinueFree ? 'Continue for free' : 'Maybe later'}
                                    </Text>
                                </TouchableOpacity>
                            </SafeAreaView>
                        </Animated.View>
                    </GestureDetector>
                </Animated.View>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: Colors.overlay,
    },
    modalGestureRoot: { flex: 1 },
    backdropArea: { flex: 1 },
    sheet: {
        backgroundColor: Colors.light.background,
        borderTopLeftRadius: Radii.xl,
        borderTopRightRadius: Radii.xl,
        paddingTop: Spacing.sm,
    },
    sheetHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.light.border,
        alignSelf: 'center',
        marginBottom: Spacing.lg,
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl,
        marginBottom: Spacing.lg,
    },
    sheetTitle: {
        fontSize: Typography.sizes.xl,
        fontWeight: '700',
        color: Colors.light.textPrimary,
    },
    sheetPlusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255,193,7,0.12)',
        borderRadius: Radii.pill,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,193,7,0.3)',
    },
    sheetPlusBadgeText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.warning,
    },
    itemList: {
        borderTopWidth: 0.5,
        borderColor: Colors.light.border,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        borderBottomWidth: 0.5,
        borderBottomColor: Colors.light.border,
        gap: Spacing.md,
    },
    itemIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.light.backgroundSecondary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemInfo: {
        flex: 1,
        gap: 2,
    },
    itemLabel: {
        fontSize: Typography.sizes.lg,
        fontWeight: '500',
        color: Colors.light.textPrimary,
    },
    itemDesc: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
    },
    sheetFooter: {
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.lg,
        gap: Spacing.sm,
    },
    upgradeCTA: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.warning,
        borderRadius: Radii.md,
        paddingVertical: 14,
    },
    upgradeCTAText: {
        fontSize: Typography.sizes.lg,
        fontWeight: '700',
        color: Colors.textOn.warning,
    },
    dismissBtn: {
        alignItems: 'center',
        paddingVertical: Spacing.sm,
    },
    dismissText: {
        fontSize: Typography.sizes.md,
        color: Colors.light.textTertiary,
    },
});
