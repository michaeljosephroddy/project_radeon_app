import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function MatchBadge() {
    return (
        <View style={styles.badge}>
            <Ionicons name="heart" size={10} color="#fff" />
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#E53935',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#fff',
    },
});
