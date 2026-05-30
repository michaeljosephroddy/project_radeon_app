import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ScreenHeader } from '../ui/ScreenHeader';
import { Colors, Spacing } from '../../theme';
import { CommentThread, type CommentThreadProps } from './CommentThread';

export interface CommentThreadScreenProps extends CommentThreadProps {
    title: string;
    onBack: () => void;
}

export function CommentThreadScreen({
    title,
    onBack,
    ...threadProps
}: CommentThreadScreenProps): React.ReactElement {
    return (
        <View style={styles.container}>
            <ScreenHeader
                title={title}
                onBack={onBack}
                style={styles.header}
            />
            <CommentThread {...threadProps} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    header: {
        paddingBottom: Spacing.sm,
    },
});
