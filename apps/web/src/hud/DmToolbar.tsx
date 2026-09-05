import { useState, useMemo } from 'react';
import { SRD_MONSTERS, INVENTORY_ITEMS, type MonsterAttack } from '@vtt/shared';
import { cellKey } from '@vtt/shared';
import { getSocket } from '../net/socket';
import { useVttStore } from '../store';

interface CustomMonster {
  id: string;
  name: string;
  hp: number;
  ac: number;
  speedCells: number;
  sizeCells: 1 | 2;
  color: string;
  attacks: MonsterAttack[];
}

const LS_KEY = 'vtt-monstros-custom';

function loadCustoms(): CustomMonster[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const list = raw ? (JSON.parse(raw) as CustomMonster[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveCustoms(list: CustomMonster[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch {
    /* armazenamento indisponível */
  }
}

const EMPTY_FORM: CustomMonster = { id: '', name: '', hp: 10, ac: 12, speedCells: 6, sizeCells: 1, color: '#c0392b', attacks: [{ name: 'Golpe', bonus: 4, dmgDice: '1d6', dmgMod: 2, rangeCells: 1 }] };

const CR_OPTIONS = ['Todos', '0', '1/8', '1/4', '1/2', '1', '2', '3', '4+'] as const;

function crSortValue(cr: string): number {
  if (cr === '0') return 0;
  if (cr === '1/8') return 0.125;
  if (cr === '1/4') return 0.25;
  if (cr === '1/2') return 0.5;
  const n = Number(cr);
  return Number.isFinite(n) ? n : 99;
}

export function DmToolbar() {
  const tool = useVttStore((s) => s.tool);
  const setTool = useVttStore((s) => s.setTool);
  const selectedTokenId = useVttStore((s) => s.selectedTokenId);
  const targetedTokenId = useVttStore((s) => s.targetedTokenId);
  const snapshot = useVttStore((s) => s.snapshot);
  const [customs, setCustoms] = useState<CustomMonster[]>(loadCustoms);
  const [monsterId, setMonsterId] = useState(SRD_MONSTERS[0]?.id ?? '');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CustomMonster>(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [crFilter, setCrFilter] = useState<string>('Todos');
  const [itemId, setItemId] = useState(INVENTORY_ITEMS[0]?.id ?? '');
  const [itemQty, setItemQty] = useState(1);
  const [itemSearch, setItemSearch] = useState('');
  const socket = getSocket();
  const selectedToken = snapshot?.tokens.find((t) => t.id === selectedTokenId);
  const selectedSheet = snapshot?.sheets.find((s) => s.tokenId === selectedTokenId);

  const all = useMemo(() => {
    const base = [...SRD_MONSTERS.map((m) => ({ ...m, speedCells: undefined as number | undefined, custom: false })),
                  ...customs.map((c) => ({ ...c, cr: '—', custom: true }))];
    const q = search.toLowerCase().trim();
    return base.filter((m) => {
      if (q && !m.name.toLowerCase().includes(q)) return false;
      if (crFilter !== 'Todos' && m.cr !== crFilter) return false;
      return true;
    });
  }, [customs, search, crFilter]);
  const monster = all.find((m) => m.id === monsterId);

  const summonMonster = (): void => {
    if (!snapshot || !monster) return;
    const cs = snapshot.map.cellSize;
    socket.emit('token:add', {
      kind: 'monster',
      name: monster.name,
      hp: monster.hp,
      ac: monster.ac,
      color: monster.color,
      sizeCells: monster.sizeCells,
      speedCells: monster.speedCells ?? 6,
      attacks: monster.attacks?.map(a => ({ name: a.name, bonus: a.bonus, dmgDice: a.dmgDice, dmgMod: a.dmgMod, rangeCells: a.rangeCells })),
      x: Math.floor(snapshot.map.widthCells / 2) * cs,
      y: Math.floor(snapshot.map.heightCells / 2) * cs,
    });
  };

  const createCustom = (): void => {
    const name = form.name.trim();
    if (!name) return;
    const created: CustomMonster = { ...form, name: name.slice(0, 28), id: `c-${Date.now().toString(36)}` };
    const next = [...customs, created];
    setCustoms(next);
    saveCustoms(next);
    setMonsterId(created.id);
    setForm(EMPTY_FORM);
    setShowCreate(false);
  };

  const removeCustom = (): void => {
    if (!monster?.custom) return;
    const next = customs.filter((c) => c.id !== monster.id);
    setCustoms(next);
    saveCustoms(next);
    setMonsterId(SRD_MONSTERS[0]?.id ?? '');
  };

  const revealAll = (): void => {
    if (!snapshot) return;
    const cells: string[] = [];
    for (let cy = 0; cy < snapshot.map.heightCells; cy++) {
      for (let cx = 0; cx < snapshot.map.widthCells; cx++) cells.push(cellKey(cx, cy));
    }
    socket.emit('fog:paint', { cells, mode: 'reveal' });
  };

  const num = (raw: string, fb: number): number => {
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : fb;
  };

  return (
    <div className="panel dm-toolbar">
      <div className="panel-head">
        <strong>Mestra</strong>
        <span className="chip seats-chip">
          Heróis {snapshot?.seats.players ?? 0}/{snapshot?.seats.maxPlayers ?? 4}
        </span>
      </div>

      <h4>Ferramentas</h4>
      <div className="tool-grid">
        <button className={tool === 'select' ? 'active' : ''} onClick={() => setTool('select')}>
          Selecionar
        </button>
        <button className={tool === 'wall' ? 'active' : ''} onClick={() => setTool('wall')}>
          Parede
        </button>
        <button className={tool === 'wallErase' ? 'active danger' : ''} onClick={() => setTool('wallErase')} title="Clique perto de uma parede para removê-la">
          Remover parede
        </button>
        <button className={tool === 'fogHide' ? 'active' : ''} onClick={() => setTool('fogHide')}>
          Fog +
        </button>
        <button className={tool === 'fogReveal' ? 'active' : ''} onClick={() => setTool('fogReveal')}>
          Fog −
        </button>
      </div>

      <div className="stack">
        <button className="small" onClick={revealAll}>
          Revelar mapa todo
        </button>
      </div>

      <h4>Invocar criatura</h4>
      <div className="monster-search">
        <input
          type="text"
          placeholder="Buscar monstro..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="monster-search-input"
        />
        <select value={crFilter} onChange={(e) => setCrFilter(e.target.value)} className="monster-cr-select">
          {CR_OPTIONS.map((cr) => (
            <option key={cr} value={cr}>CR {cr}</option>
          ))}
        </select>
      </div>
      <div className="monster-row">
        <select value={monsterId} onChange={(e) => setMonsterId(e.target.value)}>
          <optgroup label="SRD">
            {all.filter((m) => !m.custom).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} (CR {m.cr})
              </option>
            ))}
          </optgroup>
          {all.filter((m) => m.custom).length > 0 && (
            <optgroup label="Meus monstros">
              {all.filter((m) => m.custom).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <button className="btn-gold" onClick={summonMonster}>
          Invocar
        </button>
      </div>
      {monster && (
        <div className="monster-card">
          <div>
            <span>CA</span>
            <strong>{monster.ac}</strong>
          </div>
          <div>
            <span>PV</span>
            <strong>{monster.hp}</strong>
          </div>
          <div>
            <span>Tamanho</span>
            <strong>{monster.sizeCells === 2 ? '2×2' : '1×1'}</strong>
          </div>
          {monster.speedCells !== undefined && (
            <div>
              <span>Desl.</span>
              <strong>{monster.speedCells}</strong>
            </div>
          )}
        </div>
      )}

      <button className="small create-toggle" onClick={() => setShowCreate(!showCreate)}>
        {showCreate ? '− Fechar criador' : '+ Criar novo monstro'}
      </button>

      {showCreate && (
        <div className="monster-create">
          <label className="mc-name">
            Nome
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex.: Dragão jovem"
              maxLength={28}
            />
          </label>
          <label>
            PV máx.
            <input value={String(form.hp)} onChange={(e) => setForm({ ...form, hp: Math.max(1, num(e.target.value, 10)) })} inputMode="numeric" />
          </label>
          <label>
            CA
            <input value={String(form.ac)} onChange={(e) => setForm({ ...form, ac: Math.max(1, Math.min(30, num(e.target.value, 12))) })} inputMode="numeric" />
          </label>
          <label>
            Deslocamento (células)
            <input
              value={String(form.speedCells)}
              onChange={(e) => setForm({ ...form, speedCells: Math.max(1, Math.min(20, num(e.target.value, 6))) })}
              inputMode="numeric"
            />
          </label>
          <label>
            Tamanho
            <select value={form.sizeCells} onChange={(e) => setForm({ ...form, sizeCells: e.target.value === '2' ? 2 : 1 })}>
              <option value="1">1×1</option>
              <option value="2">2×2</option>
            </select>
          </label>
          <label className="mc-color">
            Cor
            <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          </label>
          <div className="mc-attacks">
            <span className="group-label">Ataques</span>
            {form.attacks.map((atk, i) => (
              <div key={i} className="mc-atk-row">
                <input value={atk.name} placeholder="Nome" maxLength={20}
                  onChange={(e) => { const next = [...form.attacks]; next[i] = { ...next[i], name: e.target.value }; setForm({ ...form, attacks: next }); }} />
                <input value={String(atk.bonus)} placeholder="Bônus" inputMode="numeric" style={{ width: 48 }}
                  onChange={(e) => { const next = [...form.attacks]; next[i] = { ...next[i], bonus: num(e.target.value, 4) }; setForm({ ...form, attacks: next }); }} />
                <input value={atk.dmgDice} placeholder="Dano" maxLength={10} style={{ width: 64 }}
                  onChange={(e) => { const next = [...form.attacks]; next[i] = { ...next[i], dmgDice: e.target.value }; setForm({ ...form, attacks: next }); }} />
                <input value={String(atk.dmgMod)} placeholder="Mod" inputMode="numeric" style={{ width: 40 }}
                  onChange={(e) => { const next = [...form.attacks]; next[i] = { ...next[i], dmgMod: num(e.target.value, 0) }; setForm({ ...form, attacks: next }); }} />
                <input value={String(atk.rangeCells)} placeholder="Alcance" inputMode="numeric" style={{ width: 48 }}
                  onChange={(e) => { const next = [...form.attacks]; next[i] = { ...next[i], rangeCells: Math.max(1, num(e.target.value, 1)) }; setForm({ ...form, attacks: next }); }} />
                {form.attacks.length > 1 && (
                  <button className="small danger" onClick={() => setForm({ ...form, attacks: form.attacks.filter((_, j) => j !== i) })}>✕</button>
                )}
              </div>
            ))}
            <button className="small" onClick={() => setForm({ ...form, attacks: [...form.attacks, { name: 'Novo ataque', bonus: 4, dmgDice: '1d6', dmgMod: 2, rangeCells: 1 }] })}>
              + Ataque
            </button>
          </div>
          <button className="btn-gold mc-save" onClick={createCustom}>
            Salvar monstro
          </button>
        </div>
      )}

      <h4>Colocar item no mapa</h4>
      <div className="monster-search">
        <input
          type="text"
          placeholder="Buscar item..."
          value={itemSearch}
          onChange={(e) => setItemSearch(e.target.value)}
          className="monster-search-input"
        />
      </div>
      <div className="monster-row">
        <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
          {INVENTORY_ITEMS.filter((it) => {
            if (itemSearch && !it.name.toLowerCase().includes(itemSearch.toLowerCase())) return false;
            return true;
          }).map((it) => (
            <option key={it.id} value={it.id}>
              {it.name} ({it.category})
            </option>
          ))}
        </select>
        <input
          type="number"
          value={itemQty}
          onChange={(e) => setItemQty(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
          min={1}
          max={99}
          style={{ width: 48 }}
          title="Quantidade"
        />
        <button className="btn-gold" onClick={() => {
          if (!snapshot) return;
          const cs = snapshot.map.cellSize;
          // coloca no centro do mapa ou na posição do token selecionado
          let px = Math.floor(snapshot.map.widthCells / 2) * cs;
          let py = Math.floor(snapshot.map.heightCells / 2) * cs;
          if (selectedTokenId) {
            const tok = snapshot.tokens.find((t) => t.id === selectedTokenId);
            if (tok) { px = tok.x; py = tok.y; }
          }
          socket.emit('dm:place-item', { itemId, x: px, y: py, quantity: itemQty }, (res: any) => {
            if (!res?.ok && res?.error) useVttStore.getState().showToast(res.error);
          });
        }}>
          Colocar
        </button>
      </div>
      {(() => {
        const it = INVENTORY_ITEMS.find((i) => i.id === itemId);
        return it ? (
          <div className="monster-card">
            <div><span>Tipo</span><strong>{it.category}</strong></div>
            <div><span>Peso</span><strong>{it.weight}</strong></div>
            <div><span>Qtd</span><strong>{itemQty}</strong></div>
            <div style={{ gridColumn: 'span 3' }}><span>Info</span><strong>{it.blurb}</strong></div>
          </div>
        ) : null;
      })()}

      {selectedTokenId && (
        <div className="stack">
          {selectedToken && (
            <div className="dm-token-stats">
              <div className="target-stat-row">
                <span className="target-stat-label">HP</span>
                <button className="target-stat-btn" onClick={() => socket.emit('token:damage', { id: selectedTokenId, amount: -1 })}>−</button>
                <span className="target-stat-val">{selectedToken.hp}/{selectedToken.maxHp}</span>
                <button className="target-stat-btn" onClick={() => socket.emit('token:damage', { id: selectedTokenId, amount: 1 })}>+</button>
              </div>
              {selectedSheet && (
                <div className="target-stat-row">
                  <span className="target-stat-label">Espaços</span>
                  <button className="target-stat-btn" onClick={() => socket.emit('sheet:editSpellSlots', { sheetId: selectedSheet.id, delta: -1 })}>−</button>
                  <span className="target-stat-val">{selectedSheet.spellSlots.total - selectedSheet.spellSlots.used}/{selectedSheet.spellSlots.total}</span>
                  <button className="target-stat-btn" onClick={() => socket.emit('sheet:editSpellSlots', { sheetId: selectedSheet.id, delta: 1 })}>+</button>
                </div>
              )}
            </div>
          )}
          <button
            className="small"
            onClick={() => {
              socket.emit('token:toggleDead', { id: selectedTokenId });
            }}
          >
            Toggle Morto/Vivo
          </button>
          <div className="kind-select-row">
            <span className="group-label">Tipo:</span>
            <select
              defaultValue=""
              onChange={(e) => {
                if (!e.target.value) return;
                socket.emit('token:setKind', { id: selectedTokenId, kind: e.target.value as 'pc' | 'monster' | 'npc' });
                e.target.value = '';
              }}
            >
              <option value="" disabled>Selecionar tipo...</option>
              <option value="pc">PC</option>
              <option value="monster">Monstro</option>
              <option value="npc">NPC</option>
            </select>
          </div>
          <button
            className="danger small"
            onClick={() => {
              socket.emit('token:remove', { id: selectedTokenId });
              useVttStore.getState().select(null);
            }}
          >
            Remover token selecionado
          </button>
        </div>
      )}

      {monster?.custom && (
        <button className="danger small" onClick={removeCustom}>
          Excluir “{monster.name}” dos meus monstros
        </button>
      )}
    </div>
  );
}
