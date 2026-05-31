// dashboard/components/Clock.tsx
// Live clock display for the Observatory topbar.

import { useState, useEffect } from 'react';

export default function Clock() {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="obs-clock">
      {t.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}