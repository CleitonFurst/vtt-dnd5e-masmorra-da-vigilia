import { useState } from 'react';
import { CLASS_BY_ID } from '@vtt/shared';
import { useVttStore } from '../store';
import { useMySheets } from './PlayerHud';

/** Lista compacta de fichas para a barra lateral. Clicar abre a janela da ficha. */
export function SheetsPanel() {
  const sheets = useVttStore((s) => s.snapshot?.sheets ?? []);
  const tokens = useVttStore((s) => s.snapshot?.tokens ?? []);
  const me = useVttStore((s) => s.me);
  const setCreatorOpen = useVttStore((s) => s.setCreatorOpen);
  const setOpenSheet = useVttStore((s) => s.setOpenSheet);
  const openSheetId = useVttStore((s) => s.openSheetId);
  const mySheets = useMySheets();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!me) return null;

  const isDm = me.role === 'dm';
  const visibleSheets = isDm ? sheets : mySheets;
  const sortedSheets = [...visibleSheets].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  return (
    <div className="sheets-panel">
      <p className="hint side-hint">
        {isDm
          ? 'Você é a Mestra: vê todas as fichas da mesa.'
          : 'Somente as suas fichas aparecem aqui.'}
      </p>
      {sortedSheets.length === 0 && (
        <div className="empty-state">
          <p>{isDm ? 'Nenhuma ficha criada ainda.' : 'Você ainda não tem um personagem.'}</p>
        </div>
      )}
      {sortedSheets.map((sheet) => {
        const token = tokens.find((t) => t.id === sheet.tokenId);
        const hp = token?.hp ?? sheet.derived.maxHp;
        const maxHp = sheet.derived.maxHp;
        const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
        const downed = Boolean(token?.dead || hp === 0);
        const expanded = expandedId === sheet.id;
        const hasInventory = sheet.inventory && sheet.inventory.length > 0;
        return (
          <div key={sheet.id} className="sheet-row-wrap">
            <button
              className={[
                'sheet-row',
                downed ? 'dead' : '',
                openSheetId === sheet.tokenId ? 'open' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setOpenSheet(sheet.tokenId)}
            >
              <span className="sheet-row-main">
                <span className="sheet-row-name">
                  {sheet.name}
                  {downed && <em> · Caído</em>}
                </span>
                <span className="sheet-row-sub">
                  {CLASS_BY_ID.get(sheet.classId)?.name ?? sheet.classId}
                  {' · '}
                  {isDm || token?.ownerPlayerId === me.id ? `CA ${sheet.derived.ac}` : '—'}
                </span>
              </span>
              <span className="sheet-row-hp">
                <span className="hp-bar mini">
                  <span
                    className={`hp-fill${pct <= 25 ? ' crit' : pct <= 55 ? ' warn' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <b>
                  {hp}/{maxHp}
                </b>
              </span>
            </button>
            {isDm && hasInventory && (
              <button
                className="sheet-expand-btn"
                onClick={() => setExpandedId(expanded ? null : sheet.id)}
              >
                {expanded ? '▾' : '▸'} Itens ({sheet.inventory.length})
              </button>
            )}
            {isDm && expanded && expandedId === sheet.id && (
              <div className="sheet-inventory">
                {sheet.inventory.length === 0 ? (
                  <span className="muted">Inventário vazio</span>
                ) : (
                  sheet.inventory.map((item, i) => (
                    <div key={i} className="sheet-inv-item">
                      <span className="sheet-inv-name">
                        {item.equipped ? '▸ ' : ''}{item.name}
                        {item.equipped && <em> (equipado)</em>}
                      </span>
                      <span className="sheet-inv-qty">×{item.quantity}</span>
                      {item.charges !== undefined && item.maxCharges !== undefined && (
                        <span className="sheet-inv-charges">{item.charges}/{item.maxCharges}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
      <button className="btn-gold create-cta" onClick={() => setCreatorOpen(true)}>
        + Criar personagem
      </button>
    </div>
  );
}
