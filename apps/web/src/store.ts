import { create } from 'zustand';
import type { DrawStroke, PlayerInfo, RoomSnapshot } from '@vtt/shared';

export type Tool = 'select' | 'wall' | 'wallErase' | 'fogHide' | 'fogReveal' | 'draw' | 'erase' | 'rect' | 'circle' | 'line' | 'text' | 'sticky';
export type SideTab = 'dice' | 'sheets' | 'chat';

export const DRAW_COLORS = [
  { value: 0xeab308, label: 'Ouro' },
  { value: 0xef4444, label: 'Vermelho' },
  { value: 0x3b82f6, label: 'Azul' },
  { value: 0x22c55e, label: 'Verde' },
  { value: 0xf5f5f4, label: 'Branco' },
] as const;
export const DRAW_SIZES = [2, 4, 8] as const;

export const STICKY_COLORS = [
  { value: 0xfde68a, label: 'Amarelo' },
  { value: 0xbfdbfe, label: 'Azul claro' },
  { value: 0xbbf7d0, label: 'Verde claro' },
  { value: 0xfecdd, label: 'Rosa' },
  { value: 0xf3e8ff, label: 'Lilás' },
] as const;

const MAX_UNDO = 30;

/** Um dado a exibir na animação central. */
export interface DiceShowDie {
  sides: number;
  value: number;
}

/** Animação central de rolagem: um tomo por rolagem visível. */
export interface DiceShowItem {
  id: string;
  title: string;
  sub?: string;
  emoji?: string;
  dice: DiceShowDie[];
  total: number;
  totalLabel?: string;
  verdict?: { label: string; tone: 'good' | 'bad' | 'crit' | 'neutral' };
  detailText?: string;
}

interface VttState {
  joined: boolean;
  joining: boolean;
  joinError: string | null;
  me: PlayerInfo | null;
  snapshot: RoomSnapshot | null;
  selectedTokenId: string | null;
  targetedTokenId: string | null;
  tool: Tool;
  drawColor: number;
  drawSize: number;
  toast: string | null;
  toastType: 'info' | 'error';
  sidebarTab: SideTab;
  sidebarCollapsed: boolean;
  creatorOpen: boolean;
  openSheetId: string | null;
  roomId: string | null;
  diceShow: DiceShowItem[];
  undoStack: string[];
  redoStack: DrawStroke[];
  selectedDrawingId: string | null;
  shapeFilled: boolean;
  stickyColor: number;
  inventoryOpen: boolean;

  setJoining(v: boolean): void;
  setJoined(me: PlayerInfo, snap: RoomSnapshot | null): void;
  setJoinError(msg: string | null): void;
  setSnapshot(snap: RoomSnapshot): void;
  patchSnapshot(fn: (s: RoomSnapshot) => RoomSnapshot): void;
  setTool(t: Tool): void;
  setDrawColor(c: number): void;
  setDrawSize(s: number): void;
  select(id: string | null): void;
  target(id: string | null): void;
  showToast(msg: string, type?: 'info' | 'error'): void;
  setSideTab(tab: SideTab): void;
  setSidebarCollapsed(v: boolean): void;
  setCreatorOpen(v: boolean): void;
  setOpenSheet(id: string | null): void;
  setRoomId(id: string | null): void;
  pushDiceShow(item: DiceShowItem): void;
  shiftDiceShow(): void;
  pushUndo(stroke: DrawStroke): void;
  popUndo(): DrawStroke | null;
  popRedo(): DrawStroke | null;
  setSelectedDrawingId(id: string | null): void;
  setShapeFilled(v: boolean): void;
  setStickyColor(c: number): void;
  toggleInventoryOpen(): void;
}

export const useVttStore = create<VttState>((set, get) => ({
  joined: false,
  joining: false,
  joinError: null,
  me: null,
  snapshot: null,
  selectedTokenId: null,
  targetedTokenId: null,
  tool: 'select',
  drawColor: 0xeab308,
  drawSize: 4,
  toast: null,
  toastType: 'info',
  sidebarTab: 'dice',
  sidebarCollapsed: false,
  creatorOpen: false,
  openSheetId: null,
  roomId: null,
  diceShow: [],
  undoStack: [],
  redoStack: [],
  selectedDrawingId: null,
  shapeFilled: false,
  stickyColor: 0xfde68a,
  inventoryOpen: false,

  setJoining: (v) => set({ joining: v }),
  setJoined: (me, snap) => set({ joined: true, joining: false, me, ...(snap ? { snapshot: snap } : {}) }),
  setJoinError: (msg) => set({ joinError: msg, joining: false }),
  setSnapshot: (snap) => set({ snapshot: snap }),
  patchSnapshot: (fn) => set((st) => (st.snapshot ? { snapshot: fn(st.snapshot) } : {})),
  setTool: (tool) => set({ tool, selectedDrawingId: null }),
  setDrawColor: (drawColor) => set({ drawColor }),
  setDrawSize: (drawSize) => set({ drawSize }),
  select: (id) => set({ selectedTokenId: id }),
  target: (id) => set({ targetedTokenId: id }),
  showToast: (msg, type = 'info') => {
    set({ toast: msg, toastType: type });
    window.setTimeout(() => {
      if (useVttStore.getState().toast === msg) set({ toast: null });
    }, 3500);
  },
  setSideTab: (sidebarTab) => set({ sidebarTab, sidebarCollapsed: false }),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setCreatorOpen: (creatorOpen) => set({ creatorOpen }),
  setOpenSheet: (openSheetId) => set({ openSheetId }),
  setRoomId: (roomId) => set({ roomId }),
  pushDiceShow: (item) =>
    set((st) => ({ diceShow: [...st.diceShow.slice(-5), item] })),
  shiftDiceShow: () =>
    set((st) => ({ diceShow: st.diceShow.slice(1) })),
  pushUndo: (stroke) => set((st) => ({
    undoStack: [...st.undoStack.slice(-MAX_UNDO + 1), stroke.id],
    redoStack: [...st.redoStack.slice(-MAX_UNDO + 1), stroke],
  })),
  popUndo: () => {
    const st = get();
    const lastId = st.undoStack[st.undoStack.length - 1];
    if (!lastId) return null;
    const stroke = st.redoStack.find((s) => s.id === lastId) ?? null;
    set({ undoStack: st.undoStack.slice(0, -1) });
    return stroke;
  },
  popRedo: () => {
    const st = get();
    const last = st.redoStack[st.redoStack.length - 1];
    if (!last) return null;
    set({ redoStack: st.redoStack.slice(0, -1) });
    return last;
  },
  setSelectedDrawingId: (selectedDrawingId) => set({ selectedDrawingId }),
  setShapeFilled: (shapeFilled) => set({ shapeFilled }),
  setStickyColor: (stickyColor) => set({ stickyColor }),
  toggleInventoryOpen: () => set((st) => ({ inventoryOpen: !st.inventoryOpen })),
}));
