import { CLASS_BY_ID, WEAPON_BY_ID, abilityMod } from '@vtt/shared';
import { useVttStore } from '../store';

export function useMySheets() {
  const sheets = useVttStore((s) => s.snapshot?.sheets ?? []);
  const tokens = useVttStore((s) => s.snapshot?.tokens ?? []);
  const me = useVttStore((s) => s.me);
  if (!me) return [];
  return sheets.filter((sheet) => {
    const token = tokens.find((t) => t.id === sheet.tokenId);
    return me.role === 'dm' || (token?.ownerPlayerId !== undefined && token.ownerPlayerId === me.id);
  });
}

export function PlayerHud() {
  const sheetsCount = useVttStore((s) => s.snapshot?.sheets.length ?? 0);
  const me = useVttStore((s) => s.me);
  const setSideTab = useVttStore((s) => s.setSideTab);
  const setCreatorOpen = useVttStore((s) => s.setCreatorOpen);
  const mySheets = useMySheets();
  const primary = mySheets[0];
  const token = useVttStore((s) => {
    if (!primary) return undefined;
    return s.snapshot?.tokens.find((t) => t.id === primary.tokenId);
  });

  if (!me) return null;

  // DM: atalho para abrir a galeria completa
  if (me.role === 'dm') {
    return (
      <div className="player-hud">
        <button className="hud-open" onClick={() => setSideTab('sheets')}>
          Fichas ({sheetsCount})
        </button>
        <button className="hud-open subtle" onClick={() => setCreatorOpen(true)}>
          + Criar
        </button>
      </div>
    );
  }

  // Jogador sem ficha: chamada para criar
  if (!primary) {
    return (
      <div className="player-hud">
        <div className="panel hud-mini">
          <div className="hud-mini-head">
            <strong>Sem personagem</strong>
          </div>
          <p className="hint">Crie seu herói para entrar na aventura.</p>
          <button className="create-cta" onClick={() => setCreatorOpen(true)}>
            Criar meu personagem
          </button>
        </div>
      </div>
    );
  }

  const hp = token?.hp ?? primary.derived.maxHp;
  const maxHp = token?.maxHp ?? primary.derived.maxHp;
  const ac = token?.ac ?? primary.derived.ac;
  const dead = token?.dead ?? false;
  const dying = token?.dying ?? false;
  const stabilized = token?.stabilized ?? false;
  const downed = dead || hp === 0;
  const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;

  let statusLabel: string | null = null;
  if (dying && !stabilized) statusLabel = 'Morrendo (−1 PV/rodada)';
  else if (dying && stabilized) statusLabel = 'Estabilizado (inconsciente)';
  else if (dead) statusLabel = 'Morto';
  else if (hp === 0) statusLabel = 'Caído (0 PV)';

  return (
    <div className="player-hud">
      <div className={`panel hud-mini ${downed ? 'is-dead' : ''}`}>
        <div className="hud-mini-head">
          <strong>{primary.name}</strong>
          <span className="muted">
            {CLASS_BY_ID.get(primary.classId)?.name ?? primary.classId} nv {primary.level}
          </span>
        </div>
        <div className="hud-mini-body">
          <div className="ac-box small">
            <span className="ac-value">{ac}</span>
            <span>CA</span>
          </div>
          <div className="hp-block">
            <div className="hp-text">
              HP {hp}/{maxHp} {statusLabel && <em className="dead-tag">{statusLabel}</em>}
            </div>
            <div className="hp-bar">
              <div
                className={`hp-fill ${ratio > 0.5 ? '' : ratio > 0.25 ? 'warn' : 'crit'}`}
                style={{ width: `${ratio * 100}%` }}
              />
            </div>
          </div>
        </div>
        {downed && (
          <div className="death-save-ui">
            <div className="death-save-status">
              {dying && !stabilized ? `${primary.name} está morrendo (${hp} PV).` : `${primary.name}: ${statusLabel}`}
            </div>
          </div>
        )}
        {mySheets.length > 1 && <span className="chip">{mySheets.length} personagens</span>}
        <div className="hud-quick">
          <span className="chip">
            Espaços: {primary.spellSlots.total - primary.spellSlots.used}/{primary.spellSlots.total}
          </span>
          <span className="chip muted">
            {(() => {
              const w = WEAPON_BY_ID.get(primary.derived.weaponId);
              const isRanged = w?.ranged;
              const isFinesse = w?.properties.includes('finesse');
              const strMod = abilityMod(primary.abilities.str);
              const dexMod = abilityMod(primary.abilities.dex);
              const abilityBonus = isRanged ? dexMod : isFinesse ? Math.max(strMod, dexMod) : strMod;
              const bba = primary.derived.bba ?? primary.derived.prof;
              return `${w?.name ?? 'Adaga'} +${bba + abilityBonus}`;
            })()}
          </span>
        </div>
        <button className="hud-open" onClick={() => useVttStore.getState().setOpenSheet(primary.tokenId)}>
          Abrir ficha
        </button>
      </div>
    </div>
  );
}
