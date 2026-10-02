import { useEffect, useState } from "react";

/** Re-renders every `intervalMs` so countdowns tick. Display only: the SERVER decides expiry. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
