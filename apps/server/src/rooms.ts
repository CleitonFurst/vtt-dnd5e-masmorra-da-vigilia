import { CELL, MAP_H, MAP_W, type GameMap, type RoomSnapshot, type Token, type CharacterSheet, type RollEntry, type ChatMessage, type DrawStroke, type MapItem } from '@vtt/shared';

export const MAX_PLAYERS = 4;

export interface Seat {
  socketId: string;
  playerId: string;
  name: string;
  role: 'dm' | 'player';
}

let idSeq = 0;
export const uid = (prefix: string): string => `${prefix}-${(++idSeq).toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Masmoura da Vigília: 4 salas conectadas por corredores com portas. */
function initialMap(): GameMap {
  // Mapa EM BRANCO: sem paredes e totalmente visível — tela limpa para o grupo desenhar
  return { widthCells: MAP_W, heightCells: MAP_H, cellSize: CELL, walls: [], fogHidden: [] };
}

export class Room {
  readonly id: string;
  map: GameMap;
  tokens: Token[] = [];
  sheets: CharacterSheet[] = [];
  /** itens espalhados no mapa (visíveis a todos) */
  items: MapItem[] = [];
  /** true até o Mestre dar início à expedição */
  lobbyOpen = true;
  rolls: RollEntry[] = [];
  chat: ChatMessage[] = [];
  drawings: DrawStroke[] = [];
  seats: Seat[] = [];

  constructor(id: string) {
    this.id = id;
    this.map = initialMap();
  }

  /** Primeiro conector vira Mestre; depois, até MAX_PLAYERS jogadores. */
  join(socketId: string, name: string, want: 'dm' | 'player'): { ok: true; seat: Seat } | { ok: false; error: string } {
    if (want === 'dm') {
      if (this.seats.some((s) => s.role === 'dm')) {
        return { ok: false, error: 'Já existe um Mestre sentado à mesa.' };
      }
      const seat: Seat = { socketId, playerId: uid('dm'), name, role: 'dm' };
      this.seats.push(seat);
      return { ok: true, seat };
    }
    const playerSeats = this.seats.filter((s) => s.role === 'player');
    if (playerSeats.length >= MAX_PLAYERS) {
      return { ok: false, error: `Sala cheia (${MAX_PLAYERS}/${MAX_PLAYERS} heróis). Aguarde uma vaga.` };
    }
    const seat: Seat = { socketId, playerId: uid('pc'), name, role: 'player' };
    this.seats.push(seat);
    return { ok: true, seat };
  }

  leave(socketId: string): void {
    this.seats = this.seats.filter((s) => s.socketId !== socketId);
  }

  seatInfo(): { players: number; maxPlayers: number; dmName: string } {
    return {
      players: this.seats.filter((s) => s.role === 'player').length,
      maxPlayers: MAX_PLAYERS,
      dmName: this.seats.find((s) => s.role === 'dm')?.name ?? 'Mestre',
    };
  }

  seatBySocket(socketId: string): Seat | undefined {
    return this.seats.find((s) => s.socketId === socketId);
  }

  snapshot(): RoomSnapshot {
    return {
      roomId: this.id,
      seats: this.seatInfo(),
      lobbyOpen: this.lobbyOpen,
      map: this.map,
      tokens: this.tokens,
      sheets: this.sheets,
      items: this.items,
      rolls: this.rolls.slice(-40),
      chat: this.chat.slice(-50),
      drawings: this.drawings.slice(-300),
    };
  }
}

export class RoomManager {
  private rooms = new Map<string, Room>();

  has(id: string): boolean {
    return this.rooms.has(id);
  }

  getOrCreate(id: string): Room {
    let room = this.rooms.get(id);
    if (!room) {
      room = new Room(id);
      this.rooms.set(id, room);
    }
    return room;
  }

  get(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  /** Descarta todas as salas (estado em memória volta ao inicial). */
  resetAll(): void {
    this.rooms.clear();
  }
}
