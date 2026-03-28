import { useEffect, useRef } from 'react';

export function useFocusReturn(isActive: boolean): void {
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (isActive) {
      triggerRef.current = document.activeElement;
    } else if (triggerRef.current instanceof HTMLElement) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [isActive]);
}
