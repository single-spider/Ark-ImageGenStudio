import type { Transition } from "motion/react";

export const STUDIO_MOTION = {
  tactileSnap: { type: "spring", stiffness: 520, damping: 38, mass: 0.7 } satisfies Transition,
  studioSpring: { type: "spring", stiffness: 380, damping: 32, mass: 0.85 } satisfies Transition,
  microPop: { type: "spring", stiffness: 650, damping: 22, mass: 0.5 } satisfies Transition,
  studioEase: { duration: 0.18, ease: [0.22, 1, 0.36, 1] } satisfies Transition,
  imageReveal: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } satisfies Transition,
  privacyLock: { duration: 0.085, ease: [0.2, 0, 0, 1] } satisfies Transition,
} as const;
