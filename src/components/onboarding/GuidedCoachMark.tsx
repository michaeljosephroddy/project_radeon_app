import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Easing,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Colors, Radius, Spacing, TextStyles, Typography } from '../../theme';

export type GuidedCoachPhase = 'ready' | 'acting' | 'success' | 'transitioning';

interface GuidedCoachMarkProps {
    title: string;
    description: string;
    progressLabel: string;
    phase: GuidedCoachPhase;
    successLabel?: string;
    onBack?: () => void;
}

export function GuidedCoachMark({
    title,
    description,
    progressLabel,
    phase,
    successLabel,
    onBack,
}: GuidedCoachMarkProps): React.ReactElement {
    const entrance = useRef(new Animated.Value(0)).current;
    const pulse = useRef(new Animated.Value(0)).current;
    const isSuccess = phase === 'success' || phase === 'transitioning';

    useEffect(() => {
        entrance.setValue(0);
        Animated.timing(entrance, {
            toValue: 1,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [entrance, title]);

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, {
                    toValue: 1,
                    duration: 900,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(pulse, {
                    toValue: 0,
                    duration: 900,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [pulse]);

    const animatedStyle = {
        opacity: entrance,
        transform: [
            {
                translateY: entrance.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                }),
            },
        ],
    };
    const pulseStyle = {
        opacity: pulse.interpolate({
            inputRange: [0, 1],
            outputRange: [0.45, 0.9],
        }),
        transform: [
            {
                scale: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.08],
                }),
            },
        ],
    };

    return (
        <Animated.View style={[styles.wrap, animatedStyle]}>
            <View style={styles.arrow} />
            <View style={styles.headerRow}>
                {onBack ? (
                    <TouchableOpacity style={styles.backButton} onPress={onBack} accessibilityLabel="Go back">
                        <Ionicons name="chevron-back" size={20} color={Colors.text.primary} />
                    </TouchableOpacity>
                ) : null}
                <View style={styles.progressPill}>
                    <Text style={styles.progressText}>{progressLabel}</Text>
                </View>
            </View>
            <View style={styles.bodyRow}>
                <View style={[styles.iconWrap, isSuccess && styles.iconWrapSuccess]}>
                    {!isSuccess ? <Animated.View style={[styles.iconPulse, pulseStyle]} /> : null}
                    <Ionicons
                        name={isSuccess ? 'checkmark' : 'sparkles-outline'}
                        size={18}
                        color={isSuccess ? Colors.textOn.success : Colors.primary}
                    />
                </View>
                <View style={styles.copy}>
                    <Text style={styles.title}>{isSuccess ? successLabel ?? 'Done' : title}</Text>
                    <Text style={styles.description}>{isSuccess ? 'Nice. Moving you to the next step.' : description}</Text>
                </View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        marginHorizontal: Spacing.md,
        marginTop: Spacing.sm,
        marginBottom: Spacing.sm,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border.emphasis,
        backgroundColor: Colors.bg.raised,
        padding: Spacing.md,
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 18,
        elevation: 8,
    },
    arrow: {
        position: 'absolute',
        left: Spacing.xl,
        bottom: -7,
        width: 14,
        height: 14,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: Colors.border.emphasis,
        backgroundColor: Colors.bg.raised,
        transform: [{ rotate: '45deg' }],
    },
    headerRow: {
        minHeight: 28,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.sm,
    },
    backButton: {
        width: 32,
        height: 28,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    progressPill: {
        marginLeft: 'auto',
        borderRadius: Radius.pill,
        backgroundColor: Colors.primarySubtle,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
    },
    progressText: {
        ...TextStyles.caption,
        color: Colors.primary,
    },
    bodyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    iconWrap: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primarySubtle,
        overflow: 'hidden',
    },
    iconWrapSuccess: {
        backgroundColor: Colors.success,
    },
    iconPulse: {
        position: 'absolute',
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.primarySubtle,
    },
    copy: {
        flex: 1,
        gap: Spacing.xs,
    },
    title: {
        fontSize: Typography.sizes.md,
        lineHeight: 21,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    description: {
        fontSize: Typography.sizes.sm,
        lineHeight: 19,
        color: Colors.text.secondary,
    },
});
