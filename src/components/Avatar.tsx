import React from 'react';
import { View, Text, Image, StyleSheet, ImageStyle, ViewStyle } from 'react-native';
import { AvatarSizes, Colors, TextStyles, getAvatarColors, getInitials } from '../theme';
import { useReachOutStatus } from '../support/ReachOutStatusProvider';

interface AvatarProps {
  userId?: string;
  username: string;
  avatarUrl?: string;
  size?: number;
  fontSize?: number;
  forceReachOutRing?: boolean;
}

// Renders either a remote avatar image or a deterministic initials fallback.
export function Avatar({ userId, username, avatarUrl, size = AvatarSizes.compact, fontSize = TextStyles.chip.fontSize, forceReachOutRing = false }: AvatarProps) {
  const colors = getAvatarColors(username);
  const initials = getInitials(username);
  const frameStyle = getAvatarFrameStyle(size);
  const { getSignalForIdentity } = useReachOutStatus();
  const signal = getSignalForIdentity({ userId, username });
  const showReachOutRing = forceReachOutRing || Boolean(signal);
  const ringWidth = showReachOutRing ? getReachOutRingWidth(size) : 0;
  const outerFrameStyle = showReachOutRing ? getAvatarFrameStyle(size + ringWidth * 2) : frameStyle;
  const ringStyle = showReachOutRing ? getReachOutRingStyle(ringWidth) : null;

  if (avatarUrl) {
    return (
      <View style={[styles.frame, outerFrameStyle, ringStyle]}>
        <Image
          source={{ uri: avatarUrl }}
          style={frameStyle}
        />
      </View>
    );
  }

  // Fall back to deterministic initials so the UI still feels personalized
  // before an avatar is uploaded or while remote image URLs are unavailable.
  return (
    <View style={[styles.frame, outerFrameStyle, ringStyle]}>
      <View style={[
        styles.avatar,
        frameStyle,
        { backgroundColor: colors.bg }
      ]}>
        <Text style={[styles.text, { fontSize, color: colors.text }]}>{initials}</Text>
      </View>
    </View>
  );
}

function getAvatarFrameStyle(size: number): ImageStyle & ViewStyle {
  return {
    width: size,
    height: size,
    borderRadius: size / 2,
  };
}

function getReachOutRingWidth(size: number): number {
  return size >= AvatarSizes.hero ? 3 : 2;
}

function getReachOutRingStyle(width: number): ViewStyle {
  return {
    borderWidth: width,
    borderColor: Colors.danger,
  };
}

const styles = StyleSheet.create({
  frame: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '500',
  },
});
