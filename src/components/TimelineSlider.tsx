import type {InputHTMLAttributes} from 'react';

// All year selectors share this control and .timeline-range styling.
// Keep selection logic in each view; do not duplicate track/thumb styles there.
export function TimelineSlider({className='',...props}:Omit<InputHTMLAttributes<HTMLInputElement>,'type'>){
  return <input {...props} type="range" className={`timeline-range ${className}`.trim()}/>;
}
