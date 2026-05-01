import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../theme';

export type ProfileContentTabKey = 'posts' | 'reposts' | 'tagged';

interface ProfileTabConfig {
    key: ProfileContentTabKey;
    icon: keyof typeof Ionicons.glyphMap;
    accessibilityLabel: string;
}

export interface ProfileContentTabsProps {
    activeTab: ProfileContentTabKey;
    onChange: (tab: ProfileContentTabKey) => void;
}

const TABS: ProfileTabConfig[] = [
    { key: 'posts', icon: 'grid-outline', accessibilityLabel: 'Posts' },
    { key: 'reposts', icon: 'repeat-outline', accessibilityLabel: 'Reposts' },
    { key: 'tagged', icon: 'person-outline', accessibilityLabel: 'Tagged posts' },
];

export function ProfileContentTabs({ activeTab, onChange }: ProfileContentTabsProps): React.ReactElement {
    return (
        <View style={styles.container}>
            {TABS.map((tab) => {
                const active = activeTab === tab.key;
                return (
                    <TouchableOpacity
                        key={tab.key}
                        style={[styles.tab, active && styles.tabActive]}
                        accessibilityRole="tab"
                        accessibilityLabel={tab.accessibilityLabel}
                        accessibilityState={{ selected: active }}
                        onPress={() => onChange(tab.key)}
                    >
                        <Ionicons
                            name={tab.icon}
                            size={23}
                            color={active ? Colors.text.primary : Colors.text.muted}
                        />
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        borderTopWidth: 0.5,
        borderBottomWidth: 0.5,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.page,
    },
    tab: {
        flex: 1,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: Spacing.xs,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabActive: {
        borderBottomColor: Colors.text.primary,
    },
});
