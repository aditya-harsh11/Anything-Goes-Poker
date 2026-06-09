import { useEffect, useState } from 'react';

/**
 * Whole seconds remaining until `target` (a server epoch-ms timestamp), re-rendering a few
 * times a second so the number ticks down. Returns null when there's no target. Minor
 * client/server clock skew is acceptable here — it's a casual "next hand in Ns" hint.
 */
export function useCountdown(target?: number | null): number | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [target]);
  if (!target) return null;
  return Math.max(0, Math.ceil((target - Date.now()) / 1000));
}
