import { useReducedMotion } from 'motion/react';
import { full, reduced, springTransition } from '../lib/motion-variants';

type MotionPresets = typeof full;

const noTransition = { duration: 0 };

/**
 * Returns the correct Motion variant set and spring transition
 * based on the user's OS-level prefers-reduced-motion setting.
 *
 * Usage:
 *   const { variants, spring } = useMotionConfig();
 *   <motion.div variants={variants.fadeSlideIn} transition={spring} />
 */
export function useMotionConfig(): { variants: MotionPresets; spring: typeof springTransition } {
  const shouldReduce = useReducedMotion();

  if (shouldReduce) {
    return { variants: reduced, spring: noTransition };
  }

  return { variants: full, spring: springTransition };
}
