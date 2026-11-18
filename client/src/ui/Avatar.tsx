import type { AgentId } from '@pixel/shared';
import { AGENTS } from '@pixel/shared';

/** Small pixel portrait drawn with SVG rects from the agent's palette. */
export function Avatar({ id, size = 32 }: { id: AgentId; size?: number }) {
  const l = AGENTS[id].look;
  const hair = (() => {
    switch (l.hairStyle) {
      case 'bald':
        return <rect x="4" y="2" width="8" height="1" fill={l.skin} />;
      case 'long':
        return (
          <>
            <rect x="3" y="1" width="10" height="3" fill={l.hair} />
            <rect x="3" y="4" width="2" height="7" fill={l.hair} />
            <rect x="11" y="4" width="2" height="7" fill={l.hair} />
          </>
        );
      case 'bun':
        return (
          <>
            <rect x="6" y="0" width="4" height="2" fill={l.hair} />
            <rect x="4" y="2" width="8" height="2" fill={l.hair} />
          </>
        );
      case 'spiky':
        return (
          <>
            <rect x="4" y="1" width="8" height="3" fill={l.hair} />
            <rect x="4" y="0" width="2" height="1" fill={l.hair} />
            <rect x="7" y="0" width="2" height="1" fill={l.hair} />
            <rect x="10" y="0" width="2" height="1" fill={l.hair} />
          </>
        );
      case 'cap':
        return (
          <>
            <rect x="4" y="1" width="8" height="3" fill={l.accent} />
            <rect x="10" y="3" width="4" height="1" fill={l.accent} />
          </>
        );
      default:
        return <rect x="4" y="1" width="8" height="3" fill={l.hair} />;
    }
  })();
  return (
    <svg className="avatar" width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-label={AGENTS[id].name}>
      <rect width="16" height="16" fill="var(--avatar-bg)" />
      <rect x="2" y="12" width="12" height="4" fill={l.shirt} />
      <rect x="4" y="3" width="8" height="8" fill={l.skin} />
      <rect x="6" y="6" width="1" height="1" fill="#111" />
      <rect x="9" y="6" width="1" height="1" fill="#111" />
      <rect x="7" y="9" width="2" height="1" fill="#7a3b2e" />
      {hair}
    </svg>
  );
}
