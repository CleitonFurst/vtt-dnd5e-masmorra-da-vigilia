import { useEffect, useRef } from 'react';
import { onHpFloat, onTextFloat } from '../net/fx';
import { getSocket } from '../net/socket';
import { DRAW_COLORS, DRAW_SIZES, STICKY_COLORS, useVttStore, type Tool } from '../store';
import { VttScene, type SceneSyncState } from './VttScene';

const ARROW_DELTAS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

function floatOverToken(scene: VttScene | null, tokenId: string, render: (x: number, y: number) => void): void {
  if (!scene) return;
  const token = useVttStore.getState().snapshot?.tokens.find((t) => t.id === tokenId);
  if (!token) return;
  const cs = useVttStore.getState().snapshot?.map.cellSize ?? 64;
  const size = token.sizeCells * cs;
  render(token.x + size / 2, token.y - 6);
}

export function VttCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<VttScene | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    const scene = new VttScene({
      getTool: () => useVttStore.getState().tool,
      isDm: () => useVttStore.getState().me?.role === 'dm',
      canControl: (token) => {
        const st = useVttStore.getState();
        return st.me?.role === 'dm' || (token.ownerPlayerId !== undefined && token.ownerPlayerId === st.me?.id);
      },
      onTokenMove: (id, x, y) => getSocket().emit('token:move', { id, x, y }),
      onItemMove: (id, x, y) => getSocket().emit('item:move', { id, x, y }),
      onItemRemove: (id) => getSocket().emit('dm:remove-item', { id }, (res: any) => {
        if (!res?.ok && res?.error) useVttStore.getState().showToast(res.error);
      }),
      onItemClick: (item) => getSocket().emit('inventory:collect', { itemId: item.itemId, x: item.x, y: item.y }, (res: any) => {
        if (res?.ok) useVttStore.getState().showToast(`${item.name} coletado!`);
        else if (res?.error) useVttStore.getState().showToast(res.error);
      }),
      onTokenClick: (id) => {
        const st = useVttStore.getState();
        const token = st.snapshot?.tokens.find((t) => t.id === id);
        // PF: quem está morrendo (inconsciente) ainda pode ser MIRADO (cura) — só o morto permanente não é clicável.
        if (!token || (token.dead && !token.dying)) return;
        const mine = token.ownerPlayerId !== undefined && token.ownerPlayerId === st.me?.id;
        if (st.me?.role === 'dm') {
          // Mestra: primeiro clique seleciona o atacante; clique em OUTRO token mira o alvo;
          // clicar de novo no atacante o deseleciona.
          if (st.selectedTokenId && st.selectedTokenId !== id) {
            st.target(st.targetedTokenId === id ? null : id);
          } else if (st.selectedTokenId === id) {
            st.select(null);
            st.target(null);
          } else {
            st.select(id);
          }
        } else if (mine) {
          st.select(st.selectedTokenId === id ? null : id);
        } else {
          st.target(st.targetedTokenId === id ? null : id);
        }
      },
      onEmptyClick: () => {
        const st = useVttStore.getState();
        st.select(null);
        st.target(null);
      },
      onWallAdd: (x1, y1, x2, y2) => getSocket().emit('wall:add', { x1, y1, x2, y2 }),
      onWallRemove: (x1, y1, x2, y2) => getSocket().emit('wall:remove', { x1, y1, x2, y2 }),
      onOpenSheet: (tokenId) => useVttStore.getState().setOpenSheet(tokenId),
      onFogPaint: (cells, mode) => getSocket().emit('fog:paint', { cells, mode }),
      getDrawColor: () => useVttStore.getState().drawColor,
      getDrawSize: () => useVttStore.getState().drawSize,
      onDraw: (stroke) => {
        getSocket().emit('map:draw', stroke, (res) => {
          if (!res?.ok) {
            useVttStore.getState().showToast('Não foi possível desenhar agora.');
          } else {
            useVttStore.getState().pushUndo(stroke);
          }
        });
      },
      onDrawErase: (ids) => getSocket().emit('map:drawErase', { ids }),
      onDrawMove: (id, dx, dy) => getSocket().emit('map:drawMove', { id, dx, dy }),
      onUndo: () => {
        const stroke = useVttStore.getState().popUndo();
        if (stroke) getSocket().emit('map:drawErase', { ids: [stroke.id] });
      },
      onRedo: () => {
        const stroke = useVttStore.getState().popRedo();
        if (stroke) {
          const newStroke = { ...stroke, id: Math.random().toString(36).slice(2) + Date.now().toString(36) };
          getSocket().emit('map:draw', newStroke, (res) => {
            if (res?.ok) useVttStore.getState().pushUndo(newStroke);
          });
        }
      },
      getStickyBg: () => useVttStore.getState().stickyColor,
    });

    void scene.init(host).then(() => {
      if (disposed) {
        scene.destroy();
        return;
      }
      sceneRef.current = scene;
      pushSync(scene);
    });

    return () => {
      disposed = true;
      sceneRef.current = null;
      scene.destroy();
    };
  }, []);

  const snapshot = useVttStore((s) => s.snapshot);
  const selectedTokenId = useVttStore((s) => s.selectedTokenId);
  const targetedTokenId = useVttStore((s) => s.targetedTokenId);
  const selectedDrawingId = useVttStore((s) => s.selectedDrawingId);

  useEffect(() => {
    pushSync(sceneRef.current);
  }, [snapshot, selectedTokenId, targetedTokenId, selectedDrawingId]);

  // cursor contextual por ferramenta
  const tool = useVttStore((s) => s.tool);
  useEffect(() => {
    if (!hostRef.current) return;
    hostRef.current.style.cursor =
      tool === 'draw' || tool === 'erase' || tool === 'rect' || tool === 'circle' || tool === 'line' || tool === 'sticky' ? 'crosshair' : tool === 'text' ? 'text' : tool === 'select' ? 'grab' : 'cell';
  }, [tool]);

  // Ctrl+Z = desfazer, Ctrl+Shift+Z = refazer, Delete = apagar desenho selecionado, P/B = pen, T = text, V/S = select, R = rect, C = circle, L = line, N = sticky
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const st = useVttStore.getState();
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        const stroke = st.popRedo();
        if (stroke) {
          const newStroke = { ...stroke, id: Math.random().toString(36).slice(2) + Date.now().toString(36) };
          getSocket().emit('map:draw', newStroke, (res) => {
            if (res?.ok) useVttStore.getState().pushUndo(newStroke);
          });
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        const stroke = st.popUndo();
        if (stroke) getSocket().emit('map:drawErase', { ids: [stroke.id] });
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (st.selectedDrawingId) {
          e.preventDefault();
          getSocket().emit('map:drawErase', { ids: [st.selectedDrawingId] });
          st.setSelectedDrawingId(null);
        }
        return;
      }
      const keyMap: Record<string, Tool> = { p: 'draw', b: 'draw', t: 'text', v: 'select', s: 'select', r: 'rect', c: 'circle', l: 'line', n: 'sticky' };
      const mapped = keyMap[e.key.toLowerCase()];
      if (mapped) {
        e.preventDefault();
        st.setTool(st.tool === mapped ? 'select' : mapped);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // setas do teclado movem o token selecionado célula a célula
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const delta = ARROW_DELTAS[e.key];
      if (!delta) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const st = useVttStore.getState();
      if (!st.snapshot) return;
      const id = st.selectedTokenId;
      if (!id) return;
      const tok = st.snapshot.tokens.find((t) => t.id === id);
      if (!tok) return;
      const mine = st.me?.role === 'dm' || (tok.ownerPlayerId !== undefined && tok.ownerPlayerId === st.me?.id);
      if (!mine) return;
      e.preventDefault();
      const cs = st.snapshot.map.cellSize;
      const nx = Math.max(0, Math.min(st.snapshot.map.widthCells * cs - tok.sizeCells * cs, tok.x + delta[0] * cs));
      const ny = Math.max(0, Math.min(st.snapshot.map.heightCells * cs - tok.sizeCells * cs, tok.y + delta[1] * cs));
      getSocket().emit('token:move', { id, x: nx, y: ny });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // efeitos flutuantes (dano/cura/erros/críticos)
  useEffect(() => {
    const offHp = onHpFloat(({ tokenId, delta }) => {
      floatOverToken(sceneRef.current, tokenId, (x, y) => {
        sceneRef.current?.spawnFloatingText(x, y, delta > 0 ? `+${delta}` : `${delta}`, 0x000000);
      });
    });
    const offText = onTextFloat(({ tokenId, text, color }) => {
      floatOverToken(sceneRef.current, tokenId, (x, y) => {
        sceneRef.current?.spawnFloatingText(x - 18, y, text, 0x000000);
      });
    });
    return () => {
      offHp();
      offText();
    };
  }, []);

  return (
    <div className="canvas-stack">
      <div ref={hostRef} className="canvas-host" />
      <div className="cam-controls">
        <button title="Aproximar (ou roda do mouse)" onClick={() => sceneRef.current?.zoomIn()}>
          +
        </button>
        <button title="Afastar (ou roda do mouse)" onClick={() => sceneRef.current?.zoomOut()}>
          −
        </button>
        <button title="Ver o mapa inteiro" onClick={() => sceneRef.current?.resetView()}>
          ⌂
        </button>
      </div>
      <DrawBar />
    </div>
  );
}

