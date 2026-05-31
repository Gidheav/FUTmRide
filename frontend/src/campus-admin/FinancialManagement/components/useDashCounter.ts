// dashboard/components/useDashCounter.ts
// Animated counter hook for Observatory KPI cards.
// Uses Date.now() + cubic ease-out; fires via requestAnimationFrame.
// NOTE: The shared hooks/useCount.ts uses performance.now() — keep them separate.

import { useState, useEffect } from 'react';

export function useDashCounter(target: number, duration = 800): number {
  const [val, setVal] = useState(0);

  useEffect(() => {
    const start = Date.now();
    let raf: number;

    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - pct, 3);
      setVal(Math.round(target * ease));
      if (pct < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return val;
}