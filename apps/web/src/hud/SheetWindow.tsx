import { useEffect, useState } from 'react';
import { CLASS_BY_ID } from '@vtt/shared';
import { useVttStore } from '../store';
import { CharacterSheetCard } from './CharacterSheetCard';
import { MonsterSheetCard } from './MonsterSheetCard';

/** Janela modal da ficha: abre grande, pode expandir para tela cheia e fecha
 *  com ✕, ESC ou clique fora. A ficha nunca é cortada — o corpo rola. */
export function SheetWindow() {
  const openSheetId = useVttStore((s) => s.openSheetId);
  const setOpenSheet = useVttStore((s) => s.setOpenSheet);
  const snapshot = useVttStore((s) => s.snapshot);
  const me = useVttStore((s) => s.me);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!openSheetId) setExpanded(false);
  }, [openSheetId]);

  useEffect(() => {
    if (!openSheetId) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpenSheet(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openSheetId, setOpenSheet]);

  if (!openSheetId || !snapshot || !me) return null;

  const token = snapshot.tokens.find((t) => t.id === openSheetId);
  const sheet =
    snapshot.sheets.find((s) => s.tokenId === openSheetId) ??
    snapshot.sheets.find((s) => s.id === openSheetId);
  if (!sheet && !token) return null;

  const isDm = me.role === 'dm';

  if (!sheet && token) {
    // sem ficha de herói: ficha de monstro com visual MdG idêntico
    return (
      <div className="overlay" onClick={(e) => e.target === e.currentTarget && setOpenSheet(null)}>
        <div className="sheet-window">
          <div className="sheet-window-head">
            <strong className="sheet-window-title">{token.name}</strong>
            <span className="sheet-window-sub">Ficha de criatura</span>
            <div className="sheet-window-actions">
              <button className="danger" title="Fechar (Esc)" onClick={() => setOpenSheet(null)}>
                ✕
              </button>
            </div>
          </div>
          <div className="sheet-window-body">
            <MonsterSheetCard token={token} isDm={isDm} />
          </div>
        </div>
      </div>
    );
  }

  if (!sheet) return null;
  const clsName = CLASS_BY_ID.get(sheet.classId)?.name ?? sheet.classId;

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && setOpenSheet(null)}>
      <div className={`sheet-window${expanded ? ' expanded' : ''}`}>
        <div className="sheet-window-head">
          <strong className="sheet-window-title">{sheet.name}</strong>
          <span className="sheet-window-sub">{clsName} · nível 1</span>
          <div className="sheet-window-actions">
            <button
              title={expanded ? 'Recolher (tamanho normal)' : 'Expandir (quase tela cheia)'}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? '⤡' : '⤢'}
            </button>
            <button className="danger" title="Fechar (Esc)" onClick={() => setOpenSheet(null)}>
              ✕
            </button>
          </div>
        </div>
        <div className="sheet-window-body">
          <CharacterSheetCard sheet={sheet} token={token} variant="drawer" />
        </div>
      </div>
    </div>
  );
}
