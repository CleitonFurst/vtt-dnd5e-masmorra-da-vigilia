import { useEffect, useState } from 'react';
import { ABILITY_KEYS, ABILITY_LABELS, CLASS_BY_ID, WEAPON_BY_ID, ITEM_BY_ID, RACE_BY_ID, abilityMod, spellsForClass, type CharacterSheet, type Token } from '@vtt/shared';
import { getSocket } from '../net/socket';

interface Props {
  sheet: CharacterSheet;
  token?: Token;
  variant?: 'drawer' | 'dm';
}

const SAVE_ROWS: { code: string; label: string; key: 'fort' | 'ref' | 'will' }[] = [
  { code: 'FORT', label: 'Fortaleza', key: 'fort' },
  { code: 'REFL', label: 'Reflexos', key: 'ref' },
  { code: 'VONT', label: 'Vontade', key: 'will' },
];

/** Ficha visual inspirada no Gerador MdG (ficha-mdg.vercel.app): papel, tinta e caixas pretas. */
export function CharacterSheetCard({ sheet, token, variant = 'drawer' }: Props) {
  const socket = getSocket();
  const [hpDraft, setHpDraft] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    try {
      setNotes(localStorage.getItem(`mdg-notes-${sheet.tokenId}`) ?? '');
    } catch {
      /* ignora */
    }
  }, [sheet.tokenId]);

  const cls = CLASS_BY_ID.get(sheet.classId);
  const weapon = WEAPON_BY_ID.get(sheet.derived.weaponId);
  const hp = token?.hp ?? sheet.derived.maxHp;
  const maxHp = sheet.derived.maxHp;
  const ac = token?.ac ?? sheet.derived.ac;
  const dead = token?.dead ?? false;
  const downed = dead || hp === 0;
  const bba = sheet.derived.bba ?? sheet.derived.prof;

  const melee = bba + abilityMod(sheet.abilities.str);
  const ranged = bba + abilityMod(sheet.abilities.dex);
  const spells = spellsForClass(sheet.classId).filter((sp) =>
    !sheet.knownSpells?.length || sheet.knownSpells.includes(sp.slug)
  );
  const race = RACE_BY_ID.get(sheet.raceId);

  const commitHp = (): void => {
    if (hpDraft === null || !token) return setHpDraft(null);
    const lower = -(Math.max(10, sheet.abilities.con)); // PF: morre em −CON
    const target = Math.max(lower, Math.min(maxHp, Number(hpDraft) || 0));
    const delta = hp - target;
    if (delta !== 0) socket.emit('token:damage', { id: token.id, amount: delta });
    setHpDraft(null);
  };

  const saveNotes = (v: string): void => {
    setNotes(v);
    try {
      localStorage.setItem(`mdg-notes-${sheet.tokenId}`, v);
    } catch {
      /* ignora */
    }
  };

  return (
    <article className={`mdg-sheet ${downed ? 'mdg-dead' : ''}`} data-variant={variant}>
      <header className="mdg-header">
        <div className="mdg-logo" aria-hidden="true">
          ⛨
        </div>
        <div className="mdg-identity">
          <div className="field-line mdg-name">
            <span>Nome</span>
            <strong>{sheet.name}</strong>
          </div>
          <div className="field-line">
            <span>Classe</span>
            <strong>{cls?.name ?? sheet.classId} · nv {sheet.level}</strong>
          </div>
          <div className="field-line">
            <span>Raça</span>
            <strong>{sheet.raceId}</strong>
          </div>
        </div>
        <div className="mdg-header-stack">
          <div className="field-line small">
            <span>DVs</span>
            <strong>d{cls?.hd ?? 8}</strong>
          </div>
          <div className="field-line small">
            <span>Po</span>
            <strong>{token ? '3d6' : '—'}</strong>
          </div>
          <div className="field-line small">
            <span>Vel.</span>
            <strong>{sheet.derived.speedCells} cel.</strong>
          </div>
          <div className="field-line small">
            <span>Tam.</span>
            <strong>{sheet.derived.sizeCategory === 'small' ? 'P' : 'M'}</strong>
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
                <div className="ability-score">{sheet.abilities[k]}</div>
                <div className="ability-mod">
                  {abilityMod(sheet.abilities[k]) >= 0 ? '+' : ''}
                  {abilityMod(sheet.abilities[k])}
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
              <strong className="armor-value">{ac}</strong>
            </div>

            <div className={`mdg-dv-box ${downed ? 'is-down' : ''}`}>
              <div className="dv-static-row">
                <span className="dv-static-label">DVs</span>
                <strong>d{cls?.hd ?? 8}{abilityMod(sheet.abilities.con) >= 0 ? '+' : ''}{abilityMod(sheet.abilities.con)}</strong>
              </div>
              <span className="dv-label">{downed ? 'Caído' : 'PVs'}</span>
              {token && !downed ? (
                <div className="dv-value">
                  <input
                    className="dv-current"
                    inputMode="numeric"
                    value={hpDraft ?? String(hp)}
                    onChange={(e) => setHpDraft(e.target.value.replace(/[^-\d]/g, ''))}
                    onBlur={commitHp}
                    onKeyDown={(e) => e.key === 'Enter' && commitHp()}
                    aria-label="PVs atuais"
                  />
                  <span className="dv-separator">/</span>
                  <strong className="dv-maximum">{maxHp}</strong>
                </div>
              ) : (
                <div className="dv-value">
                  <strong>{hp}</strong>
                  <span className="dv-separator">/</span>
                  <strong className="dv-maximum">{maxHp}</strong>
                </div>
              )}
              <div className="mdg-hpbar">
                <div
                  className={`mdg-hpbar-fill ${hp / maxHp > 0.5 ? '' : hp / maxHp > 0.25 ? 'warn' : 'crit'}`}
                  style={{ width: `${Math.max(0, Math.min(100, (hp / maxHp) * 100))}%` }}
                />
              </div>
            </div>

            <div className="mdg-bba-box">
              <span className="bba-label">BBA</span>
              <strong className="bba-value">+{bba}</strong>
              <div className="attack-list">
                <div className="attack-row">
                  <span>Corpo-a-corpo</span>
                  <strong>{melee >= 0 ? '+' : ''}{melee}</strong>
                </div>
                <div className="attack-row">
                  <span>À distância</span>
                  <strong>{ranged >= 0 ? '+' : ''}{ranged}</strong>
                </div>
                {weapon && (
                  <div className="attack-row weapon">
                    <span>{weapon.name}</span>
                    <strong>{weapon.dmg}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mdg-saves">
          <h4>Salvaguardas</h4>
          <div className="mdg-save-table">
            {SAVE_ROWS.map((s) => {
              const v = sheet.derived[s.key];
              return (
                <div key={s.code} className="save-row">
                  <span className="save-value">{v}</span>
                  <span className="save-label">
                    <strong className="save-code">{s.code}</strong>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {spells.length > 0 && (
        <section className="mdg-classrules">
          <h4>Magias conhecidas — espaços {sheet.spellSlots.total - sheet.spellSlots.used}/{sheet.spellSlots.total}</h4>
          <ul className="mdg-spelllist">
            {spells.map((sp) => (
              <li key={sp.slug}>
                <strong>{sp.name}</strong>
                <em>{sp.mech?.kind === 'heal' ? 'cura' : sp.mech?.kind === 'auto' ? 'automática' : 'ataque'} · nv {sp.level}</em>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mdg-classrules">
        <h4>Perícias</h4>
        <p className="backstory-text">
          <strong>{sheet.derived.skillPoints}</strong> pontos de perícia por nível (base do {cls?.name ?? sheet.classId} + Int).
          Testes usam o d20: <strong>1d20 + mod</strong> contra a CD.
        </p>
      </section>

      <section className="mdg-classrules">
        <h4>Inventário</h4>
        <div className="inventory-list">
          {sheet.potions > 0 && (
            <div className="inv-item">
              <span className="inv-icon">🧪</span>
              <span className="inv-name">Poção de cura</span>
              <span className="inv-qty">×{sheet.potions}</span>
              <span className="inv-note">2d4+2</span>
            </div>
          )}
          {(sheet.inventory ?? []).map((item, i) => {
            const preset = ITEM_BY_ID.get(item.itemId);
            const emoji = item.category === 'shield' ? '🛡' : item.category === 'scroll' ? '📜' : item.category === 'grimoire' ? '📖' : '🔧';
            return (
              <div key={i} className={`inv-item ${item.equipped ? 'equipped' : ''}`}>
                <span className="inv-icon">{emoji}</span>
                <span className="inv-name">{item.name}</span>
                {item.quantity > 1 && <span className="inv-qty">×{item.quantity}</span>}
                {item.equipped && <span className="inv-equipped">装备</span>}
                {item.charges != null && <span className="inv-charges">{item.charges}/{item.maxCharges}</span>}
                {preset && <span className="inv-note">{preset.acBonus ? `+${preset.acBonus} CA` : preset.blurb.slice(0, 30)}</span>}
              </div>
            );
          })}
          {sheet.potions === 0 && (!sheet.inventory || sheet.inventory.length === 0) && (
            <p className="inv-empty">Nenhum item no inventário.</p>
          )}
        </div>
      </section>

      {race && race.traits.length > 0 && (
        <section className="mdg-classrules">
          <h4>Traços raciais — {race.name}</h4>
          <ul className="mdg-spelllist">
            {race.traits.map((t, i) => (
              <li key={i}>
                <strong>{t}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sheet.backstory && (
        <section className="mdg-classrules">
          <h4>História</h4>
          <p className="backstory-text">{sheet.backstory}</p>
        </section>
      )}

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
