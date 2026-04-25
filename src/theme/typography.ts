import { Colors } from './colors';

export const Typography = {
  h1:    { fontSize: 28, fontWeight: '700' as const, color: Colors.text.primary,   lineHeight: 36 },
  h2:    { fontSize: 22, fontWeight: '600' as const, color: Colors.text.primary,   lineHeight: 30 },
  h3:    { fontSize: 17, fontWeight: '600' as const, color: Colors.text.primary,   lineHeight: 24 },
  body:  { fontSize: 15, fontWeight: '400' as const, color: Colors.text.secondary, lineHeight: 22 },
  small: { fontSize: 13, fontWeight: '400' as const, color: Colors.text.muted,     lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '500' as const, color: Colors.text.muted,     letterSpacing: 0.4 },
  mono:  { fontSize: 13, fontFamily: 'monospace' as const, color: Colors.text.secondary },
  screenTitle: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.text.muted,
    letterSpacing: 0.7,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.text.secondary,
  },
  meta: {
    fontSize: 11,
    fontWeight: '400' as const,
    color: Colors.text.muted,
    lineHeight: 18,
  },

  // Backward-compat size map used throughout existing screens
  sizes: {
    xs:   10,
    sm:   11,
    base: 12,
    md:   13,
    lg:   15,
    xl:   17,
    xxl:  22,
    xxxl: 28,
  },
  weights: {
    regular:  '400' as const,
    medium:   '500' as const,
    semibold: '600' as const,
    bold:     '700' as const,
  },
};
