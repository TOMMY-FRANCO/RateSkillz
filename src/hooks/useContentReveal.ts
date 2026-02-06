import { useState, useCallback, useEffect } from 'react';

export function useContentReveal() {
  const [revealed, setRevealed] = useState(false);

  const reveal = useCallback(() => {
    requestAnimationFrame(() => setRevealed(true));
  }, []);

  const reset = useCallback(() => {
    setRevealed(false);
  }, []);

  return { revealed, reveal, reset } as const;
}

export function useSlowLoad(loading: boolean, threshold = 3000) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!loading) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), threshold);
    return () => clearTimeout(timer);
  }, [loading, threshold]);

  return slow;
}
