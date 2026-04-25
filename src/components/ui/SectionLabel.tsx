import React from 'react';
import {
    StyleProp,
    Text,
    TextStyle,
} from 'react-native';
import { screenStandards } from '../../styles/screenStandards';

export interface SectionLabelProps {
    children: React.ReactNode;
    style?: StyleProp<TextStyle>;
}

export function SectionLabel({ children, style }: SectionLabelProps) {
    return (
        <Text style={[screenStandards.sectionLabelText, style]}>
            {children}
        </Text>
    );
}
