import { useMemo, useRef, useState } from 'react';
import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  ARMOR_PRESETS,
  CLASS_PRESETS,
  ITEM_PRESETS,
  POINT_BUY_BUDGET,
  RACES,
  WEAPON_PRESETS,
  SRD_SPELLS,
  spellsForClass,
  abilityMod,
  applyRacialMods,
  computeDerivedSheet,
  parseMdGJson,
  pointBuyCost,
  type AbilityKey,
  type MdGParsedSheet,
  type WeaponPreset,
} from '@vtt/shared';
import type { SheetCreateInputMsg } from '@vtt/shared';
import { getSocket } from '../net/socket';
import { useVttStore } from '../store';

const STEPS = ['Raça', 'Classe', 'Atributos', 'Equipamento', 'Magias', 'Aparência', 'Resumo'] as const;

/** nº de truques e magias nv 1 que cada classe escolhe no nv 1 (simplificado) */
const SPELL_QUOTA: Record<string, { cantrips: number; spells: number }> = {
  mago:    { cantrips: 3, spells: 2 },
  clerigo: { cantrips: 3, spells: 2 },
  druida:  { cantrips: 2, spells: 2 },
  bardo:   { cantrips: 2, spells: 2 },
  paladino:{ cantrips: 0, spells: 1 },
  ladino:  { cantrips: 0, spells: 0 },
  guerreiro:{ cantrips: 0, spells: 0 },
  barbaro: { cantrips: 0, spells: 0 },
};

const defaultBase = (): Record<AbilityKey, number> => ({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });

const WEAPON_LABEL: Record<string, string> = {
  'simple-melee': 'Simples corpo a corpo',
  'simple-ranged': 'Simples distância',
  'martial-melee': 'Marcial corpo a corpo',
  'martial-ranged': 'Marcial distância',
};

const PROP_LABELS: Record<string, string> = {
  finesse: 'Finessa (FOR/DES)',
  light: 'Leve',
  thrown: 'Arremessável',
  'two-handed': 'Duas mãos',
  versatile: 'Versátil',
  loading: 'Recarga',
  reach: 'Alcance',
};

