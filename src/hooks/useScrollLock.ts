import { useEffect } from 'react';

export function useScrollLock(isActive: boolean): void {
  useEffect(() => {
    if (!isActive) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isActive]);
}
