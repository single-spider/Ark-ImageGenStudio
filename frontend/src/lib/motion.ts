/**
 * Shared interaction motion contract for Ark's browser and WebView2 surfaces.
 * MotionConfig reducedMotion="user" is configured in main.tsx.
 */
export const arkMotion = {
  selection: { type: 'spring' as const, stiffness: 360, damping: 34 },
  toolbar: { type: 'spring' as const, stiffness: 380, damping: 36 },
  iteration: { type: 'spring' as const, stiffness: 390, damping: 29 },
  menu: { duration: 0.16, ease: 'easeOut' as const },
};
