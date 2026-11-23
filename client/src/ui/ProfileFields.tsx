import type { ProjectProfile } from '@pixel/shared';

/** Engines the knowledge router understands, with the studio's compatibility baselines. */
export const ENGINE_OPTIONS: { id: NonNullable<ProjectProfile['engine']>; label: string; baseline: string }[] = [
  { id: '', label: 'Not decided yet', baseline: '' },
  { id: 'unreal', label: 'Unreal Engine', baseline: '5.4' },
  { id: 'unity', label: 'Unity', baseline: '6 or 2022.3 LTS' },
  { id: 'phaser', label: 'Phaser', baseline: '3.90' },
  { id: 'web', label: 'Vanilla web (canvas + ES modules)', baseline: '' },
  { id: 'godot', label: 'Godot (no studio knowledge pack)', baseline: '' },
  { id: 'other', label: 'Other / custom engine', baseline: '' },
];

const GENRES = ['', 'Roguelite', 'Platformer', 'Puzzle', 'RPG', 'Shooter', 'Strategy', 'Idle / mobile casual'];
const PLATFORMS = ['', 'PC', 'Web browser', 'Mobile (iOS/Android)', 'Console', 'PC + console', 'Cross-platform'];
const PROJECT_TYPES = ['', 'Prototype', 'Game jam', 'Vertical slice', 'Full production', 'Live game / update'];

/** Structured project profile used by the knowledge router. Every field is optional. */
export function ProfileFields({ value, onChange }: { value: ProjectProfile; onChange: (v: ProjectProfile) => void }) {
  const set = (k: keyof ProjectProfile, v: string) => onChange({ ...value, [k]: v });
  const engine = ENGINE_OPTIONS.find((e) => e.id === (value.engine ?? '')) ?? ENGINE_OPTIONS[0];
  const listOrCustom = (options: string[], current: string | undefined) => (current && !options.includes(current) ? [...options, current] : options);
  return (
    <fieldset className="profile-fields">
      <legend>Project profile (used to route engine, genre and discipline knowledge)</legend>
      <div className="row">
        <label>
          Engine
          <select value={value.engine ?? ''} onChange={(e) => set('engine', e.target.value)}>
            {ENGINE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Engine version
          <input
            value={value.engineVersion ?? ''}
            onChange={(e) => set('engineVersion', e.target.value)}
            placeholder={engine.baseline ? `studio baseline: ${engine.baseline}` : 'e.g. 5.4'}
            maxLength={40}
          />
        </label>
        <label>
          Platform
          <select value={value.platform ?? ''} onChange={(e) => set('platform', e.target.value)}>
            {listOrCustom(PLATFORMS, value.platform).map((o) => (
              <option key={o} value={o}>
                {o || '—'}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="row">
        <label>
          Primary genre
          <select value={value.primaryGenre ?? ''} onChange={(e) => set('primaryGenre', e.target.value)}>
            {listOrCustom(GENRES, value.primaryGenre).map((o) => (
              <option key={o} value={o}>
                {o || '—'}
              </option>
            ))}
          </select>
        </label>
        <label>
          Secondary genre (optional)
          <select value={value.secondaryGenre ?? ''} onChange={(e) => set('secondaryGenre', e.target.value)}>
            {listOrCustom(GENRES, value.secondaryGenre).map((o) => (
              <option key={o} value={o}>
                {o || '—'}
              </option>
            ))}
          </select>
        </label>
        <label>
          Project type
          <select value={value.projectType ?? ''} onChange={(e) => set('projectType', e.target.value)}>
            {listOrCustom(PROJECT_TYPES, value.projectType).map((o) => (
              <option key={o} value={o}>
                {o || '—'}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Programming approach
        <input
          value={value.programmingApproach ?? ''}
          onChange={(e) => set('programmingApproach', e.target.value)}
          placeholder="e.g. C++ core + Blueprints for content · TypeScript · C# with ScriptableObjects"
          maxLength={200}
        />
      </label>
      {engine.baseline && value.engineVersion && (
        <div className="muted small">Studio engine knowledge targets {engine.label} {engine.baseline}; references for other versions are excluded or flagged.</div>
      )}
    </fieldset>
  );
}

export function profileSummary(p: ProjectProfile | undefined) {
  if (!p) return '';
  const e = ENGINE_OPTIONS.find((o) => o.id === p.engine);
  return [
    e && p.engine ? `${e.label.replace(/ \(.*\)$/, '')}${p.engineVersion ? ` ${p.engineVersion}` : ''}` : '',
    p.platform,
    p.primaryGenre ? `${p.primaryGenre}${p.secondaryGenre ? ` / ${p.secondaryGenre}` : ''}` : '',
    p.programmingApproach,
    p.projectType,
  ]
    .filter(Boolean)
    .join(' · ');
}
