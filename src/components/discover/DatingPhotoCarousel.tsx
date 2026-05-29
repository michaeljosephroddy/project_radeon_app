import React, { useMemo, useState } from 'react';
import {
    Image,
    StyleProp,
    StyleSheet,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import { Avatar } from '../Avatar';
import * as api from '../../api/client';
import { Colors, Radius, Spacing } from '../../theme';

interface DatingPhotoCarouselProps {
    username: string;
    photos: api.DatingPhoto[];
    avatarSize?: number;
    style?: StyleProp<ViewStyle>;
    onPress?: () => void;
}

export function DatingPhotoCarousel({
    username,
    photos,
    avatarSize = 112,
    style,
    onPress,
}: DatingPhotoCarouselProps): React.ReactElement {
    const safePhotos = useMemo(() => photos ?? [], [photos]);
    const [activeIndex, setActiveIndex] = useState(0);
    const activePhoto = safePhotos[Math.min(activeIndex, Math.max(safePhotos.length - 1, 0))];
    const canPage = safePhotos.length > 1;

    const goPrevious = (): void => {
        if (!canPage) return;
        setActiveIndex((current) => Math.max(current - 1, 0));
    };

    const goNext = (): void => {
        if (!canPage) return;
        setActiveIndex((current) => Math.min(current + 1, safePhotos.length - 1));
    };

    return (
        <TouchableOpacity
            style={[styles.container, style]}
            activeOpacity={onPress ? 0.94 : 1}
            onPress={onPress}
            accessibilityRole={onPress ? 'button' : undefined}
            accessibilityLabel={onPress ? `View ${username} dating profile` : undefined}
        >
            {activePhoto?.image_url ? (
                <Image source={{ uri: activePhoto.image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
                <View style={styles.fallback}>
                    <Avatar username={username} size={avatarSize} fontSize={Math.round(avatarSize * 0.32)} />
                </View>
            )}

            {canPage ? (
                <>
                    <TouchableOpacity
                        style={styles.previousZone}
                        onPress={goPrevious}
                        activeOpacity={1}
                        accessibilityRole="button"
                        accessibilityLabel="Previous photo"
                    />
                    <TouchableOpacity
                        style={styles.nextZone}
                        onPress={goNext}
                        activeOpacity={1}
                        accessibilityRole="button"
                        accessibilityLabel="Next photo"
                    />
                    <View style={styles.dots}>
                        {safePhotos.map((photo, index) => (
                            <View
                                key={photo.id}
                                style={[styles.dot, index === activeIndex ? styles.dotActive : styles.dotInactive]}
                            />
                        ))}
                    </View>
                </>
            ) : null}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
        borderRadius: Radius.lg,
        backgroundColor: Colors.bg.raised,
    },
    fallback: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    previousZone: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: '42%',
    },
    nextZone: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: '58%',
    },
    dots: {
        position: 'absolute',
        top: Spacing.sm,
        left: Spacing.sm,
        right: Spacing.sm,
        flexDirection: 'row',
        gap: 4,
    },
    dot: {
        flex: 1,
        height: 3,
        borderRadius: Radius.pill,
    },
    dotActive: {
        backgroundColor: Colors.textOn.primary,
    },
    dotInactive: {
        backgroundColor: 'rgba(255,255,255,0.42)',
    },
});
