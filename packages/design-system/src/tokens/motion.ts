/**
 * OPSKL MOTION & INTERACTION TOKENS
 * Apple-grade physical motion parameters, spring curves, and duration specs.
 */

export const motion = {
  // Durations (in milliseconds)
  duration: {
    instant: 100,
    fast: 180,       // Micro-interactions, chip toggles, button taps
    normal: 280,     // Sheets, modals, panel transitions
    slow: 350,       // Major screen push/pop transitions
    pulse: 1200,     // Skeleton shimmer cycles
  },

  // Easing curves
  easing: {
    // Apple standard cubic bezier
    standard: 'cubic-bezier(0.32, 0.72, 0, 1)',
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
  },

  // Spring physics configs
  spring: {
    // Physical button / card press feedback
    press: {
      tension: 400,
      friction: 28,
      activeScale: 0.98,
    },
    // Bottom sheets and modal presentation
    sheet: {
      tension: 260,
      friction: 26,
      mass: 0.9,
    },
    // Success feedback checkmark or badge scale-in
    success: {
      tension: 300,
      friction: 18,
    },
  },
} as const;

export type MotionTokens = typeof motion;
