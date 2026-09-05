import { useState } from 'react';
import { useVttStore } from '../store';
import { getSocket } from '../net/socket';
import { ITEM_BY_ID } from '@vtt/shared';

const CAT_LABEL: Record<string, string> = {
  weapon: '⚔️ Armas', armor: '🛡️ Armaduras', shield: '🛡️ Escudos', utility: '🔧 Utilidades',
  consumable: '🧪 Consumíveis', scroll: '📜 Pergaminhos', grimoire: '📖 Grimórios', loot: '💰 Lucro',
};

const CAT_CSS: Record<string, string> = {
  weapon: '#e5e7eb', armor: '#94a3b8', shield: '#f59e0b', utility: '#22c55e',
  consumable: '#f97316', scroll: '#a78bfa', grimoire: '#6366f1', loot: '#eab308',
};

export function InventoryPanel() {
  const inventoryOpen = useVttStore((s) => s.inventoryOpen);
  const toggleInventoryOpen = useVttStore((s) => s.toggleInventoryOpen);
  const snapshot = useVttStore((s) => s.snapshot);
  const me = useVttStore((s) => s.me);
  const socket = getSocket();
  const [useItem, setUseItem] = useState<string | null>(null);

  const sheets = snapshot?.sheets ?? [];
  const items = snapshot?.items ?? [];
  const mySheet = sheets.find((s) => s.ownerId === me?.id) ?? sheets[0];
  const inventory = mySheet?.inventory ?? [];

  if (!inventoryOpen) {
    return (
      <button className="inv-toggle" onClick={toggleInventoryOpen} title="Inventário (I)">
        🎒
      </button>
    );
  }

  const grouped: Record<string, typeof inventory> = {};
  for (const item of inventory) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }

  const doUse = (itemId: string): void => {
    setUseItem(itemId);
    socket.emit('inventory:use', { itemId }, (res: any) => {
      setUseItem(null);
      if (!res?.ok && res?.error) useVttStore.getState().showToast(res.error);
    });
  };

  const doDrop = (itemId: string): void => {
    socket.emit('inventory:drop', { itemId }, (res: any) => {
      if (!res?.ok && res?.error) useVttStore.getState().showToast(res.error);
    });
  };

  const doEquip = (itemId: string, equipped: boolean): void => {
    socket.emit('inventory:equip', { itemId, equipped }, (res: any) => {
      if (!res?.ok && res?.error) useVttStore.getState().showToast(res.error);
    });
  };

  const mapItemsHere = items.filter((it) => {
    const token = snapshot?.tokens?.find((t) => t.id === me?.id);
    return token && Math.abs(it.x - token.x) <= 1 && Math.abs(it.y - token.y) <= 1;
  });

  return (
    <div className="inv-panel">
      <div className="inv-head">
        <strong>Inventário</strong>
        <button className="inv-close" onClick={toggleInventoryOpen}>✕</button>
      </div>

      {mySheet && (
        <div className="inv-sheet-info">
          <span className="chip">{mySheet.name}</span>
          <span className="chip muted">{inventory.length} item(s)</span>
        </div>
      )}

      {Object.keys(grouped).length === 0 && (
        <div className="inv-empty">
          <p>Inventário vazio.</p>
          <p className="hint">Itens espalhados no mapa podem ser coletados ao passar por cima deles.</p>
          {me?.role === 'dm' && <p className="hint">Use a barra de ferramentas do Mestre para colocar itens (📦).</p>}</div>
      )}

      {Object.entries(grouped).map(([cat, catItems]) => (
        <div key={cat} className="inv-section">
          <div className="inv-section-title" style={{ borderLeftColor: CAT_CSS[cat] ?? '#888' }}>
            {CAT_LABEL[cat] ?? cat} ({catItems.reduce((a, b) => a + b.quantity, 0)})
          </div>
          {catItems.map((item) => {
            const def = ITEM_BY_ID.get(item.itemId);
            return (
              <div key={item.itemId} className={`inv-item ${item.equipped ? 'equipped' : ''}`}>
                <div className="inv-item-info" onClick={() => doEquip(item.itemId, !item.equipped)}>
                  <span className="inv-item-name">{item.name}</span>
                  {item.quantity > 1 && <span className="inv-item-qty">×{item.quantity}</span>}
                  {item.charges !== undefined && item.maxCharges !== undefined && item.charges < item.maxCharges && (
                    <span className="inv-item-charges">{item.charges}/{item.maxCharges}</span>
                  )}
                  {item.equipped && <span className="inv-item-equipped">Equipado</span>}
                </div>
                <div className="inv-item-actions">
                  <button className="inv-btn" onClick={() => doUse(item.itemId)} disabled={useItem === item.itemId} title="Usar">
                    {useItem === item.itemId ? '…' : '💚'}
                  </button>
                  <button className="inv-btn danger" onClick={() => doDrop(item.itemId)} title="Dropar">
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {mapItemsHere.length > 0 && (
        <div className="inv-section">
          <div className="inv-section-title" style={{ borderLeftColor: '#22c55e' }}>📦 Itens no chão aqui</div>
          {mapItemsHere.map((it) => (
            <div key={it.id} className="inv-item map-item">
              <div className="inv-item-info" onClick={() => {
                socket.emit('inventory:collect', { itemId: it.id, x: it.x, y: it.y }, (res: any) => {
                  if (!res?.ok && res?.error) useVttStore.getState().showToast(res.error);
                });
              }}>
                <span className="inv-item-name">{it.name}</span>
                <span className="inv-item-qty">×{it.quantity}</span>
                <span className="inv-item-coletar">Coletar</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="inv-blurb">
        <p className="hint">Passar o mouse sobre itens no mapa ou clique no seu token para coletar.</p>
        <p className="hint">Tecla <strong>I</strong> para abrir/fechar.</p>
      </div>
    </div>
  );
}