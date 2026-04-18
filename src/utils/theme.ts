export {
  Typography,
  Spacing,
  getAvatarColors,
  getInitials,
} from '../theme';

import { Radius } from '../theme';
export const Radii = { ...Radius, full: Radius.pill };

import { Colors as C } from '../theme';

// Compat shim that lets older screens keep using Colors.light.* while the newer
// token set lives in src/theme. This avoids a wide refactor while design tokens settle.
export const Colors = {
  ...C,

  primary:       C.primary,
  danger:        C.danger,
  success:       C.success,
  warning:       C.warning,
  successSubtle: C.successSubtle,
  dangerSubtle:  C.dangerSubtle,

  // Old Colors.text.onAccent alias
  text: {
    ...C.text,
    onAccent: C.textOn.primary,
  },

  // Old Colors.light.* shape — used by existing screens
  light: {
    background:          C.bg.page,
    backgroundSecondary: C.bg.surface,
    textPrimary:         C.text.primary,
    textSecondary:       C.text.secondary,
    textTertiary:        C.text.muted,
    border:              C.border.default,
    borderSecondary:     C.border.subtle,
  },
};
