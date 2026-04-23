import { useEffect, useState } from 'react';

export function useLazyActivation(isActive: boolean): boolean {
    const [hasActivated, setHasActivated] = useState(isActive);

    useEffect(() => {
        if (isActive) {
            setHasActivated(true);
        }
    }, [isActive]);

    return hasActivated;
}
