import type { Transition, Variants } from 'motion/react';

// === Transitions ===

export const springTransition: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
};

export const gentleSpring: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 25,
};

const instantTransition: Transition = { duration: 0 };

// === Modal ===

export const modalOverlay: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const modalContent: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 30 },
  },
  exit: { opacity: 0, scale: 0.95, y: 8, transition: { duration: 0.15 } },
};

// === Slide (ArticleReader, Sidebar) ===

export const slideInRight: Variants = {
  hidden: { x: '100%', opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  },
  exit: { x: '100%', opacity: 0, transition: { duration: 0.2 } },
};

// === Fade + Slide (general content) ===

export const fadeSlideIn: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 25 },
  },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15 } },
};

// === Wing Transition ===

export const wingTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 25 },
  },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15 } },
};

// === Stagger (card lists) ===

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.15,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 25 },
  },
};

// === Toast ===

export const toastSlideIn: Variants = {
  hidden: { x: '100%', opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 400, damping: 30 },
  },
  exit: { x: '100%', opacity: 0, transition: { duration: 0.2 } },
};

// === Reduced Motion Variants ===
// Opacity-only transitions for users who prefer reduced motion.
// Spring animations bypass CSS prefers-reduced-motion, so these
// must be used explicitly via useMotionConfig().

const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: instantTransition },
  exit: { opacity: 0, transition: instantTransition },
};

const noStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0 } },
};

export const reduced = {
  modalOverlay: fade,
  modalContent: fade,
  slideInRight: fade,
  fadeSlideIn: fade,
  staggerContainer: noStagger,
  staggerItem: fade,
  toastSlideIn: fade,
  wingTransition: fade,
} as const;

export const full = {
  modalOverlay,
  modalContent,
  slideInRight,
  fadeSlideIn,
  staggerContainer,
  staggerItem,
  toastSlideIn,
  wingTransition,
} as const;
