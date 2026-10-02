import type { EventKind } from '../types/statistics';
import type { MovementKind } from '../lib/movement';
const PLANE_PATH = 'M12 2Q10.5 2 10.5 4V9L2 14V16L10.5 13.5V19L7 21V22L12 20.5L17 22V21L13.5 19V13.5L22 16V14L13.5 9V4Q13.5 2 12 2Z';
export function EventIcon({kind}:{kind:EventKind | MovementKind}) {
  const isMovement = kind==='inflow'||kind==='outflow';
  const paths = {
    birth:'M5 19 19 5M7 5h12v12',
    death:'M5 5 19 19M7 19h12V7',
    inflow:PLANE_PATH,
    outflow:PLANE_PATH,
    divorce:'M4 8h16M16 4l4 4-4 4M20 16H4M8 12l-4 4 4 4',
  };
  return <span className="event-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill={isMovement?'currentColor':'none'} stroke={isMovement?'none':'currentColor'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{kind==='marriage'?<><circle cx="8" cy="12" r="5"/><circle cx="16" cy="12" r="5"/></>:<path d={paths[kind]} transform={kind==='inflow'?'rotate(180 12 12)':undefined}/>}</svg></span>;
}
