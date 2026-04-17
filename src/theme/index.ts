export { Colors }          from './colors';
export { Typography }      from './typography';
export { Spacing, Radius } from './layout';

import { Colors } from './colors';

export function getAvatarColors(name: string) {
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

export function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

