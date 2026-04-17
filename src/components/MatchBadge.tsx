import React from 'react';
import Svg, { Rect, Text } from 'react-native-svg';

export function MatchBadge() {
    return (
        <Svg width={56} height={18} viewBox="190 40 300 120">
            {/* Background */}
            <Rect x={190} y={40} width={300} height={120} rx={16} fill="#DC3545" />
            {/* Shine */}
            <Rect x={190} y={40} width={300} height={50} rx={16} fill="#E35564" opacity={0.35} />
            <Rect x={190} y={65} width={300} height={25} fill="#E35564" opacity={0.35} />
            {/* Border */}
            <Rect x={190} y={40} width={300} height={120} rx={16} fill="none" stroke="#E35564" strokeWidth={1.5} />
            {/* Inner border */}
            <Rect x={198} y={48} width={284} height={104} rx={12} fill="none" stroke="#E35564" strokeWidth={0.75} opacity={0.5} />
            {/* Text */}
            <Text x={340} y={120} textAnchor="middle" fontWeight="700" fontSize={62} letterSpacing={8} fill="#FFFFFF">
                MATCH
            </Text>
        </Svg>
    );
}
