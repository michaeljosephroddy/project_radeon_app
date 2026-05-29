import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    type LayoutChangeEvent,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    type SharedValue,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import * as api from '../../api/client';
import { Colors, Radius, Spacing, TextStyles, Typography } from '../../theme';

interface DatingSortablePhotoGridProps {
    photos: api.DatingPhoto[];
    uploading: boolean;
    reordering: boolean;
    deletingPhotoIds: Set<string>;
    onPickPhoto: () => void;
    onDeletePhoto: (photoId: string) => void;
    onReorderPhotos: (photoIds: string[]) => void;
}

interface SortablePhotoTileProps {
    photo: api.DatingPhoto;
    index: number;
    total: number;
    disabled: boolean;
    isDeleting: boolean;
    cellWidth: number;
    tileHeight: number;
    positions: SharedValue<Record<string, number>>;
    orderedIds: SharedValue<string[]>;
    activePhotoId: SharedValue<string | null>;
    onDeletePhoto: (photoId: string) => void;
    onDragStart: (photoId: string) => void;
    onPreviewOrder: (photoIds: string[]) => void;
    onCommitOrder: (photoIds: string[]) => void;
}

const MAX_PHOTOS = 6;
const GRID_COLUMNS = 3;
const TILE_ASPECT_RATIO = 0.78;
const GRID_GAP = Spacing.sm;
const SPRING_CONFIG = {
    damping: 18,
    stiffness: 220,
    mass: 0.8,
};

export function DatingSortablePhotoGrid({
    photos,
    uploading,
    reordering,
    deletingPhotoIds,
    onPickPhoto,
    onDeletePhoto,
    onReorderPhotos,
}: DatingSortablePhotoGridProps): React.ReactElement {
    const sortedPhotos = useMemo(() => [...photos].sort(compareDatingPhotos), [photos]);
    const [containerWidth, setContainerWidth] = useState(0);
    const [localPhotos, setLocalPhotos] = useState(sortedPhotos);
    const [draggingPhotoId, setDraggingPhotoId] = useState<string | null>(null);
    const positions = useSharedValue(createPhotoPositions(sortedPhotos.map((photo) => photo.id)));
    const orderedIds = useSharedValue(sortedPhotos.map((photo) => photo.id));
    const activePhotoId = useSharedValue<string | null>(null);
    const disabled = uploading || reordering || deletingPhotoIds.size > 0;
    const cellWidth = containerWidth > 0
        ? (containerWidth - (GRID_GAP * (GRID_COLUMNS - 1))) / GRID_COLUMNS
        : 0;
    const tileHeight = cellWidth > 0 ? cellWidth / TILE_ASPECT_RATIO : 0;
    const itemCount = sortedPhotos.length + (sortedPhotos.length < MAX_PHOTOS ? 1 : 0);
    const rowCount = Math.max(1, Math.ceil(itemCount / GRID_COLUMNS));
    const gridHeight = tileHeight > 0 ? (rowCount * tileHeight) + ((rowCount - 1) * GRID_GAP) : 0;
    const photoById = useMemo(() => new Map(sortedPhotos.map((photo) => [photo.id, photo])), [sortedPhotos]);
    const sortedSignature = sortedPhotos.map((photo) => `${photo.id}:${photo.position}`).join('|');

    useEffect(() => {
        if (draggingPhotoId) return;
        const photoIds = sortedPhotos.map((photo) => photo.id);
        setLocalPhotos(sortedPhotos);
        positions.value = createPhotoPositions(photoIds);
        orderedIds.value = photoIds;
    }, [draggingPhotoId, orderedIds, positions, sortedPhotos, sortedSignature]);

    const handleLayout = (event: LayoutChangeEvent): void => {
        setContainerWidth(event.nativeEvent.layout.width);
    };

    const setPhotosFromIds = useCallback((photoIds: string[]): void => {
        const nextPhotos = photoIds
            .map((photoId) => photoById.get(photoId))
            .filter((photo): photo is api.DatingPhoto => Boolean(photo));
        setLocalPhotos(nextPhotos);
    }, [photoById]);

    const handlePreviewOrder = useCallback((photoIds: string[]): void => {
        setPhotosFromIds(photoIds);
        triggerSelectionHaptic();
    }, [setPhotosFromIds]);

    const handleCommitOrder = useCallback((photoIds: string[]): void => {
        setDraggingPhotoId(null);
        setPhotosFromIds(photoIds);
        const currentIds = sortedPhotos.map((photo) => photo.id);
        if (photoIds.join('|') !== currentIds.join('|')) {
            onReorderPhotos(photoIds);
        }
    }, [onReorderPhotos, setPhotosFromIds, sortedPhotos]);

    const handleDragStart = useCallback((photoId: string): void => {
        setDraggingPhotoId(photoId);
    }, []);

    const addTilePosition = getGridPosition(sortedPhotos.length, cellWidth, tileHeight);

    return (
        <View onLayout={handleLayout}>
            <View style={[styles.grid, gridHeight > 0 && { height: gridHeight }]}>
                {cellWidth > 0 ? localPhotos.map((photo, index) => {
                    const isDeleting = deletingPhotoIds.has(photo.id);
                    return (
                        <SortablePhotoTile
                            key={photo.id}
                            photo={photo}
                            index={index}
                            total={localPhotos.length}
                            disabled={disabled || isDeleting}
                            isDeleting={isDeleting}
                            cellWidth={cellWidth}
                            tileHeight={tileHeight}
                            positions={positions}
                            orderedIds={orderedIds}
                            activePhotoId={activePhotoId}
                            onDeletePhoto={onDeletePhoto}
                            onDragStart={handleDragStart}
                            onPreviewOrder={handlePreviewOrder}
                            onCommitOrder={handleCommitOrder}
                        />
                    );
                }) : null}
                {cellWidth > 0 && sortedPhotos.length < MAX_PHOTOS ? (
                    <View
                        style={[
                            styles.addTileWrap,
                            {
                                width: cellWidth,
                                height: tileHeight,
                                transform: [
                                    { translateX: addTilePosition.x },
                                    { translateY: addTilePosition.y },
                                ],
                            },
                        ]}
                    >
                        <Pressable
                            style={[styles.addTile, disabled && styles.tileDisabled]}
                            onPress={onPickPhoto}
                            disabled={disabled}
                            android_ripple={{ color: Colors.primarySubtle }}
                            accessibilityRole="button"
                            accessibilityLabel="Add dating profile photo"
                        >
                            {uploading ? (
                                <ActivityIndicator color={Colors.primary} />
                            ) : (
                                <Ionicons name="add" size={24} color={Colors.primary} />
                            )}
                            <Text style={styles.addTileText}>Add</Text>
                        </Pressable>
                    </View>
                ) : null}
            </View>
        </View>
    );
}

