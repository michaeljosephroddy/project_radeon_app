import { Colors } from './colors';

export const Typography = {
  h1:    { fontSize: 30, fontWeight: '700' as const, color: Colors.text.primary,   lineHeight: 38 },
  h2:    { fontSize: 24, fontWeight: '600' as const, color: Colors.text.primary,   lineHeight: 32 },
  h3:    { fontSize: 19, fontWeight: '600' as const, color: Colors.text.primary,   lineHeight: 26 },
  body:  { fontSize: 16, fontWeight: '400' as const, color: Colors.text.secondary, lineHeight: 24 },
  small: { fontSize: 13, fontWeight: '400' as const, color: Colors.text.muted,     lineHeight: 19 },
  label: { fontSize: 12, fontWeight: '500' as const, color: Colors.text.muted,     letterSpacing: 0.4 },
  mono:  { fontSize: 14, fontFamily: 'monospace' as const, color: Colors.text.secondary },
  screenTitle: {
    fontSize: 17,
    fontWeight: '500' as const,
    color: Colors.text.primary,
    lineHeight: 22,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.text.muted,
    letterSpacing: 0.7,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text.secondary,
  },
  meta: {
    fontSize: 12,
    fontWeight: '400' as const,
    color: Colors.text.muted,
    lineHeight: 18,
  },

  // Backward-compat size map used throughout existing screens
  sizes: {
    xs:   12,
    sm:   13,
    base: 15,
    md:   16,
    lg:   18,
    xl:   20,
    composer: 20,
    xxl:  24,
    xxxl: 30,
  },
  weights: {
    regular:  '400' as const,
    medium:   '500' as const,
    semibold: '600' as const,
    bold:     '700' as const,
  },
};

export const TextStyles = {
  displayTitle: {
    fontSize: Typography.sizes.xxxl,
    lineHeight: 38,
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
  },
  screenTitle: Typography.screenTitle,
  sectionTitle: {
    fontSize: Typography.sizes.lg,
    lineHeight: 24,
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
  },
  cardTitle: {
    fontSize: Typography.sizes.md,
    lineHeight: 22,
    fontWeight: Typography.weights.semibold,
    color: Colors.text.primary,
  },
  body: Typography.body,
  bodyEmphasis: {
    fontSize: Typography.sizes.base,
    lineHeight: 22,
    fontWeight: Typography.weights.semibold,
    color: Colors.text.primary,
  },
  secondary: {
    fontSize: Typography.sizes.sm,
    lineHeight: 20,
    fontWeight: Typography.weights.regular,
    color: Colors.text.secondary,
  },
  meta: Typography.meta,
  caption: {
    fontSize: Typography.sizes.xs,
    lineHeight: 18,
    fontWeight: Typography.weights.semibold,
    color: Colors.text.muted,
  },
  badge: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: Typography.weights.bold,
    color: Colors.textOn.primary,
  },
  avatarBadge: {
    fontSize: 8,
    lineHeight: 10,
    fontWeight: Typography.weights.semibold,
    color: Colors.primary,
  },
  label: {
    fontSize: Typography.sizes.sm,
    lineHeight: 18,
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
  },
  button: {
    fontSize: Typography.sizes.base,
    lineHeight: 20,
    fontWeight: Typography.weights.bold,
    color: Colors.textOn.primary,
  },
  chip: {
    fontSize: Typography.sizes.sm,
    lineHeight: 18,
    fontWeight: Typography.weights.semibold,
    color: Colors.text.secondary,
  },
  input: {
    fontSize: Typography.sizes.base,
    lineHeight: 22,
    fontWeight: Typography.weights.regular,
    color: Colors.text.primary,
  },
  postBody: {
    fontSize: Typography.sizes.base,
    lineHeight: 22,
    fontWeight: Typography.weights.regular,
    color: Colors.text.secondary,
  },
  commentAuthor: {
    fontSize: Typography.sizes.base,
    lineHeight: 20,
    fontWeight: Typography.weights.semibold,
    color: Colors.text.primary,
  },
  commentBody: {
    fontSize: Typography.sizes.base,
    lineHeight: 21,
    fontWeight: Typography.weights.regular,
    color: Colors.text.secondary,
  },
};