export function CreatorModal() {
  const creatorOpen = useVttStore((s) => s.creatorOpen);
  const setCreatorOpen = useVttStore((s) => s.setCreatorOpen);
  const snapshot = useVttStore((s) => s.snapshot);

  const [mode, setMode] = useState<'forge' | 'import'>('forge');
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [raceId, setRaceId] = useState('humano');
  const [classId, setClassId] = useState('guerreiro');
  const [base, setBase] = useState<Record<AbilityKey, number>>(defaultBase());
  const [armorId, setArmorId] = useState<string | undefined>(undefined);
  const [weaponId, setWeaponId] = useState<string | undefined>(undefined);
  const [shieldId, setShieldId] = useState<string | undefined>(undefined);
  const [selectedSpells, setSelectedSpells] = useState<string[]>([]);
  const [backstory, setBackstory] = useState('');
  const [errors, setErrors] = useState<{ field: string; message: string }[]>([]);
  const [mdgText, setMdgText] = useState('');
  const [mdgParsed, setMdgParsed] = useState<MdGParsedSheet | null>(null);
  const [mdgError, setMdgError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const socket = getSocket();

  const cls = CLASS_PRESETS.find((c) => c.id === classId);
  const race = RACES.find((r) => r.id === raceId);
  const finals = useMemo(() => applyRacialMods(base, raceId), [base, raceId]);
  const spent = ABILITY_KEYS.reduce((sum, k) => sum + (pointBuyCost(base[k]) || 0), 0);
  const preview = useMemo(
    () =>
      computeDerivedSheet({
        name: name || 'Herói',
        raceId,
        classId,
        baseAbilities: base,
        armorId,
        weaponId,
        shieldId,
        mdg: mode === 'import' && mdgParsed ? { hpMax: mdgParsed.hpMax } : undefined,
      }),
    [name, raceId, classId, base, armorId, weaponId, shieldId, mode, mdgParsed],
  );

  /** armas disponíveis para a classe selecionada */
  const availableWeapons = useMemo(() => {
    return WEAPON_PRESETS.filter((w) => {
      if (w.category.startsWith('simple')) return true;
      return !w.nonProficient?.includes(classId);
    });
  }, [classId]);

  /** magias disponíveis para seleção */
  const availableSpells = useMemo(() => {
    const all = spellsForClass(classId);
    return { cantrips: all.filter((s) => s.level === 0), spells: all.filter((s) => s.level === 1) };
  }, [classId]);

  const quota = SPELL_QUOTA[classId] ?? { cantrips: 0, spells: 0 };
  const cantripCount = selectedSpells.filter((s) => { const sp = SRD_SPELLS.find((x) => x.slug === s); return sp && sp.level === 0; }).length;
  const spellCount = selectedSpells.filter((s) => { const sp = SRD_SPELLS.find((x) => x.slug === s); return sp && sp.level === 1; }).length;

  const groupedWeapons = useMemo(() => {
    const groups: Record<string, WeaponPreset[]> = {};
    for (const w of availableWeapons) {
      (groups[w.category] ??= []).push(w);
    }
    return groups;
  }, [availableWeapons]);

  if (!creatorOpen) return null;

  const readMdGFile = (file: File): void => {
    const reader = new FileReader();
    reader.onload = () => setMdgText(String(reader.result ?? ''));
    reader.readAsText(file);
  };

  const runParse = (): void => {
    setMdgError('');
    const res = parseMdGJson(mdgText);
    if (!res.ok) {
      setMdgParsed(null);
      setMdgError(res.error);
      return;
    }
    setMdgParsed(res.sheet);
    setName(res.sheet.name);
    setClassId(res.sheet.classId);
    setBase({ ...res.sheet.abilities });
  };

  const submitImport = (): void => {
    if (!mdgParsed) return;
    setErrors([]);
    const payload: SheetCreateInputMsg = {
      name: name.trim() || mdgParsed.name,
      raceId,
      classId: mdgParsed.classId,
      baseAbilities: mdgParsed.abilities,
      mdg: { hpMax: mdgParsed.hpMax },
    };
    socket.emit('sheet:create', payload, (res) => {
      if (!res.ok) {
        setErrors(res.errors ?? []);
        return;
      }
      setMdgParsed(null);
      setMdgText('');
      setMode('forge');
      setCreatorOpen(false);
    });
  };

  const canAdvance = (): boolean => {
    if (step === 0) return Boolean(raceId);
    if (step === 1) return Boolean(classId);
    if (step === 2) return spent <= POINT_BUY_BUDGET && ABILITY_KEYS.every((k) => base[k] >= 8 && base[k] <= 15);
    if (step === 3) return Boolean(weaponId);
    if (step === 4) return cantripCount === quota.cantrips && spellCount === quota.spells;
    return true;
  };

  const suggestAttributes = (): void => {
    if (!cls) return;
    const next = defaultBase();
    next[cls.primary[0]] = 15;
    if (cls.primary[1]) next[cls.primary[1]] = Math.min(14, next[cls.primary[1]] + 4);
    if (!cls.primary.includes('con')) next.con = 13;
    else next.con = 14;
    setBase(next);
  };

  const toggleSpell = (slug: string): void => {
    const sp = SRD_SPELLS.find((x) => x.slug === slug);
    if (!sp) return;
    const isCantrip = sp.level === 0;
    const count = isCantrip ? cantripCount : spellCount;
    const max = isCantrip ? quota.cantrips : quota.spells;
    if (selectedSpells.includes(slug)) {
      setSelectedSpells((s) => s.filter((x) => x !== slug));
    } else if (count < max) {
      setSelectedSpells((s) => [...s, slug]);
    }
  };

  const submit = (): void => {
    setErrors([]);
    const payload: SheetCreateInputMsg = {
      name: name.trim(),
      raceId,
      classId,
      baseAbilities: base,
      armorId,
      weaponId,
      shieldId,
      knownSpells: selectedSpells.length > 0 ? selectedSpells : undefined,
      backstory: backstory.trim() || undefined,
    };
    socket.emit('sheet:create', payload, (res) => {
      if (!res.ok) {
        setErrors(res.errors ?? []);
        return;
      }
      setCreatorOpen(false);
    });
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && setCreatorOpen(false)}>
      <div className="panel creator">
        <div className="creator-head">
          <h3>Forje seu herói</h3>
          <div className="mode-tabs">
            <button className={mode === 'forge' ? 'on' : ''} onClick={() => setMode('forge')}>
              ⚒ Forja
            </button>
            <button className={mode === 'import' ? 'on' : ''} onClick={() => setMode('import')}>
              📜 Importar MdG
            </button>
          </div>
        </div>

        {mode === 'import' ? (
          <div className="creator-body">
            <div className="mdg-import">
              <p className="hint">
                No site <strong>ficha-mdg.vercel.app</strong>, gere a ficha e use <em>Exportar → Gerador MdG</em>. Cole o JSON aqui.
              </p>
              <textarea
                className="mdg-textarea"
                rows={7}
                spellCheck={false}
                placeholder='{ "app": "Gerador MdG", "type": "gerador-mdg-character", ... }'
                value={mdgText}
                onChange={(e) => {
                  setMdgText(e.target.value);
                  setMdgParsed(null);
                  setMdgError('');
                }}
              />
              <div className="mdg-actions">
                <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && readMdGFile(e.target.files[0])} />
                <button className="small" onClick={() => fileRef.current?.click()}>
                  Abrir arquivo…
                </button>
                <button className="btn-gold small" disabled={!mdgText.trim()} onClick={runParse}>
                  Ler ficha
                </button>
              </div>

              {mdgError && <p className="error">{mdgError}</p>}

              {mdgParsed && (
                <div className="mdg-preview">
                  <label>
                    Nome do herói
                    <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} />
                  </label>
                  <div className="mdg-classline">
                    <span>
                      Classe detectada: <strong>{mdgParsed.className}</strong>
                    </span>
                    <label className="inline">
                      Raça
                      <select value={raceId} onChange={(e) => setRaceId(e.target.value)}>
                        {RACES.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="summary-stats">
                    {ABILITY_KEYS.map((k) => (
                      <div key={k}>
                        <span>{ABILITY_LABELS[k].slice(0, 3)}</span>
                        <strong>{mdgParsed.abilities[k]}</strong>
                      </div>
                    ))}
                    <div><span>PV</span><strong>{preview.maxHp}</strong></div>
                    <div><span>CA</span><strong>{preview.ac}</strong></div>
                    <div><span>Inic.</span><strong>{preview.initiative >= 0 ? '+' : ''}{preview.initiative}</strong></div>
                    {mdgParsed.hpMax && <div><span>PV ficha</span><strong>{mdgParsed.hpMax}</strong></div>}
                  </div>
                  {mdgParsed.warnings.length > 0 && (
                    <ul className="mdg-warnings">
                      {mdgParsed.warnings.slice(0, 4).map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}
                  <button className="btn-gold" onClick={submitImport}>
                    ⚔ Entrar na masmoura com esta ficha
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
        <>
        <div className="creator-head">
          <div className="steps">
            {STEPS.map((label, i) => (
              <button key={label} className={`step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`} onClick={() => i < step && setStep(i)}>
                <span className="step-num">{i < step ? '✓' : i + 1}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="creator-body">
          {/* ---- Raça ---- */}
          {step === 0 && (
            <div className="choice-grid">
              {RACES.map((r) => (
                <button key={r.id} className={`choice ${raceId === r.id ? 'selected' : ''}`} onClick={() => setRaceId(r.id)}>
                  <strong>{r.name}</strong>
                  <span className="race-mods">
                    {r.id === 'humano' ? '+1 todos' : Object.entries(r.mods).map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${ABILITY_LABELS[k as AbilityKey].slice(0, 3)}`).join(' · ')}
                  </span>
                  <em>{r.blurb}</em>
                  {r.traits.length > 0 && (
                    <div className="race-traits">
                      {r.traits.map((t, i) => <span key={i} className="trait-tag">{t}</span>)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* ---- Classe ---- */}
          {step === 1 && (
            <div className="choice-grid cols-2">
              {CLASS_PRESETS.map((c) => (
                <button key={c.id} className={`choice ${classId === c.id ? 'selected' : ''}`} onClick={() => setClassId(c.id)}>
                  <strong>{c.name}</strong>
                  <span className="race-mods">d{c.hd} · {c.spellcasting ? 'conjurador' : 'marcial'} · {ABILITY_LABELS[c.primary[0]]}</span>
                  <em>{c.blurb}</em>
                </button>
              ))}
            </div>
          )}

          {/* ---- Atributos ---- */}
          {step === 2 && (
            <div className="attr-editor">
              <div className="pb-head">
                <span>
                  Pontos: <strong className={spent > POINT_BUY_BUDGET ? 'over' : ''}>{spent}</strong>/{POINT_BUY_BUDGET}
                </span>
                <button className="small" onClick={suggestAttributes}>
                  Sugerir para {cls?.name}
                </button>
              </div>
              {ABILITY_KEYS.map((k) => {
                const bonus = finals[k] - base[k];
                return (
                  <div key={k} className="attr-row">
                    <span className="ab-name">{ABILITY_LABELS[k]}</span>
                    <span className="stepper">
                      <button onClick={() => setBase((b) => ({ ...b, [k]: Math.max(8, b[k] - 1) }))}>−</button>
                      <strong>{base[k]}</strong>
                      <button onClick={() => setBase((b) => ({ ...b, [k]: Math.min(15, b[k] + 1) }))}>+</button>
                    </span>
                    <span className="ab-final">
                      {bonus !== 0 && <em className={bonus > 0 ? 'good' : 'bad'}>{bonus > 0 ? `+${bonus} racial` : `${bonus} racial`}</em>}
                      <strong>{finals[k]}</strong>
                      <em>({abilityMod(finals[k]) >= 0 ? '+' : ''}{abilityMod(finals[k])})</em>
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* ---- Equipamento ---- */}
          {step === 3 && (
            <div className="equip-editor">
              <h4>Armadura</h4>
              <div className="choice-grid cols-3">
                {ARMOR_PRESETS.map((a) => (
                  <button key={a.id} className={`choice ${armorId === a.id ? 'selected' : ''}`} onClick={() => setArmorId(a.id)}>
                    <strong>{a.name}</strong>
                    <em>+{a.acBonus} CA{a.stealthPenalty ? ' · furtividade ruim' : ''}</em>
                  </button>
                ))}
              </div>
              <h4>Escudo</h4>
              <div className="choice-grid cols-3">
                {ITEM_PRESETS.filter((i) => i.category === 'shield').map((s) => {
                  const blocked = s.nonProficient?.includes(classId);
                  return (
                    <button
                      key={s.id}
                      className={`choice ${shieldId === s.id ? 'selected' : ''} ${blocked ? 'blocked' : ''}`}
                      onClick={() => !blocked && setShieldId(shieldId === s.id ? undefined : s.id)}
                      disabled={blocked}
                    >
                      <strong>{s.name}</strong>
                      <em>+{s.acBonus} CA</em>
                      <span className="weapon-props">{s.blurb}</span>
                    </button>
                  );
                })}
              </div>
              <h4>Arma</h4>
              {Object.entries(groupedWeapons).map(([cat, weapons]) => (
                <div key={cat} className="weapon-group">
                  <h5 className="weapon-group-title">{WEAPON_LABEL[cat] ?? cat}</h5>
                  <div className="choice-grid cols-2">
                    {weapons.map((w) => (
                      <button key={w.id} className={`choice weapon-choice ${weaponId === w.id ? 'selected' : ''}`} onClick={() => setWeaponId(w.id)}>
                        <strong>{w.name}</strong>
                        <em>{w.dmg} · {w.ranged ? 'distância' : 'corpo a corpo'}</em>
                        {w.properties.length > 0 && (
                          <span className="weapon-props">
                            {w.properties.map((p) => PROP_LABELS[p] ?? p).join(' · ')}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ---- Magias ---- */}
          {step === 4 && (
            <div className="spell-editor">
              {quota.cantrips === 0 && quota.spells === 0 ? (
                <div className="hint center">
                  <p>{cls?.name} não conjura magias. Nenhum feitiço para selecionar.</p>
                </div>
              ) : (
                <>
                  {quota.cantrips > 0 && (
                    <>
                      <h4>Truques <span className="spell-quota">({cantripCount}/{quota.cantrips})</span></h4>
                      <p className="hint">Truques não consomem espaços de magia.</p>
                      <div className="choice-grid cols-2">
                        {availableSpells.cantrips.map((sp) => (
                          <button
                            key={sp.slug}
                            className={`choice spell-choice ${selectedSpells.includes(sp.slug) ? 'selected' : ''}`}
                            onClick={() => toggleSpell(sp.slug)}
                          >
                            <strong>{sp.name}</strong>
                            <em>{sp.blurb}</em>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {quota.spells > 0 && (
                    <>
                      <h4>Magias nível 1 <span className="spell-quota">({spellCount}/{quota.spells})</span></h4>
                      <p className="hint">Consomem espaços de magia. Você tem {preview.spellSlotsTotal} espaço(s).</p>
                      <div className="choice-grid cols-2">
                        {availableSpells.spells.map((sp) => (
                          <button
                            key={sp.slug}
                            className={`choice spell-choice ${selectedSpells.includes(sp.slug) ? 'selected' : ''}`}
                            onClick={() => toggleSpell(sp.slug)}
                          >
                            <strong>{sp.name}</strong>
                            <em>{sp.blurb}</em>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* ---- Aparência ---- */}
          {step === 5 && (
            <div className="appear-editor">
              <label>
                Cor do token
                <div className="color-row">
                  {['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4'].map((c) => (
                    <button
                      key={c}
                      className={`color-swatch ${weaponId === c ? 'selected' : ''}`}
                      style={{ background: c }}
                      onClick={() => setWeaponId(undefined)}
                      title={c}
                    />
                  ))}
                </div>
              </label>
              <label>
                História breve do personagem
                <textarea
                  className="backstory-input"
                  rows={4}
                  maxLength={200}
                  placeholder="Ex.: Thorin é um guerreiro anão que busca vingança contra o dragão que destruiu seu clã..."
                  value={backstory}
                  onChange={(e) => setBackstory(e.target.value)}
                />
                <span className="hint">{backstory.length}/200 caracteres</span>
              </label>
            </div>
          )}

          {/* ---- Resumo ---- */}
          {step === 6 && (
            <div className="summary">
              <label>
                Nome do herói
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Ex.: Thorin" autoFocus />
              </label>
              <div className="summary-stats">
                <div><span>PV</span><strong>{preview.maxHp}</strong></div>
                <div><span>CA</span><strong>{preview.ac}</strong></div>
                <div><span>Iniciativa</span><strong>{preview.initiative >= 0 ? '+' : ''}{preview.initiative}</strong></div>
                <div><span>Proficiência</span><strong>+{preview.prof}</strong></div>
                {preview.spellSlotsTotal > 0 && (
                  <div><span>Espaços de magia</span><strong>{preview.spellSlotsTotal}</strong></div>
                )}
                <div><span>Velocidade</span><strong>{preview.speedCells} células</strong></div>
              </div>
              {selectedSpells.length > 0 && (
                <div className="summary-spells">
                  <strong>Magias conhecidas:</strong>
                  <span>{selectedSpells.map((s) => SRD_SPELLS.find((sp) => sp.slug === s)?.name ?? s).join(', ')}</span>
                </div>
              )}
              {race && race.traits.length > 0 && (
                <div className="summary-traits">
                  <strong>Traços raciais:</strong>
                  <span>{race.traits.join(' · ')}</span>
                </div>
              )}
              {backstory && (
                <div className="summary-backstory">
                  <strong>História:</strong>
                  <em>{backstory}</em>
                </div>
              )}
              {snapshot && (
                <p className="hint seats-hint">
                  Vagas de herói na sala: {snapshot.seats.players}/{snapshot.seats.maxPlayers}
                </p>
              )}
            </div>
          )}
        </div>
        </>
        )}

        {errors.length > 0 && (
          <ul className="error-list">
            {errors.map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
        )}

        <div className="creator-foot">
          {mode === 'import' ? (
            <span className="hint">Importação usa os atributos da ficha MdG como estão (sem raça aplicada).</span>
          ) : (
            <>
              <button disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
                ← Voltar
              </button>
              {step < 6 ? (
                <button className="btn-gold" disabled={!canAdvance()} onClick={() => setStep((s) => s + 1)}>
                  Avançar →
                </button>
              ) : (
                <button className="btn-gold" disabled={!canAdvance()} onClick={submit}>
                  ⚔ Criar herói e entrar na masmoura
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