function SortablePhotoTile({
    photo,
    index,
    total,
    disabled,
    isDeleting,
    cellWidth,
    tileHeight,
    positions,
    orderedIds,
    activePhotoId,
    onDeletePhoto,
    onDragStart,
    onPreviewOrder,
    onCommitOrder,
}: SortablePhotoTileProps): React.ReactElement {
    const dragX = useSharedValue(0);
    const dragY = useSharedValue(0);
    const dragStartIndex = useSharedValue(index);
    const isDragging = useSharedValue(false);
    const isMainPhoto = index === 0;

    const gesture = Gesture.Pan()
        .enabled(!disabled)
        .onBegin(() => {
            dragStartIndex.value = positions.value[photo.id] ?? index;
            dragX.value = 0;
            dragY.value = 0;
            isDragging.value = true;
            activePhotoId.value = photo.id;
            runOnJS(onDragStart)(photo.id);
        })
        .onUpdate((event) => {
            dragX.value = event.translationX;
            dragY.value = event.translationY;
            const currentIndex = positions.value[photo.id] ?? dragStartIndex.value;
            const origin = gridPositionWorklet(dragStartIndex.value, cellWidth, tileHeight);
            const centerX = origin.x + event.translationX + (cellWidth / 2);
            const centerY = origin.y + event.translationY + (tileHeight / 2);
            const targetColumn = clampWorklet(Math.floor(centerX / (cellWidth + GRID_GAP)), 0, GRID_COLUMNS - 1);
            const targetRow = Math.max(0, Math.floor(centerY / (tileHeight + GRID_GAP)));
            const targetIndex = clampWorklet((targetRow * GRID_COLUMNS) + targetColumn, 0, total - 1);

            if (targetIndex === currentIndex) return;

            const nextOrder = [...orderedIds.value];
            const fromIndex = nextOrder.indexOf(photo.id);
            if (fromIndex < 0) return;
            nextOrder.splice(fromIndex, 1);
            nextOrder.splice(targetIndex, 0, photo.id);
            orderedIds.value = nextOrder;
            positions.value = createPhotoPositionsWorklet(nextOrder);
            runOnJS(onPreviewOrder)(nextOrder);
        })
        .onFinalize(() => {
            const nextOrder = [...orderedIds.value];
            dragX.value = 0;
            dragY.value = 0;
            isDragging.value = false;
            activePhotoId.value = null;
            runOnJS(onCommitOrder)(nextOrder);
        });

    const animatedTileStyle = useAnimatedStyle(() => {
        const active = activePhotoId.value === photo.id;
        const resolvedIndex = active ? dragStartIndex.value : positions.value[photo.id] ?? index;
        const targetPosition = gridPositionWorklet(resolvedIndex, cellWidth, tileHeight);
        const translateX = active ? targetPosition.x + dragX.value : withSpring(targetPosition.x, SPRING_CONFIG);
        const translateY = active ? targetPosition.y + dragY.value : withSpring(targetPosition.y, SPRING_CONFIG);
        return {
            width: cellWidth,
            height: tileHeight,
            zIndex: active ? 20 : 1,
            elevation: active ? 8 : 0,
            opacity: disabled && !active ? 0.55 : 1,
            transform: [
                { translateX },
                { translateY },
                { scale: active ? withSpring(1.035, SPRING_CONFIG) : withSpring(1, SPRING_CONFIG) },
            ],
        };
    }, [cellWidth, disabled, index, photo.id, tileHeight]);

    return (
        <Animated.View style={[styles.tileWrap, animatedTileStyle]}>
            <View style={styles.photoTile}>
                <Image source={{ uri: photo.image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <View style={[styles.orderBadge, isMainPhoto && styles.orderBadgeMain]}>
                    <Text style={[styles.orderBadgeText, isMainPhoto && styles.orderBadgeTextMain]}>
                        {isMainPhoto ? 'Main' : String(index + 1)}
                    </Text>
                </View>
                <Pressable
                    style={[styles.removeButton, disabled && styles.tileDisabled]}
                    onPress={() => onDeletePhoto(photo.id)}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${isMainPhoto ? 'main photo' : `photo ${index + 1}`}`}
                >
                    {isDeleting
                        ? <ActivityIndicator size="small" color={Colors.text.secondary} />
                        : <Ionicons name="trash-outline" size={18} color={Colors.text.secondary} />}
                </Pressable>
                <GestureDetector gesture={gesture}>
                    <Animated.View
                        style={[styles.dragHandle, disabled && styles.tileDisabled]}
                        accessibilityRole="button"
                        accessibilityLabel={`Drag to reorder ${isMainPhoto ? 'main photo' : `photo ${index + 1}`}`}
                    >
                        <Ionicons name="reorder-three-outline" size={20} color={Colors.textOn.primary} />
                    </Animated.View>
                </GestureDetector>
            </View>
        </Animated.View>
    );
}

function compareDatingPhotos(a: api.DatingPhoto, b: api.DatingPhoto): number {
    if (a.position !== b.position) return a.position - b.position;
    return a.created_at.localeCompare(b.created_at);
}

function createPhotoPositions(photoIds: string[]): Record<string, number> {
    return photoIds.reduce<Record<string, number>>((acc, photoId, index) => {
        acc[photoId] = index;
        return acc;
    }, {});
}

function createPhotoPositionsWorklet(photoIds: string[]): Record<string, number> {
    'worklet';
    const nextPositions: Record<string, number> = {};
    for (let index = 0; index < photoIds.length; index += 1) {
        nextPositions[photoIds[index]] = index;
    }
    return nextPositions;
}

function getGridPosition(index: number, cellWidth: number, tileHeight: number): { x: number; y: number } {
    const column = index % GRID_COLUMNS;
    const row = Math.floor(index / GRID_COLUMNS);
    return {
        x: column * (cellWidth + GRID_GAP),
        y: row * (tileHeight + GRID_GAP),
    };
}

function gridPositionWorklet(index: number, cellWidth: number, tileHeight: number): { x: number; y: number } {
    'worklet';
    const column = index % GRID_COLUMNS;
    const row = Math.floor(index / GRID_COLUMNS);
    return {
        x: column * (cellWidth + GRID_GAP),
        y: row * (tileHeight + GRID_GAP),
    };
}

function clampWorklet(value: number, min: number, max: number): number {
    'worklet';
    return Math.min(Math.max(value, min), max);
}

function triggerSelectionHaptic(): void {
    Haptics.selectionAsync().catch(() => {});
}

const styles = StyleSheet.create({
    grid: {
        position: 'relative',
        minHeight: 120,
    },
    tileWrap: {
        position: 'absolute',
        left: 0,
        top: 0,
    },
    photoTile: {
        flex: 1,
        overflow: 'hidden',
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.raised,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    orderBadge: {
        position: 'absolute',
        left: Spacing.xs,
        top: Spacing.xs,
        minWidth: 24,
        minHeight: 22,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
        paddingHorizontal: Spacing.xs,
    },
    orderBadgeMain: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    orderBadgeText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '800',
        color: Colors.text.secondary,
    },
    orderBadgeTextMain: {
        color: Colors.textOn.primary,
    },
    removeButton: {
        position: 'absolute',
        right: Spacing.xs,
        top: Spacing.xs,
        width: 30,
        height: 30,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.bg.raised,
    },
    dragHandle: {
        position: 'absolute',
        right: Spacing.xs,
        bottom: Spacing.xs,
        width: 34,
        height: 34,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.58)',
    },
    addTileWrap: {
        position: 'absolute',
        left: 0,
        top: 0,
    },
    addTile: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.primary,
        backgroundColor: Colors.primarySubtle,
    },
    addTileText: {
        ...TextStyles.label,
        color: Colors.primary,
    },
    tileDisabled: {
        opacity: 0.55,
    },
});
