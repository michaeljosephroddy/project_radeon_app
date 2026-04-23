import { useCallback, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

interface UseScrollToTopButtonOptions {
    threshold?: number;
}

interface UseScrollToTopButtonResult {
    isVisible: boolean;
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

// Keep the floating "back to top" affordance hidden until the user has moved
// far enough down the current list for it to be useful.
export function useScrollToTopButton(
    options: UseScrollToTopButtonOptions = {},
): UseScrollToTopButtonResult {
    const { threshold = 420 } = options;
    const [isVisible, setIsVisible] = useState(false);

    const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        const shouldShow = offsetY >= threshold;

        setIsVisible((current) => (current === shouldShow ? current : shouldShow));
    }, [threshold]);

    return {
        isVisible,
        onScroll,
    };
}
