// ─────────────────────────────────────────────────────────────────────────────
// useCount.ts — animated counter hook
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react';

export function useCount(target: number, duration = 900): number {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) {
      setCount(0);
      return;
    }

    const startTime = performance.now();
    const startValue = 0;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out cubic)
      const eased = 1 - Math.pow(1 - progress, 3);
      
      const current = Math.floor(startValue + (target - startValue) * eased);
      setCount(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target, duration]);

  return count;
}

export default useCount;
