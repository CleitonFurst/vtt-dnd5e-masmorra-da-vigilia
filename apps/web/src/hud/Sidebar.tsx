import { useState } from 'react';
import { useVttStore, type SideTab } from '../store';
import { ChatLog } from './ChatLog';
import { DicePanel } from './DicePanel';
import { SheetsPanel } from './SheetsPanel';

const TABS: { id: SideTab; label: string; icon: string }[] = [
  { id: 'dice', label: 'Dados', icon: '⚄' },
  { id: 'sheets', label: 'Fichas', icon: '☰' },
  { id: 'chat', label: 'Chat', icon: '✦' },
];

export function Sidebar() {
  const tab = useVttStore((s) => s.sidebarTab);
  const setTab = useVttStore((s) => s.setSideTab);
  const collapsed = useVttStore((s) => s.sidebarCollapsed);
  const setCollapsed = useVttStore((s) => s.setSidebarCollapsed);
  const chatCount = useVttStore((s) => s.snapshot?.chat.length ?? 0);
  const [lastSeen, setLastSeen] = useState(chatCount);
  const hasNew = chatCount > lastSeen && tab !== 'chat';

  const selectTab = (t: SideTab): void => {
    setTab(t);
    if (t === 'chat') setLastSeen(chatCount);
  };

  if (collapsed) {
    return (
      <aside className="sidebar collapsed">
        <button className="side-expand" title="Abrir painel" onClick={() => setCollapsed(false)}>
          ‹
        </button>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`rail-icon ${tab === t.id ? 'active' : ''}`}
            title={t.label}
            onClick={() => {
              setCollapsed(false);
              selectTab(t.id);
            }}
          >
            {t.icon}
            {t.id === 'chat' && hasNew && <span className="dot" />}
          </button>
        ))}
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="side-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`side-tab ${tab === t.id ? 'active' : ''}`} onClick={() => selectTab(t.id)}>
            <span className="icon">{t.icon}</span>
            {t.label}
            {t.id === 'chat' && hasNew && <span className="dot" />}
          </button>
        ))}
        <button className="side-collapse" title="Recolher" onClick={() => setCollapsed(true)}>
          ›
        </button>
      </div>
      <div className="side-content">
        {tab === 'dice' && <DicePanel />}
        {tab === 'sheets' && <SheetsPanel />}
        {tab === 'chat' && <ChatLog />}
      </div>
    </aside>
  );
}
