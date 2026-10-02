import type { EventKind } from '../types/statistics';
import type { MovementKind } from '../lib/movement';
export function EventIcon({kind}:{kind:EventKind | MovementKind}) {
  const paths = {
    birth:'M5 19 19 5M7 5h12v12',
    death:'M5 5 19 19M7 19h12V7',
    inflow:'M12 20V4M5 11l7-7 7 7',
    outflow:'M12 4v16M5 13l7 7 7-7',
    divorce:'M4 8h16M16 4l4 4-4 4M20 16H4M8 12l-4 4 4 4',
  };
  return <span className="event-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{kind==='marriage'?<><circle cx="8" cy="12" r="5"/><circle cx="16" cy="12" r="5"/></>:<path d={paths[kind]}/>}</svg></span>;
}
