import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getAvatarColors, getInitials } from '../utils/theme';

interface AvatarProps {
  firstName: string;
  lastName: string;
  size?: number;
  fontSize?: number;
}

export function Avatar({ firstName, lastName, size = 36, fontSize = 13 }: AvatarProps) {
  const colors = getAvatarColors(firstName);
  const initials = getInitials(firstName, lastName);

  return (
    <View style={[
      styles.avatar,
      { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.bg }
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
