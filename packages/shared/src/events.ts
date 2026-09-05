import type { CharacterSheet, RoomSnapshot, Token, RollEntry, ChatMessage, MapItem, TokenKind } from './types';

export interface SocketData {
  roomId?: string;
  playerId?: string;
  name?: string;
  role?: 'dm' | 'player';
}

export type Visibility = 'all' | 'dm';

export interface DiceRollRequest {
  formula: string;
  label?: string;
  visibility: Visibility;
}

export type CheckRequest =
  | { kind: 'd20'; modifier: number; dc?: number; label?: string; visibility: Visibility }
  | { kind: 'pool'; poolSize: number; difficulty: number; visibility: Visibility }
  | { kind: 'percentile'; skillValue: number; bonusDice?: number; penaltyDice?: number; visibility: Visibility }
  | { kind: 'fixed'; modifier: number; visibility: Visibility };

export interface SheetCreateInputMsg {
  name: string;
  raceId: string;
  classId: string;
  baseAbilities: Record<string, number>;
  armorId?: string;
  weaponId?: string;
  shieldId?: string;
  knownSpells?: string[];
  backstory?: string;
  mdg?: { hpMax?: number };
}

export interface ClientToServerEvents {
  'room:create': (ack: (res: { ok: boolean; roomId?: string; error?: string; seats?: { players: number; maxPlayers: number } }) => void) => void;
  'room:join': (
    argA: string,
    argB: string,
    argC?:
      | 'dm'
      | 'player'
      | ((res: {
          ok: boolean;
          role?: 'dm' | 'player';
          playerId?: string;
          roomId?: string;
          error?: string;
          seats?: { players: number; maxPlayers: number };
        }) => void),
    argD?: (res: {
      ok: boolean;
      role?: 'dm' | 'player';
      playerId?: string;
      roomId?: string;
      error?: string;
      seats?: { players: number; maxPlayers: number };
    }) => void,
  ) => void;

  'token:add': (data: Partial<Token> & { name: string }, ack?: (res: { ok: boolean; error?: string }) => void) => void;
  'token:move': (data: { id: string; x: number; y: number }) => void;
  'token:remove': (data: { id: string }) => void;
  'token:damage': (data: { id: string; amount: number }) => void;
  'token:toggleDead': (data: { id: string }) => void;
  'token:setKind': (data: { id: string; kind: TokenKind }) => void;

  'wall:add': (data: { x1: number; y1: number; x2: number; y2: number }) => void;
  'wall:remove': (data: { x1: number; y1: number; x2: number; y2: number }) => void;
  'fog:paint': (data: { cells: string[]; mode: 'hide' | 'reveal' }) => void;

  'map:draw': (
    data: {
      id: string;
      points: { x: number; y: number }[];
      color: number;
      size?: number;
      shape?: 'freehand' | 'rect' | 'circle' | 'line' | 'text' | 'sticky';
      text?: string;
      fontSize?: number;
      filled?: boolean;
      stickyBg?: number;
    },
    ack?: (res: { ok: boolean }) => void,
  ) => void;
  'map:drawClear': () => void;
  'map:drawErase': (data: { ids: string[] }, ack?: (res: { ok: boolean }) => void) => void;
  'map:drawMove': (data: { id: string; dx: number; dy: number }) => void;

  'dice:roll': (req: DiceRollRequest) => void;
  'dice:check': (req: CheckRequest) => void;

  'lobby:start': () => void;

  'inventory:collect': (req: { itemId: string; x: number; y: number }, ack?: (res: { ok: boolean; error?: string }) => void) => void;
  'inventory:drop': (req: { itemId: string }, ack?: (res: { ok: boolean; error?: string }) => void) => void;
  'inventory:use': (req: { itemId: string }, ack?: (res: { ok: boolean; error?: string }) => void) => void;
  'inventory:equip': (req: { itemId: string; equipped: boolean }, ack?: (res: { ok: boolean; error?: string }) => void) => void;
  'sheet:editSpellSlots': (req: { sheetId: string; delta: number }) => void;
  'dm:place-item': (req: { itemId: string; x: number; y: number; quantity?: number }, ack?: (res: { ok: boolean; error?: string }) => void) => void;
  'dm:remove-item': (req: { id?: string; itemId?: string; x?: number; y?: number }, ack?: (res: { ok: boolean; error?: string }) => void) => void;
  'item:move': (req: { id: string; x: number; y: number }) => void;

  'chat:send': (text: string) => void;

  'sheet:create': (
    input: SheetCreateInputMsg,
    ack?: (res: { ok: boolean; errors?: { field: string; message: string }[] }) => void,
  ) => void;
}

export interface ServerToClientEvents {
  'room:snapshot': (snapshot: RoomSnapshot) => void;
  'room:role': (role: 'dm' | 'player') => void;
  'seats:update': (seats: { players: number; maxPlayers: number; dmName: string }) => void;

  'token:added': (token: Token) => void;
  'token:moved': (data: { id: string; x: number; y: number }) => void;
  'token:removed': (id: string) => void;
  'token:updated': (token: Token) => void;

  'wall:added': (data: { x1: number; y1: number; x2: number; y2: number }) => void;
  'wall:removed': (data: { x1: number; y1: number; x2: number; y2: number }) => void;
  'fog:painted': (data: { cells: string[]; mode: 'hide' | 'reveal' }) => void;

  'map:drawing': (stroke: import('./types').DrawStroke) => void;
  'map:drawCleared': () => void;
  'map:drawingRemoved': (data: { ids: string[] }) => void;
  'map:drawingMoved': (data: { id: string; dx: number; dy: number }) => void;

  'dice:rolled': (entry: RollEntry) => void;
  'lobby:started': () => void;

  'sheet:updated': (sheet: CharacterSheet) => void;

  'chat:message': (msg: ChatMessage) => void;

  'sheet:added': (sheet: CharacterSheet) => void;
  'inventory:updated': (data: { sheetId: string; inventory: CharacterSheet['inventory'] }) => void;
  'items:changed': (items: MapItem[]) => void;
  'item:moved': (data: { id: string; x: number; y: number }) => void;

  error: (message: string) => void;
}
