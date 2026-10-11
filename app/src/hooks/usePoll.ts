// Poll an async fetcher every `ms` while `active`; returns the latest data/error.
import { useCallback, useEffect, useRef, useState } from 'react';

export function usePoll<T>(fetcher: () => Promise<T>, ms = 3000, active = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const fn = useRef(fetcher);
  fn.current = fetcher;

  const refresh = useCallback(async () => {
    try {
      setData(await fn.current());
      setError(null);
    } catch (e) {
      setError(e as Error);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    refresh();
    const id = setInterval(refresh, ms);
    return () => clearInterval(id);
  }, [active, ms, refresh]);

  return { data, error, refresh };
}
