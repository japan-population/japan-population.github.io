import { useEffect, useState } from 'react';
export function useClock(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, intervalMs);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update); window.removeEventListener('focus', update); };
  }, [intervalMs]);
  return now;
}
