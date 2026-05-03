import { Colors } from './colors';
import { TextStyles, Typography } from './typography';
import {
  Composer,
  ContentInsets,
  ControlHeights,
  ControlSizes,
  Header,
  Radius,
  Spacing,
} from './layout';

export {
  Colors,
  Composer,
  ContentInsets,
  ControlHeights,
  ControlSizes,
  Header,
  Radius,
  Spacing,
  TextStyles,
  Typography,
};

// Picks a deterministic fallback avatar palette from a username.
export function getAvatarColors(name: string) {
  // Pick from a small fixed palette so generated avatars stay consistent across sessions.
  const palettes = [
    { bg: '#1a2744', text: Colors.primary },
    { bg: '#0d2e1f', text: Colors.success },
    { bg: '#2c1215', text: Colors.danger },
    { bg: '#2a2200', text: Colors.warning },
  ];
  if (!name) return palettes[0];
  const idx = (name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % palettes.length;
  return palettes[idx];
}

// Derives up to two initials for avatar fallbacks from a user label.
export function getInitials(label: string) {
  // Usernames are displayed with an optional @ prefix elsewhere, so strip it here
  // to keep fallback avatars from rendering punctuation.
  const cleaned = label.replace(/^@+/, '').trim();
  if (!cleaned) return '?';
  return cleaned.slice(0, 2).toUpperCase();
}
