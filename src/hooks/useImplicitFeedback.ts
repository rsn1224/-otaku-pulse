/**
 * @module useImplicitFeedback
 * @description Records implicit user feedback signals (impression, skip, dwell)
 * attached to an existing React ref.
 *
 * - impression: fires once when the element is visible for ≥1 second
 * - skip: fires on cleanup if impression was recorded but article was not opened
 *
 * Note: dwell is handled separately by the existing IntersectionObserver
 * in DiscoverCard.tsx (which already records 'view' interactions).
 */
import { useEffect, useRef } from 'react';
import { recordInteraction } from '../lib/tauri-commands';

const IMPRESSION_THRESHOLD_MS = 1_000;
const IMPRESSION_DEDUPE_ATTR = 'data-impression-recorded';

interface UseImplicitFeedbackOptions {
  articleId: number;
  /** Ref pointing to the card root element */
  elementRef: React.RefObject<HTMLElement | null>;
  /** True once the user has explicitly opened the article */
  opened: boolean;
}

export function useImplicitFeedback({
  articleId,
  elementRef,
  opened,
}: UseImplicitFeedbackOptions): void {
  const openedRef = useRef(opened);
  const impressionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const impressionRecordedRef = useRef(false);

  useEffect(() => {
    openedRef.current = opened;
  }, [opened]);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    // Deduplicate per element instance using a data attribute
    if (el.getAttribute(IMPRESSION_DEDUPE_ATTR) === '1') {
      impressionRecordedRef.current = true;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          if (!impressionRecordedRef.current && impressionTimerRef.current === null) {
            impressionTimerRef.current = setTimeout(() => {
              impressionTimerRef.current = null;
              if (!impressionRecordedRef.current) {
                impressionRecordedRef.current = true;
                el.setAttribute(IMPRESSION_DEDUPE_ATTR, '1');
                recordInteraction(articleId, 'impression').catch(() => {});
              }
            }, IMPRESSION_THRESHOLD_MS);
          }
        } else {
          if (impressionTimerRef.current !== null) {
            clearTimeout(impressionTimerRef.current);
            impressionTimerRef.current = null;
          }
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);

    return () => {
      observer.disconnect();

      if (impressionTimerRef.current !== null) {
        clearTimeout(impressionTimerRef.current);
        impressionTimerRef.current = null;
      }

      // Record skip if article was seen but not opened
      if (impressionRecordedRef.current && !openedRef.current) {
        recordInteraction(articleId, 'skip').catch(() => {});
      }
    };
    // elementRef.current は mount 時に確定するため deps から除外
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);
}