/** Barra de desenho estilo Whiteboard: caneta, formas, texto, borracha, cores e espessuras. */
function DrawBar() {
  const tool = useVttStore((s) => s.tool);
  const setTool = useVttStore((s) => s.setTool);
  const drawColor = useVttStore((s) => s.drawColor);
  const setDrawColor = useVttStore((s) => s.setDrawColor);
  const drawSize = useVttStore((s) => s.drawSize);
  const setDrawSize = useVttStore((s) => s.setDrawSize);
  const showToast = useVttStore((s) => s.showToast);
  const undoStack = useVttStore((s) => s.undoStack);
  const redoStack = useVttStore((s) => s.redoStack);
  const shapeFilled = useVttStore((s) => s.shapeFilled);
  const setShapeFilled = useVttStore((s) => s.setShapeFilled);
  const stickyColor = useVttStore((s) => s.stickyColor);
  const setStickyColor = useVttStore((s) => s.setStickyColor);
  const selectedDrawingId = useVttStore((s) => s.selectedDrawingId);

  const isDrawing = tool === 'draw' || tool === 'erase' || tool === 'rect' || tool === 'circle' || tool === 'line' || tool === 'text' || tool === 'sticky';

  const activateTool = (t: Tool) => {
    setTool(tool === t ? 'select' : t);
  };

  return (
    <div className={`draw-bar${isDrawing ? ' active' : ''}`}>
      <div className="draw-bar-row">
        <button
          className={tool === 'draw' ? 'active' : ''}
          title="Caneta (P/B) — desenhar no mapa (todos veem em tempo real)"
          onClick={() => {
            if (tool !== 'draw') showToast('Modo desenho: arraste para rabiscar.');
            activateTool('draw');
          }}
        >
          🖊
        </button>
        <button
          className={tool === 'rect' ? 'active' : ''}
          title="Retângulo (R) — arraste para desenhar um retângulo"
          onClick={() => {
            if (tool !== 'rect') showToast('Retângulo: arraste para desenhar.');
            activateTool('rect');
          }}
        >
          ▭
        </button>
        <button
          className={tool === 'circle' ? 'active' : ''}
          title="Círculo (C) — arraste para desenhar um círculo/elipse"
          onClick={() => {
            if (tool !== 'circle') showToast('Círculo: arraste para desenhar.');
            activateTool('circle');
          }}
        >
          ⬭
        </button>
        <button
          className={tool === 'line' ? 'active' : ''}
          title="Linha (L) — arraste para desenhar uma linha"
          onClick={() => {
            if (tool !== 'line') showToast('Linha: arraste para desenhar.');
            activateTool('line');
          }}
        >
          ╱
        </button>
        <button
          className={tool === 'text' ? 'active' : ''}
          title="Texto (T) — clique para posicionar um texto no mapa"
          onClick={() => {
            if (tool !== 'text') showToast('Texto: clique no mapa para posicionar.');
            activateTool('text');
          }}
        >
          T
        </button>
        <button
          className={tool === 'sticky' ? 'active' : ''}
          title="Nota adesiva (N) — clique para posicionar um sticky note"
          onClick={() => {
            if (tool !== 'sticky') showToast('Sticky: clique no mapa para posicionar.');
            activateTool('sticky');
          }}
        >
          📌
        </button>
        <button
          className={tool === 'erase' ? 'active' : ''}
          title="Borracha — apague traços tocando neles"
          onClick={() => {
            if (tool !== 'erase') showToast('Borracha: passe sobre um traço para apagá-lo.');
            activateTool('erase');
          }}
        >
          🧽
        </button>
        <button
          className={tool === 'select' ? 'active' : ''}
          title="Selecionar (V/S) — clique em um desenho para selecionar, arrastar, apagar (Delete)"
          onClick={() => activateTool('select')}
        >
          ↖
        </button>
      </div>
      <div className="draw-bar-row">
        <button
          className={`undo-btn${shapeFilled ? ' active' : ''}`}
          title="Preenchimento — ativa/desativa preenchimento para retângulo e círculo"
          onClick={() => setShapeFilled(!shapeFilled)}
        >
          {shapeFilled ? '◼' : '◻'}
        </button>
        <button
          className="undo-btn"
          title="Desfazer (Ctrl+Z) — apaga o último desenho que você fez"
          disabled={undoStack.length === 0}
          onClick={() => {
            const stroke = useVttStore.getState().popUndo();
            if (stroke) getSocket().emit('map:drawErase', { ids: [stroke.id] });
          }}
        >
          ↩
        </button>
        <button
          className="undo-btn"
          title="Refazer (Ctrl+Shift+Z)"
          disabled={redoStack.length === 0}
          onClick={() => {
            const stroke = useVttStore.getState().popRedo();
            if (stroke) {
              const newStroke = { ...stroke, id: Math.random().toString(36).slice(2) + Date.now().toString(36) };
              getSocket().emit('map:draw', newStroke, (res) => {
                if (res?.ok) useVttStore.getState().pushUndo(newStroke);
              });
            }
          }}
        >
          ↪
        </button>
        {selectedDrawingId && (
          <button
            className="undo-btn"
            title="Excluir desenho selecionado (Delete)"
            onClick={() => {
              getSocket().emit('map:drawErase', { ids: [selectedDrawingId] });
              useVttStore.getState().setSelectedDrawingId(null);
            }}
          >
            ✕
          </button>
        )}
      </div>
      <div className="draw-bar-row">
        {DRAW_SIZES.map((sz) => (
          <button
            key={sz}
            className={`size-btn${drawSize === sz ? ' active' : ''}`}
            title={`Espessura ${sz === 2 ? 'fina' : sz === 4 ? 'média' : 'grossa'}`}
            onClick={() => {
              setDrawSize(sz);
              setDrawColor(useVttStore.getState().drawColor);
              if (!isDrawing) setTool('draw');
            }}
          >
            <span style={{ width: 4 + sz, height: 4 + sz }} />
          </button>
        ))}
      </div>
      <div className="draw-bar-row">
        {DRAW_COLORS.map((c) => (
          <button
            key={c.value}
            className={`swatch${drawColor === c.value ? ' active' : ''}`}
            style={{ background: `#${c.value.toString(16).padStart(6, '0')}` }}
            title={c.label}
            onClick={() => {
              setDrawColor(c.value);
              if (!isDrawing) setTool('draw');
            }}
          />
        ))}
      </div>
      {(tool === 'sticky') && (
        <div className="draw-bar-row">
          <span style={{ color: '#94a3b8', fontSize: 11, marginRight: 4 }}>Sticky:</span>
          {STICKY_COLORS.map((c) => (
            <button
              key={c.value}
              className={`swatch${stickyColor === c.value ? ' active' : ''}`}
              style={{ background: `#${c.value.toString(16).padStart(6, '0')}` }}
              title={c.label}
              onClick={() => setStickyColor(c.value)}
            />
          ))}
        </div>
      )}
      <div className="draw-bar-row">
        <button className="clear" title="Apagar TODOS os desenhos" onClick={() => getSocket().emit('map:drawClear')}>
          🧹
        </button>
      </div>
    </div>
  );
}

function pushSync(scene: VttScene | null): void {
  if (!scene) return;
  const st = useVttStore.getState();
  if (!st.snapshot) return;
  const state: SceneSyncState = {
    map: st.snapshot.map,
    tokens: st.snapshot.tokens,
    items: st.snapshot.items ?? [],
    selectedId: st.selectedTokenId,
    targetedId: st.targetedTokenId,
    drawings: st.snapshot.drawings ?? [],
    selectedDrawingId: st.selectedDrawingId,
    shapeFilled: st.shapeFilled,
  };
  scene.sync(state);
}
