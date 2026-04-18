import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { getAvatarColors, getInitials } from '../utils/theme';

interface AvatarProps {
  username: string;
  avatarUrl?: string;
  size?: number;
  fontSize?: number;
}

// Renders either a remote avatar image or a deterministic initials fallback.
export function Avatar({ username, avatarUrl, size = 36, fontSize = 13 }: AvatarProps) {
  const colors = getAvatarColors(username);
  const initials = getInitials(username);
  const radius = size / 2;

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }

  // Fall back to deterministic initials so the UI still feels personalized
  // before an avatar is uploaded or while remote image URLs are unavailable.
  return (
    <View style={[
      styles.avatar,
      { width: size, height: size, borderRadius: radius, backgroundColor: colors.bg }
    ]}>
      <Text style={[styles.text, { fontSize, color: colors.text }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '500',
  },
});
