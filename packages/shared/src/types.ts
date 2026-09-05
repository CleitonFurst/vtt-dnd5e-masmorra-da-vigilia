import type { AbilityKey, DerivedSheet } from './rules';

// ------------------------------------------------------------------ mapa

/** Distância euclidiana entre os centros de dois tokens, em células. */
export function tokenDistanceCells(a: Token, b: Token, cellSize: number): number {
  const acx = a.x + (a.sizeCells * cellSize) / 2;
  const acy = a.y + (a.sizeCells * cellSize) / 2;
  const bcx = b.x + (b.sizeCells * cellSize) / 2;
  const bcy = b.y + (b.sizeCells * cellSize) / 2;
  return Math.hypot(acx - bcx, acy - bcy) / cellSize;
}

export interface Wall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface GameMap {
  widthCells: number;
  heightCells: number;
  cellSize: number;
  walls: Wall[];
  /** células escondidas pela névoa de guerra */
  fogHidden: string[];
}

export const cellKey = (x: number, y: number): string => `${x},${y}`;
export const parseCellKey = (key: string): { x: number; y: number } => {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
};

// ----------------------------------------------------------------- tokens

export type TokenKind = 'pc' | 'monster' | 'npc';

export interface MonsterAttack {
  name: string;
  bonus: number;
  dmgDice: string;
  dmgMod: number;
  rangeCells: number;
}

export interface Token {
  id: string;
  name: string;
  kind: TokenKind;
  x: number;
  y: number;
  sizeCells: number;
  color: string;
  hp: number;
  maxHp: number;
  ac: number;
  speedCells?: number;
  initiative: number;
  visionRangeCells: number;
  hiddenFromPlayers: boolean;
  dead: boolean;
  dying?: boolean;
  stabilized?: boolean;
  ownerPlayerId: string | null;
  attacks?: MonsterAttack[];
  attackRange?: number;
}

// ------------------------------------------------------------------ ficha

/** Ficha de herói (base compartilhada). */
export interface CharacterSheet {
  id: string;
  tokenId: string;
  ownerId: string;
  name: string;
  raceId: string;
  classId: string;
  level: number;
  abilities: Record<AbilityKey, number>;
  spellSlots: { used: number; total: number };
  /** magias conhecidas (slugs) — magos escolhem 2, clérigos 2, etc. */
  knownSpells: string[];
  /** poções de cura no cinto (2d4+2 cada) */
  potions: number;
  /** inventário do personagem */
  inventory: InventoryItem[];
  /** história breve do personagem */
  backstory?: string;
  derived: DerivedSheet;
}

export interface InventoryItem {
  itemId: string;
  name: string;
  category: import('@vtt/shared').ItemCategory;
  quantity: number;
  equipped?: boolean;
  charges?: number;
  maxCharges?: number;
  identified: boolean;
}

export interface MapItem {
  id: string;
  itemId: string;
  name: string;
  category: import('@vtt/shared').ItemCategory;
  x: number;
  y: number;
  quantity: number;
  label?: string;
  imageUrl?: string;
}

// ------------------------------------------------------------------- dados

export interface RollGroup {
  label: string;
  sides: number;
  values: number[];
}

export interface RollDetail {
  groups: RollGroup[];
  modifier: number;
}

/** Resultado classificado por sistema, calculado no servidor. */
export type SystemRoll =
  | {
      system: 'd20';
      die: number;
      total: number;
      dc?: number;
      margin?: number;
      outcome: 'critical-success' | 'success' | 'failure' | 'critical-failure' | 'neutral';
    }
  | {
      system: 'pool';
      poolSize: number;
      difficulty: number;
      successes: number;
      dramatic: boolean;
      botch: boolean;
    }
  | {
      system: 'percentile';
      skillValue: number;
      roll: number;
      grade: 'regular' | 'hard' | 'extreme' | 'fumble' | 'failure';
    }
  | {
      system: 'fixed';
      total: number;
      outcome: 'full' | 'partial' | 'fail';
    };

export interface RollEntry {
  id: string;
  roller: string;
  formula: string;
  total: number;
  visibility: 'all' | 'dm';
  check?: SystemRoll;
  detail: RollDetail;
}

// ---------------------------------------------------------------- snapshot

export interface PlayerInfo {
  id: string;
  name: string;
  role: 'dm' | 'player';
}

export interface SeatInfo {
  players: number;
  maxPlayers: number;
  /** nome do Mestre sentado na mesa */
  dmName: string;
}

/** traço de desenho colaborativo no mapa (coordenadas em px do mundo) */
export interface DrawStroke {
  id: string;
  points: { x: number; y: number }[];
  color: number;
  size: number;
  author: string;
  /** tipo do traço — livre (padrão), retângulo, círculo, linha, texto ou sticky note */
  shape?: 'freehand' | 'rect' | 'circle' | 'line' | 'text' | 'sticky';
  /** conteúdo de texto (quando shape === 'text' ou 'sticky') */
  text?: string;
  /** tamanho da fonte para texto (quando shape === 'text' ou 'sticky') */
  fontSize?: number;
  /** preencher a forma (quando shape é rect/circle) */
  filled?: boolean;
  /** cor de fundo do sticky note */
  stickyBg?: number;
}

export interface RoomSnapshot {
  roomId: string;
  seats: SeatInfo;
  /** true até o Mestre iniciar a expedição */
  lobbyOpen: boolean;
  map: GameMap;
  tokens: Token[];
  sheets: CharacterSheet[];
  /** itens espalhados no mapa */
  items: MapItem[];
  rolls: RollEntry[];
  chat: ChatMessage[];
  drawings: DrawStroke[];
}

export interface ChatMessage {
  id: string;
  from: string;
  text: string;
  ts: number;
}
