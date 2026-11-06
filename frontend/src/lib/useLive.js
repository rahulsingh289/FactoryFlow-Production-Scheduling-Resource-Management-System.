import { useEffect, useRef } from 'react';

// Loads a page's data now, then again every few seconds while the tab is in
// view, so the page stays current when something changes elsewhere (another
// person, or an order finishing). The repeat loads are quiet: `load(true)`
// should refresh the data without showing an error banner. A repeat load is
// skipped while the previous one is still waiting, so a slow connection never
// piles up requests.
export default function useLive(load, ms = 8000) {
  const latest = useRef(load);
  latest.current = load;
  useEffect(() => {
    let busy = false;
    let alive = true;
    latest.current();
    const timer = setInterval(async () => {
      if (busy || document.hidden || !alive) return;
      busy = true;
      try { await latest.current(true); } finally { busy = false; }
    }, ms);
    return () => { alive = false; clearInterval(timer); };
  }, [ms]);
}
