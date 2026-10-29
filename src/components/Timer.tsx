import { useEffect, useState } from 'react';

// Subtle elapsed seconds. Remount it (a new `key`) to restart; callers skip rendering it when the timer is off.
export function Timer({ running, onTick }: { running: boolean; onTick?: (seconds: number) => void }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (seconds > 0) onTick?.(seconds);
  }, [seconds, onTick]);

  return (
    <span aria-label="Time" className="text-sm tabular-nums text-slate-400">
      ⏱ {seconds}s
    </span>
  );
}
