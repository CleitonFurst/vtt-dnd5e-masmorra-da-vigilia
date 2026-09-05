import { useEffect, useState } from 'react';
import { ABILITY_KEYS, ABILITY_LABELS, SRD_MONSTERS, abilityMod, type Token } from '@vtt/shared';
import { getSocket } from '../net/socket';

interface Props {
  token: Token;
  isDm?: boolean;
}

/** Ficha de monstro com o MESMO visual da ficha MdG dos heróis (papel, tinta e caixas pretas).
 *  Atributos/ataques vêm das estatísticas SRD quando o nome casa; senão usa padrões genéricos
 *  coerentes com a lógica de ataque do servidor (+4, 1d6+2). */
export function MonsterSheetCard({ token, isDm = false }: Props) {
  const socket = getSocket();
  const [hpDraft, setHpDraft] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [usedAttacks, setUsedAttacks] = useState<Set<number>>(new Set());

  useEffect(() => {
    try {
      setNotes(localStorage.getItem(`mdg-notes-${token.id}`) ?? '');
    } catch {
      /* ignora */
    }
  }, [token.id]);

  const srd = SRD_MONSTERS.find(
    (m) => m.name.localeCompare(token.name, 'pt-BR', { sensitivity: 'base' }) === 0,
  );
  const abil = srd?.abil ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const monsterAtks = token.attacks?.length ? token.attacks : (srd?.attacks ?? [{ name: 'Ataque', bonus: 4, dmgDice: '1d6', dmgMod: 2, rangeCells: 1 }]);
  const cr = srd?.cr ?? '—';

  const hp = token.hp;
  const maxHp = Math.max(1, token.maxHp);
  const dead = token.dead;
  const dying = token.dying ?? false;
  const stabilized = token.stabilized ?? false;
  const downed = dead || hp === 0;
  const speedCells = token.speedCells ?? 6;

  const hpStateLabel = dying && !stabilized ? 'Morrendo' : dying && stabilized ? 'Estável' : dead ? 'Morto' : hp === 0 ? 'Caído' : 'PVs';

  const commitHp = (): void => {
    if (hpDraft === null) return;
    const lower = -(Math.max(10, abil.con)); // PF: morre em −CON
    const target = Math.max(lower, Math.min(maxHp, Number(hpDraft) || 0));
    const delta = hp - target;
    if (delta !== 0) socket.emit('token:damage', { id: token.id, amount: delta });
    setHpDraft(null);
  };

  const saveNotes = (v: string): void => {
    setNotes(v);
    try {
      localStorage.setItem(`mdg-notes-${token.id}`, v);
    } catch {
      /* ignora */
    }
  };

  return (
    <article className={`mdg-sheet ${downed ? 'mdg-dead' : ''}`} data-variant="drawer">
      <header className="mdg-header">
        <div className="mdg-logo" aria-hidden="true">
          ☠
        </div>
        <div className="mdg-identity">
          <div className="field-line mdg-name">
            <span>Nome</span>
            <strong>{token.name}</strong>
          </div>
          <div className="field-line">
            <span>Tipo</span>
            <strong>{token.kind === 'npc' ? 'NPC' : 'Monstro'} · ND {cr}</strong>
          </div>
          <div className="field-line">
            <span>Tamanho</span>
            <strong>{token.sizeCells === 2 ? 'Grande (2×2)' : 'Médio (1×1)'}</strong>
          </div>
        </div>
        <div className="mdg-header-stack">
          <div className="field-line small">
            <span>ND</span>
            <strong>{cr}</strong>
          </div>
          <div className="field-line small">
            <span>Po</span>
            <strong>—</strong>
          </div>
          <div className="field-line small">
            <span>Vel.</span>
            <strong>{speedCells} cel.</strong>
          </div>
        </div>
      </header>

      <main className="mdg-main">
        <section className="mdg-abilities">
          <h4>Atributos</h4>
          <div className="mdg-ability-table">
            <div className="ability-head" />
            <div className="ability-head">Valor</div>
            <div className="ability-head">Mod.</div>
            {ABILITY_KEYS.map((k) => (
              <div key={k} className="mdg-ability-row">
                <div className="ability-name" title={ABILITY_LABELS[k]}>
                  {ABILITY_LABELS[k].slice(0, 3).toUpperCase()}
                </div>
                <div className="ability-score">{abil[k]}</div>
                <div className="ability-mod">
                  {abilityMod(abil[k]) >= 0 ? '+' : ''}
                  {abilityMod(abil[k])}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mdg-combat">
          <h4>Combate</h4>
          <div className="mdg-hit-area">
            <div className="mdg-armor-box" title="Classe de Armadura">
              <span className="mdg-shield">🛡</span>
              <span className="armor-label">CA</span>
              <strong className="armor-value">{token.ac}</strong>
            </div>

            <div className={`mdg-dv-box ${downed ? 'is-down' : ''}`}>
              <div className="dv-static-row">
                <span className="dv-static-label">DVs</span>
                <strong>d8{abilityMod(abil.con) >= 0 ? '+' : ''}{abilityMod(abil.con)}</strong>
              </div>
              <span className="dv-label">{hpStateLabel}</span>
              <div className="dv-value">
                {isDm && !downed ? (
                  <input
                    className="dv-current"
                    inputMode="numeric"
                    value={hpDraft ?? String(hp)}
                    onChange={(e) => setHpDraft(e.target.value.replace(/[^-\d]/g, ''))}
                    onBlur={commitHp}
                    onKeyDown={(e) => e.key === 'Enter' && commitHp()}
                    aria-label="PVs atuais"
                  />
                ) : (
                  <strong>{hp}</strong>
                )}
                <span className="dv-separator">/</span>
                <strong className="dv-maximum">{maxHp}</strong>
              </div>
              <div className="mdg-hpbar">
                <div
                  className={`mdg-hpbar-fill ${hp / maxHp > 0.5 ? '' : hp / maxHp > 0.25 ? 'warn' : 'crit'}`}
                  style={{ width: `${Math.max(0, Math.min(100, (hp / maxHp) * 100))}%` }}
                />
              </div>
            </div>

            <div className="mdg-bba-box">
              <span className="bba-label">ATQ</span>
              <strong className="bba-value">+{monsterAtks[0]?.bonus ?? 4}</strong>
              <div className="attack-list">
                {monsterAtks.map((a, i) => (
                  <div key={i} className={`attack-row weapon ${usedAttacks.has(i) ? 'attack-used' : ''}`}>
                    {isDm && (
                      <button
                        className="attack-toggle"
                        title={usedAttacks.has(i) ? 'Marcar como não usado' : 'Marcar como usado'}
                        onClick={() => setUsedAttacks((prev) => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i); else next.add(i);
                          return next;
                        })}
                      >
                        {usedAttacks.has(i) ? '✓' : '○'}
                      </button>
                    )}
                    <span>{a.name}</span>
                    <strong>+{a.bonus} | {a.dmgDice}{a.dmgMod > 0 ? `+${a.dmgMod}` : ''}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mdg-saves">
          <h4>Salvaguardas</h4>
          <div className="mdg-save-table">
            {(
              [
                { code: 'FORT', label: 'Fortaleza', mod: abilityMod(abil.con) },
                { code: 'REFL', label: 'Reflexos', mod: abilityMod(abil.dex) },
                { code: 'VONT', label: 'Vontade', mod: abilityMod(abil.wis) },
              ] as const
            ).map((s) => (
              <div key={s.code} className="save-row">
                <span className="save-value">{10 + s.mod}</span>
                <span className="save-label">
                  <strong className="save-code">{s.code}</strong>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <textarea
        className="mdg-postit"
        placeholder="Anotações no post-it…"
        value={notes}
        onChange={(e) => saveNotes(e.target.value)}
        spellCheck={false}
      />
    </article>
  );
}
