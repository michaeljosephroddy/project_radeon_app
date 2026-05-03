import { useCallback, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

interface UseFloatingActionVisibilityOptions {
    enabled?: boolean;
    idleDelayMs?: number;
    movementThreshold?: number;
}

interface UseFloatingActionVisibilityResult {
    isVisible: boolean;
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    showNow: () => void;
}

export function useFloatingActionVisibility({
    enabled = true,
    idleDelayMs = 150,
    movementThreshold = 4,
}: UseFloatingActionVisibilityOptions = {}): UseFloatingActionVisibilityResult {
    const [isVisible, setIsVisible] = useState(true);
    const lastOffsetRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearPendingShow = useCallback((): void => {
        if (!timerRef.current) return;
        clearTimeout(timerRef.current);
        timerRef.current = null;
    }, []);

    const showNow = useCallback((): void => {
        clearPendingShow();
        setIsVisible(true);
    }, [clearPendingShow]);

    const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>): void => {
        if (!enabled) {
            showNow();
            return;
        }

        const offsetY = Math.max(event.nativeEvent.contentOffset.y, 0);
        const delta = Math.abs(offsetY - lastOffsetRef.current);
        lastOffsetRef.current = offsetY;

        if (offsetY <= movementThreshold) {
            showNow();
            return;
        }

        if (delta < movementThreshold) return;

        setIsVisible(false);
        clearPendingShow();
        timerRef.current = setTimeout(() => {
            setIsVisible(true);
            timerRef.current = null;
        }, idleDelayMs);
    }, [clearPendingShow, enabled, idleDelayMs, movementThreshold, showNow]);

    return { isVisible, onScroll, showNow };
}
