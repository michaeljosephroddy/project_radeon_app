import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

interface ChatBodyProps {
    threadAnimatedStyle: object;
    composerAnimatedStyle: object;
    thread: React.ReactNode;
    composer: React.ReactNode;
}

export function ChatBody({
    threadAnimatedStyle,
    composerAnimatedStyle,
    thread,
    composer,
}: ChatBodyProps) {
    return (
        <View style={styles.viewport}>
            <Animated.View style={[styles.thread, threadAnimatedStyle]}>
                {thread}
            </Animated.View>
            <Animated.View style={[styles.composer, composerAnimatedStyle]}>
                {composer}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    viewport: {
        flex: 1,
        overflow: 'hidden',
    },
    thread: {
        flex: 1,
    },
    composer: {
        flexShrink: 0,
    },
});
