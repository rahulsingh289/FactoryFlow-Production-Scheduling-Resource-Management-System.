import { useEffect, useRef } from 'react';

// Loads a page's data now, then again every few seconds while the tab is in
// view, so the page stays current when something changes elsewhere (another
// person, or an order finishing). The repeat loads are quiet: `load(true)`
// should refresh the data without showing an error banner.
export default function useLive(load, ms = 8000) {
  const latest = useRef(load);
  latest.current = load;
  useEffect(() => {
    latest.current();
    const timer = setInterval(() => { if (!document.hidden) latest.current(true); }, ms);
    return () => clearInterval(timer);
  }, [ms]);
}
