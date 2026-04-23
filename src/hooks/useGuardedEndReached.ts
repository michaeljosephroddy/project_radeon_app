import { useCallback, useRef } from 'react';

export function useGuardedEndReached(handler: () => Promise<void> | void) {
    const hasUserScrolledRef = useRef(false);
    const canTriggerEndReachedRef = useRef(false);

    const onScrollBeginDrag = useCallback(() => {
        hasUserScrolledRef.current = true;
        canTriggerEndReachedRef.current = true;
    }, []);

    const onMomentumScrollBegin = useCallback(() => {
        if (!hasUserScrolledRef.current) return;
        canTriggerEndReachedRef.current = true;
    }, []);

    const onEndReached = useCallback(() => {
        if (!hasUserScrolledRef.current || !canTriggerEndReachedRef.current) return;

        canTriggerEndReachedRef.current = false;
        void handler();
    }, [handler]);

    return {
        onEndReached,
        onMomentumScrollBegin,
        onScrollBeginDrag,
    };
}
