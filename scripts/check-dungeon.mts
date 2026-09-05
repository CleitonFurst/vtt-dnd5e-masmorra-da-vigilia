import { buildDungeonWalls, DUNGEON_ROOMS, DUNGEON_DOORS, CELL } from '../packages/shared/src/dungeon';

let fails = 0;
const ok = (cond: boolean, msg: string): void => {
  console.log((cond ? 'PASS' : 'FAIL') + ' - ' + msg);
  if (!cond) fails++;
};

const walls = buildDungeonWalls();
const cs = CELL;
const inside = (x: number, y: number): boolean =>
  DUNGEON_ROOMS.some((r) => x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2);

// 1. todas as paredes caem exatamente nas bordas das células
ok(walls.every((w) => w.x1 % cs === 0 && w.x2 % cs === 0 && w.y1 % cs === 0 && w.y2 % cs === 0),
  'Paredes em múltiplos exatos de célula');

// 2. cada segmento coincide com a borda de alguma sala (alinhamento piso↔parede)
const onRoomEdge = (w: { x1: number; y1: number; x2: number; y2: number }): boolean =>
  DUNGEON_ROOMS.some((r) => {
    const L = r.x1 * cs, R = (r.x2 + 1) * cs, T = r.y1 * cs, B = (r.y2 + 1) * cs;
    const horiz = w.y1 === w.y2 && w.x2 > w.x1;
    const vert = w.x1 === w.x2 && w.y2 > w.y1;
    if (horiz) return (w.y1 === T || w.y1 === B) && w.x1 >= L && w.x2 <= R;
    if (vert) return (w.x1 === L || w.x1 === R) && w.y1 >= T && w.y2 <= B;
    return false;
  });
ok(walls.every(onRoomEdge), 'Todo segmento de parede coincide com borda de sala');

// 3. portas realmente abertas: nenhum segmento cruza os lados da célula do umbral
const doorOpen = DUNGEON_DOORS.every((d) => {
  const cx = d.cx * cs, cy = d.cy * cs;
  const segs = d.vert
    ? [
        { x1: cx, y1: cy, x2: cx, y2: cy + cs },
        { x1: cx, y1: cy, x2: cx, y2: cy + cs },
      ]
    : [
        { x1: cx, y1: cy, x2: cx + cs, y2: cy },
        { x1: cx, y1: cy, x2: cx + cs, y2: cy },
      ];
  void segs;
  // verifica os dois lados relevantes conforme orientação
  const blocking =
    d.vert
      ? walls.filter((w) => w.x1 === cx && w.x2 === cx && ((w.y1 >= cy && w.y1 < cy + cs) || (w.y2 > cy && w.y2 <= cy + cs)))
      : walls.filter((w) => w.y1 === cy && w.y2 === cy && ((w.x1 >= cx && w.x1 < cx + cs) || (w.x2 > cx && w.x2 <= cx + cs)));
  return blocking.length === 0;
});
ok(doorOpen, 'Todos os umbrais estão abertos');

// 4. masmourra totalmente conectada (BFS respeitando paredes)
const key = (x: number, y: number): string => x + ',' + y;
const wallSet = new Set<string>();
for (const w of walls) {
  if (w.y1 === w.y2) {
    const gy = w.y1 / cs;
    for (let gx = w.x1 / cs; gx < w.x2 / cs; gx++) wallSet.add('h:' + gx + ':' + gy); // bloqueia (gx,gy-1)<->(gx,gy)
  } else {
    const gx = w.x1 / cs;
    for (let gy = w.y1 / cs; gy < w.y2 / cs; gy++) wallSet.add('v:' + gx + ':' + gy); // bloqueia (gx-1,gy)<->(gx,gy)
  }
}
const startRoom = DUNGEON_ROOMS[0];
const seen = new Set([key(startRoom.x1, startRoom.y1)]);
const queue = [[startRoom.x1, startRoom.y1]];
while (queue.length) {
  const [x, y] = queue.shift() as [number, number];
  const step = (nx: number, ny: number, blk: string): void => {
    if (!inside(nx, ny) || seen.has(key(nx, ny)) || wallSet.has(blk)) return;
    seen.add(key(nx, ny));
    queue.push([nx, ny]);
  };
  step(x, y - 1, `h:${x}:${y}`);
  step(x, y + 1, `h:${x}:${y + 1}`);
  step(x - 1, y, `v:${x}:${y}`);
  step(x + 1, y, `v:${x + 1}:${y}`);
}
let totalCells = 0;
for (const r of DUNGEON_ROOMS) totalCells += (r.x2 - r.x1 + 1) * (r.y2 - r.y1 + 1);
ok(seen.size === totalCells, `Conectividade total: ${seen.size}/${totalCells} células alcançáveis a partir da entrada`);

// 5. tokens de monstro dentro de salas (sem coordenadas aqui — só estrutura)
console.log(fails === 0 ? '\nTUDO ALINHADO' : `\n${fails} PROBLEMAS`);
process.exit(fails === 0 ? 0 : 1);
