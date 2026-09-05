import { useVttStore } from '../store';
import { getSocket } from '../net/socket';

export function TargetCard() {
  const snapshot = useVttStore((s) => s.snapshot);
  const targetedTokenId = useVttStore((s) => s.targetedTokenId);
  const me = useVttStore((s) => s.me);
  const token = targetedTokenId && snapshot ? snapshot.tokens.find((t) => t.id === targetedTokenId) : undefined;
  const sheet = token && snapshot ? snapshot.sheets.find((s) => s.tokenId === token.id) : undefined;

  if (!me || !targetedTokenId || !token || (token.dead && !token.dying)) return null;

  const isDm = me.role === 'dm';
  const ratio = token.maxHp > 0 ? Math.max(0, Math.min(1, token.hp / token.maxHp)) : 0;
  const kindLabel = token.kind === 'monster' ? 'Monstro' : token.kind === 'npc' ? 'NPC' : token.kind === 'pc' ? 'Heroi' : token.kind;

  const emitDmg = (delta: number) => {
    if (delta === 0) return;
    getSocket().emit('token:damage', { id: token.id, amount: delta });
  };

  const emitSpellSlots = (delta: number) => {
    if (!sheet) return;
    getSocket().emit('sheet:editSpellSlots', { sheetId: sheet.id, delta });
  };

  return (
    <div className="corner-target panel" key={token.id}>
      <div className="corner-head">
        <strong>{token.name}</strong>
        <span className="muted">{kindLabel}</span>
      </div>

      <div className="hp-bar wide">
        <div className={`hp-fill ${ratio > 0.5 ? '' : ratio > 0.25 ? 'warn' : 'crit'}`} style={{ width: `${ratio * 100}%` }} />
      </div>

      {isDm ? (
        <div className="target-stats">
          <div className="target-stat-row">
            <span className="target-stat-label">HP</span>
            <button className="target-stat-btn" onClick={() => emitDmg(-1)}>−</button>
            <span className="target-stat-val">{token.hp}/{token.maxHp}</span>
            <button className="target-stat-btn" onClick={() => emitDmg(1)}>+</button>
          </div>
          <div className="target-stat-row">
            <span className="target-stat-label">CA</span>
            <span className="target-stat-val">{token.ac}</span>
          </div>
          {sheet && (
            <div className="target-stat-row">
              <span className="target-stat-label">Espaços</span>
              <button className="target-stat-btn" onClick={() => emitSpellSlots(-1)}>−</button>
              <span className="target-stat-val">{sheet.spellSlots.total - sheet.spellSlots.used}/{sheet.spellSlots.total}</span>
              <button className="target-stat-btn" onClick={() => emitSpellSlots(1)}>+</button>
            </div>
          )}
        </div>
      ) : (
        <span className="chip muted">{ratio > 0.5 ? 'Lutando firme' : ratio > 0.25 ? 'Ferido' : 'A beira da queda'}</span>
      )}

      {token.dead && <span className="chip">Morto</span>}
      {token.dying && <span className="chip">Morrendo</span>}
    </div>
  );
}
