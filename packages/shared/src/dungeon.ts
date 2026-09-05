import type { Wall } from './types';

/** Dimensões fixas da masmourra em células. */
export const CELL = 64;
export const MAP_W = 120;
export const MAP_H = 60;

export type RoomStyle = 'hall' | 'goblin' | 'orc' | 'boss' | 'corr';

export interface DungeonRoom {
  name: string;
  style: RoomStyle;
  /** interior inclusivo, em células */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * FONTE ÚNICA DE VERDADE do layout.
 * O servidor deriva as paredes daqui; o cliente pinta pisos e adereços daqui.
 * Impossível desalinhar.
 */
export const DUNGEON_ROOMS: DungeonRoom[] = [
  { name: 'Entrada', style: 'hall', x1: 3, y1: 10, x2: 9, y2: 16 },
  { name: 'Corredor Norte', style: 'corr', x1: 10, y1: 13, x2: 14, y2: 13 },
  { name: 'Posto Goblin', style: 'goblin', x1: 15, y1: 6, x2: 23, y2: 16 },
  { name: 'Escada Sul', style: 'corr', x1: 19, y1: 17, x2: 19, y2: 19 },
  { name: 'Covil Orc', style: 'orc', x1: 13, y1: 20, x2: 25, y2: 24 },
  { name: 'Corredor Leste', style: 'corr', x1: 26, y1: 22, x2: 29, y2: 22 },
  { name: 'Câmara do Espectro', style: 'boss', x1: 30, y1: 16, x2: 38, y2: 24 },
];

export function roomByStyle(style: RoomStyle): DungeonRoom {
  return DUNGEON_ROOMS.find((r) => r.style === style) as DungeonRoom;
}

/** Umbrais (portas): a célula cujos dois lados ficam abertos. */
export interface DungeonDoor {
  cx: number;
  cy: number;
  /** true = vão atravessa uma parede vertical (porta a leste/oeste) */
  vert: boolean;
}

export const DUNGEON_DOORS: DungeonDoor[] = [
  { cx: 10, cy: 13, vert: true }, // entrada → corredor norte
  { cx: 15, cy: 13, vert: true }, // corredor norte → posto goblin
  { cx: 19, cy: 17, vert: false }, // posto goblin → escada sul
  { cx: 19, cy: 20, vert: false }, // escada sul → covil orc
  { cx: 26, cy: 22, vert: true }, // covil orc → corredor leste
  { cx: 30, cy: 22, vert: true }, // corredor leste → câmara do espectro
];

/**
 * Paredes derivadas das salas: perímetro célula a célula (segmentos
 * compartilhados são unificados) com os vãos das portas abertos.
 * Convenção: `h:x,y` = segmento na linha y*CELL cobrindo a coluna x;
 * `v:x,y` = segmento na coluna x*CELL cobrindo a linha y.
 */
export function buildDungeonWalls(): Wall[] {
  const cs = CELL;
  const segs = new Map<string, Wall>();

  for (const r of DUNGEON_ROOMS) {
    for (let x = r.x1; x <= r.x2; x++) {
      const kTop = `h:${x},${r.y1}`;
      const kBot = `h:${x},${r.y2 + 1}`;
      if (!segs.has(kTop)) segs.set(kTop, { x1: x * cs, y1: r.y1 * cs, x2: (x + 1) * cs, y2: r.y1 * cs });
      if (!segs.has(kBot)) segs.set(kBot, { x1: x * cs, y1: (r.y2 + 1) * cs, x2: (x + 1) * cs, y2: (r.y2 + 1) * cs });
    }
    for (let y = r.y1; y <= r.y2; y++) {
      const kL = `v:${r.x1},${y}`;
      const kR = `v:${r.x2 + 1},${y}`;
      if (!segs.has(kL)) segs.set(kL, { x1: r.x1 * cs, y1: y * cs, x2: r.x1 * cs, y2: (y + 1) * cs });
      if (!segs.has(kR)) segs.set(kR, { x1: (r.x2 + 1) * cs, y1: y * cs, x2: (r.x2 + 1) * cs, y2: (y + 1) * cs });
    }
  }

  for (const d of DUNGEON_DOORS) {
    if (d.vert) {
      segs.delete(`v:${d.cx},${d.cy}`); // parede leste da célula anterior / oeste da seguinte
    } else {
      segs.delete(`h:${d.cx},${d.cy}`); // parede sul de cima / norte de baixo
    }
  }

  return [...segs.values()];
}
