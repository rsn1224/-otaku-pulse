import { useEffect, useRef, useState } from 'react';

/** 値のデバウンス（IME 変換中は発火しない） */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

/** IME compositionend を考慮した入力フック */
export function useCompositionAware(): {
  isComposing: boolean;
  handlers: {
    onCompositionStart: () => void;
    onCompositionEnd: () => void;
  };
} {
  const isComposingRef = useRef(false);
  const [isComposing, setIsComposing] = useState(false);

  return {
    isComposing,
    handlers: {
      onCompositionStart: () => {
        isComposingRef.current = true;
        setIsComposing(true);
      },
      onCompositionEnd: () => {
        isComposingRef.current = false;
        setIsComposing(false);
      },
    },
  };
}
