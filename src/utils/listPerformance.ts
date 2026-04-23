import { FlatListProps, Platform } from 'react-native';

export type ListProfile = 'denseFeed' | 'twoColumnGrid' | 'chatList' | 'detailList';

type SharedListPerformanceProps = Pick<
    FlatListProps<unknown>,
    'initialNumToRender' | 'maxToRenderPerBatch' | 'updateCellsBatchingPeriod' | 'windowSize' | 'removeClippedSubviews'
>;

const LIST_PERFORMANCE_PROFILES: Record<ListProfile, SharedListPerformanceProps> = {
    denseFeed: {
        initialNumToRender: 6,
        maxToRenderPerBatch: 4,
        updateCellsBatchingPeriod: 80,
        windowSize: 5,
        removeClippedSubviews: Platform.OS === 'android',
    },
    twoColumnGrid: {
        initialNumToRender: 8,
        maxToRenderPerBatch: 6,
        updateCellsBatchingPeriod: 60,
        windowSize: 6,
        removeClippedSubviews: Platform.OS === 'android',
    },
    chatList: {
        initialNumToRender: 10,
        maxToRenderPerBatch: 8,
        updateCellsBatchingPeriod: 60,
        windowSize: 8,
        removeClippedSubviews: Platform.OS === 'android',
    },
    detailList: {
        initialNumToRender: 8,
        maxToRenderPerBatch: 6,
        updateCellsBatchingPeriod: 70,
        windowSize: 6,
        removeClippedSubviews: Platform.OS === 'android',
    },
};

export function getListPerformanceProps(profile?: ListProfile): SharedListPerformanceProps {
    return profile ? LIST_PERFORMANCE_PROFILES[profile] : LIST_PERFORMANCE_PROFILES.detailList;
}
