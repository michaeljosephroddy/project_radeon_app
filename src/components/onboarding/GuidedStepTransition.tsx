import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    StyleSheet,
    View,
} from 'react-native';
import { Colors } from '../../theme';

interface GuidedStepTransitionProps {
    stepKey: string;
    transitioning: boolean;
    children: React.ReactNode;
}

const ENTER_SETTLE_MS = 90;

export function GuidedStepTransition({
    stepKey,
    transitioning,
    children,
}: GuidedStepTransitionProps): React.ReactElement {
    const entrance = useRef(new Animated.Value(1)).current;
    const overlay = useRef(new Animated.Value(0)).current;
    const [overlayVisible, setOverlayVisible] = useState(false);

    useEffect(() => {
        if (transitioning) return;
        setOverlayVisible(true);
        overlay.setValue(1);
        entrance.setValue(0);
        const timer = setTimeout(() => {
            Animated.parallel([
                Animated.timing(entrance, {
                    toValue: 1,
                    duration: 280,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(overlay, {
                    toValue: 0,
                    duration: 240,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start(({ finished }) => {
                if (finished) setOverlayVisible(false);
            });
        }, ENTER_SETTLE_MS);
        return () => clearTimeout(timer);
    }, [entrance, overlay, stepKey, transitioning]);

    useEffect(() => {
        if (!transitioning) return;
        setOverlayVisible(true);
        Animated.parallel([
            Animated.timing(entrance, {
                toValue: 0,
                duration: 220,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(overlay, {
                toValue: 1,
                duration: 180,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }),
        ]).start();
    }, [entrance, overlay, transitioning]);

    const style = {
        opacity: entrance,
        transform: [
            {
                translateY: entrance.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                }),
            },
            {
                scale: entrance.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.98, 1],
                }),
            },
        ],
    };

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.container, style]}>
                {children}
            </Animated.View>
            {overlayVisible ? (
                <Animated.View pointerEvents="none" style={[styles.transitionOverlay, { opacity: overlay }]} />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    transitionOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Colors.bg.page,
    },
});
