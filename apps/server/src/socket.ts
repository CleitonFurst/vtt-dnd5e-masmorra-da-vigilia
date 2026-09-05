import type {
  CheckRequest,
  ClientToServerEvents,
  ServerToClientEvents,
  SheetCreateInputMsg,
  SocketData,
  SystemRoll,
  Token,
  TokenKind,
} from '@vtt/shared';
import { cellKey, tokenDistanceCells } from '@vtt/shared';
import { resolveCheck, rollFormula, rollD20Check } from '@vtt/shared';
import { RACE_BY_ID, validateCreateInput, computeDerivedSheet, abilityMod, WEAPON_BY_ID, ITEM_BY_ID, ARMOR_BY_ID, touchAc, SPELLCASTING_ABILITY, SRD_SPELLS, SRD_MONSTERS, INVENTORY_ITEMS } from '@vtt/shared';
import type { Socket, Server } from 'socket.io';
import { randomUUID as cryptoUuid } from 'node:crypto';
import { MAX_PLAYERS, uid, type Room, type RoomManager } from './rooms';

const clampNum = (v: number, min: number, max: number): number => Math.max(min, Math.min(v, max));

type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<never, never>, SocketData>;
type IoServer = Server<ClientToServerEvents, ServerToClientEvents, Record<never, never>, SocketData>;

export function broadcastRoll(room: Room, io: any, entry: import('@vtt/shared').RollEntry): void {
  room.rolls.push(entry);
  if (room.rolls.length > 200) room.rolls.splice(0, room.rolls.length - 200);
  if (entry.visibility === 'dm') {
    const targets = room.seats.filter((s) => s.role === 'dm');
    for (const seat of targets) {
      io.to(seat.socketId).emit('dice:rolled', entry);
    }
  } else {
    io.to(room.id).emit('dice:rolled', entry);
  }
}

function makeRoll(
  roller: string,
  formula: string,
  total: number,
  detail: { groups: { label: string; sides: number; values: number[] }[]; modifier: number },
  visibility: 'all' | 'dm',
  check?: import('@vtt/shared').SystemRoll,
): import('@vtt/shared').RollEntry {
  return { id: uid('roll'), roller, formula, total, visibility, check, detail };
}

/** Encontra uma célula livre perto de (cx, cy) sem parede cruzando o centro. */
function findSpawnCell(room: Room, cx: number, cy: number): { x: number; y: number } {
  const cs = room.map.cellSize;
  const occupied = new Set(room.tokens.map((t) => cellKey(Math.floor(t.x / cs), Math.floor(t.y / cs))));
  for (let r = 0; r < 6; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 1 || y < 1 || x >= room.map.widthCells - 1 || y >= room.map.heightCells - 1) continue;
        if (occupied.has(cellKey(x, y))) continue;
        const px = x * cs + cs / 2;
        const py = y * cs + cs / 2;
        const crossesWall = room.map.walls.some((w) => segIntersectsRect(w.x1, w.y1, w.x2, w.y2, px - 4, py - 4, px + 4, py + 4));
        if (!crossesWall) return { x: x * cs, y: y * cs };
      }
    }
  }
  return { x: cx * cs, y: cy * cs };
}

function segIntersectsRect(x1: number, y1: number, x2: number, y2: number, rx1: number, ry1: number, rx2: number, ry2: number): boolean {
  if (Math.max(x1, x2) < rx1 || Math.min(x1, x2) > rx2 || Math.max(y1, y2) < ry1 || Math.min(y1, y2) > ry2) return false;
  return true;
}

export function registerHandlers(io: IoServer, manager: RoomManager): void {
  io.on('connection', (socket) => attachSocket(socket, io, manager));
}

function attachSocket(socket: IoSocket, io: { to: (room: string) => { emit: (ev: any, ...args: any[]) => void } }, manager: RoomManager): void {
  socket.on('room:create', (ack) => {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    do {
      code = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
    } while (manager.has(code));
    const room = manager.getOrCreate(code);
    ack?.({ ok: true, roomId: code, seats: room.seatInfo() });
  });

  socket.on('room:join', (argA: string, argB: string, argC?: unknown, argD?: unknown) => {
    const legacy = typeof argC === 'function' && typeof argD !== 'function';
    const ack = (legacy ? argC : argD) as
      | ((res: {
          ok: boolean;
          role?: 'dm' | 'player';
          playerId?: string;
          roomId?: string;
          error?: string;
          seats?: { players: number; maxPlayers: number };
        }) => void)
      | undefined;
    const roomId = String(legacy ? 'sala-demo' : argA ?? '').trim().slice(0, 16) || 'sala-demo';
    const rawName = String(legacy ? argA : argB ?? '');
    const want = String(legacy ? argB : argC);
    if (!manager.has(roomId)) return ack?.({ ok: false, error: `Sala "${roomId}" não encontrada. Confira o código ou o link.` });
    const room = manager.getOrCreate(roomId);
    const res = room.join(socket.id, rawName.trim().slice(0, 24), want === 'dm' ? 'dm' : 'player');
    if (!res.ok) return ack?.({ ok: false, error: res.error });

    socket.data.roomId = roomId;
    socket.data.playerId = res.seat.playerId;
    socket.data.name = rawName.trim();
    socket.data.role = res.seat.role;
    socket.join(roomId);

    ack?.({ ok: true, role: res.seat.role, playerId: res.seat.playerId, roomId, seats: room.seatInfo() });
    io.to(roomId).emit('seats:update', room.seatInfo());
    socket.emit('room:snapshot', room.snapshot());
  });

  const roomOf = (): Room | undefined => {
    const id = socket.data.roomId;
    return id ? manager.get(id) : undefined;
  };

  const isDm = (): boolean => socket.data.role === 'dm';

  /** Jogadores só agem depois que a Mestra inicia a expedição; a Mestra prepara a mesa livremente. */
  const expeditionBlocked = (): boolean => {
    if (isDm()) return false;
    const room = roomOf();
    return !!room?.lobbyOpen;
  };
  const EXPEDICAO_MSG = 'A expedição ainda não começou. Aguarde a Mestra iniciar no topo da tela.';

  // ------------------------------------------------------------------ tokens

  socket.on('token:add', (data, ack) => {
    const room = roomOf();
    if (!room || !socket.data.playerId) return ack?.({ ok: false, error: 'Entre na sala primeiro.' });
    if (!isDm()) return ack?.({ ok: false, error: 'Somente a Mestra invoca criaturas.' });

    const spawn = findSpawnCell(room, Math.floor((data.x ?? 480) / room.map.cellSize), Math.floor((data.y ?? 320) / room.map.cellSize));
    const token: Token = {
      id: uid('tok'),
      name: data.name.slice(0, 28),
      kind: data.kind ?? 'monster',
      x: spawn.x,
      y: spawn.y,
      sizeCells: data.sizeCells ?? 1,
      color: data.color ?? '#6b7280',
      hp: data.hp ?? 10,
      maxHp: data.hp ?? 10,
      ac: data.ac ?? 12,
      speedCells: data.speedCells ?? 6,
      initiative: data.initiative ?? 0,
      visionRangeCells: data.visionRangeCells ?? (data.kind === 'npc' ? 4 : 0),
      hiddenFromPlayers: data.hiddenFromPlayers ?? false,
      dead: false,
      ownerPlayerId: null,
      attacks: data.attacks ?? undefined,
    };
    room.tokens.push(token);
    io.to(room.id).emit('token:added', token);
    ack?.({ ok: true });
  });

  socket.on('token:move', ({ id, x, y }) => {
    const room = roomOf();
    if (!room) return;
    const token = room.tokens.find((t) => t.id === id);
    if (!token) return;
    const mine = token.ownerPlayerId !== null && token.ownerPlayerId === socket.data.playerId;
    if (!mine && !isDm()) return;
    if (mine && expeditionBlocked()) { socket.emit('error', EXPEDICAO_MSG); return; }

    const cs = room.map.cellSize;
    token.x = Math.max(0, Math.min(x, room.map.widthCells * cs - token.sizeCells * cs));
    token.y = Math.max(0, Math.min(y, room.map.heightCells * cs - token.sizeCells * cs));
    io.to(room.id).emit('token:moved', { id: token.id, x: token.x, y: token.y });

    // exploração estilo Solasta: a visão do herói revela a névoa em permanência
    if (token.visionRangeCells > 0 && !token.dead && !(token.hiddenFromPlayers && !isDm())) {
      const R = token.visionRangeCells;
      const ccx = Math.floor((token.x + (token.sizeCells * cs) / 2) / cs);
      const ccy = Math.floor((token.y + (token.sizeCells * cs) / 2) / cs);
      const hidden = new Set(room.map.fogHidden);
      const revealed: string[] = [];
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          if (dx * dx + dy * dy > (R + 0.5) * (R + 0.5)) continue;
          const key = cellKey(ccx + dx, ccy + dy);
          if (hidden.delete(key)) revealed.push(key);
        }
      }
      if (revealed.length > 0) {
        room.map.fogHidden = [...hidden];
        io.to(room.id).emit('fog:painted', { cells: revealed, mode: 'reveal' });
      }
    }
  });

  socket.on('token:remove', ({ id }) => {
    const room = roomOf();
    if (!room || !isDm()) return;
    room.tokens = room.tokens.filter((t) => t.id !== id);
    room.sheets = room.sheets.filter((s) => s.tokenId !== id);
    io.to(room.id).emit('token:removed', id);
  });

  socket.on('token:damage', ({ id, amount }) => {
    const room = roomOf();
    if (!room || !isDm()) return;
    const value = Number(amount) || 0;
    if (value < 0) {
      applyHeal(room, io, id, -value);
    } else {
      applyDamage(room, io, id, value);
    }
  });

  socket.on('token:toggleDead', ({ id }) => {
    const room = roomOf();
    if (!room || !socket.data.playerId) return;
    const token = room.tokens.find((t) => t.id === id);
    if (!token) return;
    const mine = token.ownerPlayerId !== null && token.ownerPlayerId === socket.data.playerId;
    if (!mine && !isDm()) return;

    token.dead = !token.dead;
    token.dying = false;
    token.stabilized = false;
    io.to(room.id).emit('token:updated', token);
  });

  socket.on('token:setKind', ({ id, kind }) => {
    const room = roomOf();
    if (!room || !isDm()) return;
    const token = room.tokens.find((t) => t.id === id);
    if (!token) return;

    const valid: TokenKind[] = ['pc', 'monster', 'npc'];
    if (!valid.includes(kind)) return;
    token.kind = kind;
    io.to(room.id).emit('token:updated', token);
  });

  // ------------------------------------------------------------ paredes/névoa

  socket.on('wall:add', (data) => {
    const room = roomOf();
    if (!room || !isDm()) return;
    room.map.walls.push(data);
    io.to(room.id).emit('wall:added', data);
  });

  socket.on('wall:remove', (data) => {
    const room = roomOf();
    if (!room || !isDm()) return;
    const eq = (w: { x1: number; y1: number; x2: number; y2: number }): boolean =>
      (w.x1 === data.x1 && w.y1 === data.y1 && w.x2 === data.x2 && w.y2 === data.y2) ||
      (w.x1 === data.x2 && w.y1 === data.y2 && w.x2 === data.x1 && w.y2 === data.y1);
    const idx = room.map.walls.findIndex(eq);
    if (idx === -1) return;
    const [removed] = room.map.walls.splice(idx, 1);
    io.to(room.id).emit('wall:removed', removed);
  });

  socket.on('fog:paint', ({ cells, mode }) => {
    const room = roomOf();
    if (!room || !isDm()) return;
    const set = new Set(room.map.fogHidden);
    for (const c of cells) {
      if (mode === 'hide') set.add(c);
      else set.delete(c);
    }
    room.map.fogHidden = [...set];
    io.to(room.id).emit('fog:painted', { cells, mode });
  });

  // -------------------------------------------------- desenho colaborativo

  socket.on('map:draw', (data, ack) => {
    const room = roomOf();
    if (!room || !socket.data.name) {
      ack?.({ ok: false });
      return;
    }
    if (!data || !Array.isArray(data.points) || data.points.length === 0 || data.points.length > 600) {
      ack?.({ ok: false });
      return;
    }
    const validShapes = new Set(['freehand', 'rect', 'circle', 'line', 'text', 'sticky']);
    const shape = data.shape && validShapes.has(data.shape) ? data.shape : undefined;
    const stroke = {
      id: String(data.id ?? cryptoUuid()).slice(0, 40),
      points: data.points.slice(0, 600).map((p) => ({ x: Math.max(0, Math.round(p.x)), y: Math.max(0, Math.round(p.y)) })),
      color: Number(data.color) || 0xeab308,
      size: Math.min(Math.max(Number(data.size) || 3, 1), 12),
      author: socket.data.name,
      ...(shape ? { shape } : {}),
      ...(data.text ? { text: String(data.text).slice(0, 500) } : {}),
      ...(data.fontSize ? { fontSize: Math.min(Math.max(Number(data.fontSize) || 14, 8), 72) } : {}),
      ...(data.filled ? { filled: true } : {}),
      ...(data.stickyBg ? { stickyBg: Number(data.stickyBg) } : {}),
    };
    room.drawings.push(stroke);
    if (room.drawings.length > 300) room.drawings.splice(0, room.drawings.length - 300);
    io.to(room.id).emit('map:drawing', stroke);
    ack?.({ ok: true });
  });

  socket.on('map:drawClear', () => {
    const room = roomOf();
    if (!room) return;
    room.drawings = [];
    io.to(room.id).emit('map:drawCleared');
  });

  socket.on('map:drawErase', (data, ack) => {
    const room = roomOf();
    if (!room || !socket.data.name) {
      ack?.({ ok: false });
      return;
    }
    const ids = Array.isArray(data?.ids) ? data.ids.filter((v) => typeof v === 'string').slice(0, 300) : [];
    if (ids.length === 0) {
      ack?.({ ok: false });
      return;
    }
    const set = new Set(ids);
    room.drawings = room.drawings.filter((d) => !set.has(d.id));
    io.to(room.id).emit('map:drawingRemoved', { ids });
    ack?.({ ok: true });
  });

  socket.on('map:drawMove', (data) => {
    const room = roomOf();
    if (!room || !data?.id) return;
    const dx = Math.round(Number(data.dx) || 0);
    const dy = Math.round(Number(data.dy) || 0);
    if (dx === 0 && dy === 0) return;
    const drawing = room.drawings.find((d) => d.id === data.id);
    if (!drawing) return;
    for (const pt of drawing.points) {
      pt.x = Math.max(0, pt.x + dx);
      pt.y = Math.max(0, pt.y + dy);
    }
    io.to(room.id).emit('map:drawingMoved', { id: data.id, dx, dy });
  });

  // ------------------------------------------------------------------- dados

  socket.on('dice:roll', (req) => {
    const room = roomOf();
    if (!room || !socket.data.name) return;
    const result = rollFormula(req.formula);
    if (!result) {
      socket.emit('error', `Fórmula inválida: "${req.formula}". Ex.: 2d6+3, 4d6kh3.`);
      return;
    }
    broadcastRoll(room, io, makeRoll(socket.data.name, result.detail.groups[0]?.label ?? req.formula, result.total, result.detail, req.visibility === 'dm' ? 'dm' : 'all'));
  });

  socket.on('dice:check', (req: CheckRequest) => {
    const room = roomOf();
    if (!room || !socket.data.name) return;
    const vis = req.visibility === 'dm' ? 'dm' : 'all';

    // validação anti-cheat básica por tipo de teste
    let bad = '';
    if (req.kind === 'd20') {
      if (!Number.isFinite(req.modifier) || req.modifier < -50 || req.modifier > 50) bad = 'Modificador inválido.';
    } else if (req.kind === 'pool') {
      if (!Number.isInteger(req.poolSize) || req.poolSize < 1 || req.poolSize > 30) bad = 'Pilha deve ter entre 1 e 30 dados.';
      else if (!Number.isInteger(req.difficulty) || req.difficulty < 2 || req.difficulty > 10) bad = 'Dificuldade deve ficar entre 2 e 10.';
    } else if (req.kind === 'percentile') {
      if (!Number.isInteger(req.skillValue) || req.skillValue < 1 || req.skillValue > 99) bad = 'Perícia deve ficar entre 1 e 99.';
    }
    if (bad) {
      socket.emit('error', bad);
      return;
    }

    const resolved = resolveCheck(req);
    broadcastRoll(room, io, makeRoll(socket.data.name, labelForCheck(req), resolved.total, resolved.detail, vis, resolved.check));
  });

  // ----------------------------------------------------------------- inventário

  socket.on('inventory:collect', (req: { itemId: string; x: number; y: number }, ack?: (res: { ok: boolean; error?: string }) => void) => {
    const room = roomOf();
    if (!room || !socket.data.playerId) return ack?.({ ok: false, error: 'Entre na sala primeiro.' });
    const item = room.items.find((it) => it.itemId === req.itemId && it.x === req.x && it.y === req.y);
    if (!item) return ack?.({ ok: false, error: 'Item não encontrado nesta célula.' });
    const sheet = room.sheets.find((s) => s.ownerId === socket.data.playerId);
    if (!sheet) return ack?.({ ok: false, error: 'Somente heróis com ficha podem coletar itens.' });
    const token = room.tokens.find((t) => t.id === sheet.tokenId);
    if (!token || token.dead) return ack?.({ ok: false, error: 'Herói caído não pode coletar.' });

    const def = INVENTORY_ITEMS.find((i) => i.id === item.itemId);
    if (!def) return ack?.({ ok: false, error: 'Item inválido no banco de dados.' });
    const slot = sheet.inventory.find((i) => i.itemId === item.itemId);
    if (slot && def.stackable && slot.quantity < (def.maxStack ?? 99)) {
      const add = Math.min((def.maxStack ?? 99) - slot.quantity, item.quantity);
      slot.quantity += add;
      item.quantity -= add;
    } else {
      sheet.inventory.push({
        itemId: item.itemId,
        name: item.name,
        category: item.category,
        quantity: Math.min(item.quantity, def.maxStack ?? 1),
        equipped: false,
        charges: def.charges ?? undefined,
        maxCharges: def.maxCharges ?? undefined,
        identified: true,
      });
      item.quantity = 0;
    }
    if (item.quantity <= 0) room.items = room.items.filter((it) => it.id !== item.id);
    // sincronizar ficha (sheet:updated) e itens do mapa (items:changed)
    io.to(room.id).emit('sheet:updated', { ...sheet });
    io.to(room.id).emit('items:changed', room.items);
    io.to(room.id).emit('chat:message', { id: uid('msg'), from: 'Masmoura', text: `🎒 ${token.name} coletou ${item.name}${item.quantity > 0 ? ` (×${item.quantity} restante(s))` : ''}.`, ts: Date.now() });
    ack?.({ ok: true });
  });

  socket.on('inventory:drop', (req: { itemId: string }, ack?: (res: { ok: boolean; error?: string }) => void) => {
    const room = roomOf();
    if (!room || !socket.data.playerId) return ack?.({ ok: false, error: 'Entre na sala primeiro.' });
    const sheet = room.sheets.find((s) => s.ownerId === socket.data.playerId);
    if (!sheet) return ack?.({ ok: false, error: 'Somente heróis com ficha podem dropar itens.' });
    const token = room.tokens.find((t) => t.id === sheet.tokenId);
    if (!token || token.dead) return ack?.({ ok: false, error: 'Herói caído não pode dropar.' });
    const slot = sheet.inventory.find((i) => i.itemId === req.itemId);
    if (!slot) return ack?.({ ok: false, error: 'Item não está no inventário.' });
    if (!token || !token.x || !token.y) return ack?.({ ok: false, error: 'Token sem posição.' });

    const existing = room.items.find((it) => it.itemId === req.itemId && it.x === token.x && it.y === token.y);
    if (existing && INVENTORY_ITEMS.find((i) => i.id === req.itemId)?.stackable) {
      existing.quantity += slot.quantity;
      sheet.inventory = sheet.inventory.filter((i) => i.itemId !== req.itemId);
    } else {
      const def = INVENTORY_ITEMS.find((i) => i.id === req.itemId);
      room.items.push({ id: uid('mit'), itemId: req.itemId, name: slot.name, category: slot.category, x: token.x, y: token.y, quantity: slot.quantity });
      sheet.inventory = sheet.inventory.filter((i) => i.itemId !== req.itemId);
    }
    io.to(room.id).emit('sheet:updated', { ...sheet });
    io.to(room.id).emit('items:changed', room.items);
    io.to(room.id).emit('chat:message', { id: uid('msg'), from: 'Masmoura', text: `🗑️ ${token.name} dropou ${slot.name} no chão.`, ts: Date.now() });
    ack?.({ ok: true });
  });

  socket.on('inventory:use', (req: { itemId: string }, ack?: (res: { ok: boolean; error?: string }) => void) => {
    const room = roomOf();
    if (!room || !socket.data.playerId) return ack?.({ ok: false, error: 'Entre na sala primeiro.' });
    const sheet = room.sheets.find((s) => s.ownerId === socket.data.playerId);
    if (!sheet) return ack?.({ ok: false, error: 'Somente heróis com ficha podem usar itens.' });
    const token = room.tokens.find((t) => t.id === sheet.tokenId);
    if (!token || token.dead) return ack?.({ ok: false, error: 'Herói caído não pode usar itens.' });
    const slot = sheet.inventory.find((i) => i.itemId === req.itemId);
    if (!slot) return ack?.({ ok: false, error: 'Item não está no inventário.' });
    const def = INVENTORY_ITEMS.find((i) => i.id === req.itemId);
    if (!def) return ack?.({ ok: false, error: 'Item inválido no banco de dados.' });
    if (def.charges !== undefined && slot.charges !== undefined && slot.charges <= 0) return ack?.({ ok: false, error: 'Sem cargas restantes.' });

    if (def.useEffect) {
      const { kind, spellSlug, amount } = def.useEffect;
      if (kind === 'heal') {
        // Rola dados conforme o tipo de item
        let heal = amount ?? 0;
        let diceLabel = '';
        if (heal === 0) {
          if (req.itemId === 'pocao-cura') { heal = Math.floor(Math.random() * 4) + 1 + Math.floor(Math.random() * 4) + 1 + 2; diceLabel = '2d4+2'; }
          else if (req.itemId === 'pocao-menor') { heal = Math.floor(Math.random() * 4) + 1 + Math.floor(Math.random() * 4) + 1; diceLabel = '2d4'; }
          else if (req.itemId === 'pao') { heal = Math.floor(Math.random() * 8) + 1 + 2; diceLabel = '1d8+2'; }
          else if (req.itemId === 'agua') { heal = 0; diceLabel = ''; }
          else { heal = Math.floor(Math.random() * 4) + 1 + Math.floor(Math.random() * 4) + 1 + 2; diceLabel = '2d4+2'; }
        }
        const before = token.hp;
        token.hp = Math.min(token.maxHp, token.hp + heal);
        if (token.hp > 0) {
          token.dead = false;
          token.dying = false;
          token.stabilized = false;
        }
        io.to(room.id).emit('token:updated', token);
        io.to(room.id).emit('chat:message', { id: uid('msg'), from: 'Masmoura', text: `💚 ${token.name} usou ${def.name}${diceLabel ? ` (${diceLabel})` : ''} → +${heal} PV${token.hp === token.maxHp ? ' (cheio!)' : ''}.`, ts: Date.now() });
      } else if (kind === 'spell' && spellSlug) {
        const spell = SRD_SPELLS.find((s) => s.slug === spellSlug);
        if (!spell) return ack?.({ ok: false, error: 'Magia do item não encontrada.' });
        if (spell.mech) {
          const castMod = abilityMod(room.sheets.find((s) => s.tokenId === token.id)?.abilities[SPELLCASTING_ABILITY[room.sheets.find((s) => s.tokenId === token.id)?.classId ?? 'int'] ?? 'int'] ?? 0);
          if (spell.mech.kind === 'heal') {
            const parsed = /^(\d+)d(\d+)$/.exec(spell.mech.dice);
            const times = spell.mech.times ?? 1;
            const sides = parsed ? Number(parsed[2]) : 6;
            const diceValues = Array.from({ length: times }, () => Math.floor(Math.random() * sides) + 1);
            const amount = diceValues.reduce((a, b) => a + b, 0) + (spell.mech.scaleWithCaster ? castMod : 0) + (spell.mech.bonusMod ?? 0);
            const before = token.hp;
            token.hp = Math.min(token.maxHp, token.hp + amount);
            if (token.hp > 0) {
              token.dead = false;
              token.dying = false;
              token.stabilized = false;
            }
            io.to(room.id).emit('token:updated', token);
            io.to(room.id).emit('chat:message', { id: uid('msg'), from: 'Masmoura', text: `💚 ${token.name} usou ${spell.name} em si mesmo (+${amount} PV).`, ts: Date.now() });
          } else if (spell.mech.kind === 'auto') {
            const parsed = /^(\d+)d(\d+)$/.exec(spell.mech.dice);
            const times = spell.mech.times ?? 1;
            const sides = parsed ? Number(parsed[2]) : 6;
            const diceValues = Array.from({ length: times * (parsed ? Number(parsed[1]) : 1) }, () => Math.floor(Math.random() * sides) + 1);
            const amount = diceValues.reduce((a, b) => a + b, 0) + (spell.mech.scaleWithCaster ? castMod : 0) + (spell.mech.bonusMod ?? 0);
            const target = room.tokens.find((t) => t.id === token.id);
            if (target) {
              const before = target.hp;
              target.hp = Math.max(0, target.hp - amount);
              if (target.hp <= 0) {
                target.dead = true;
                target.dying = false;
                target.stabilized = false;
              }
              io.to(room.id).emit('token:updated', target);
              io.to(room.id).emit('chat:message', { id: uid('msg'), from: 'Masmoura', text: `💥 ${token.name} usou ${spell.name} (${amount} dano).`, ts: Date.now() });
            }
          }
        }
        if (def.charges !== undefined && slot.charges !== undefined && slot.charges > 0) {
          slot.charges -= 1;
        }
        if (def.charges !== undefined && (slot.charges ?? 1) <= 0) {
          slot.quantity -= 1;
        }
        if (slot.quantity <= 0) sheet.inventory = sheet.inventory.filter((i) => i.itemId !== req.itemId);
        io.to(room.id).emit('sheet:updated', { ...sheet });
        ack?.({ ok: true });
        return;
      } else if (kind === 'damage') {
        const dmg = (amount ?? 4);
        io.to(room.id).emit('chat:message', { id: uid('msg'), from: 'Masmoura', text: `💥 ${token.name} usou ${def.name} (${dmg} dano).`, ts: Date.now() });
      } else if (kind === 'buff') {
        io.to(room.id).emit('chat:message', { id: uid('msg'), from: 'Masmoura', text: `✨ ${token.name} usou ${def.name} (efeito).`, ts: Date.now() });
      }
      if (def.charges !== undefined && slot.charges !== undefined && slot.charges > 0) {
        slot.charges -= 1;
      }
      if (def.charges !== undefined && (slot.charges ?? 1) <= 0) {
        slot.quantity -= 1;
      }
      if (slot.quantity <= 0) {
        sheet.inventory = sheet.inventory.filter((i) => i.itemId !== req.itemId);
      }
    } else {
      // consumável sem efeito definido: só remove 1
      slot.quantity -= 1;
      if (slot.quantity <= 0) sheet.inventory = sheet.inventory.filter((i) => i.itemId !== req.itemId);
    }
    io.to(room.id).emit('sheet:updated', { ...sheet });
    io.to(room.id).emit('chat:message', { id: uid('msg'), from: 'Masmoura', text: `${token.name} usou ${def.name}.`, ts: Date.now() });
    ack?.({ ok: true });
  });

  socket.on('inventory:equip', (req: { itemId: string; equipped: boolean }, ack?: (res: { ok: boolean; error?: string }) => void) => {
    const room = roomOf();
    if (!room || !socket.data.playerId) return ack?.({ ok: false, error: 'Entre na sala primeiro.' });
    const sheet = room.sheets.find((s) => s.ownerId === socket.data.playerId);
    if (!sheet) return ack?.({ ok: false, error: 'Somente heróis com ficha podem equipar itens.' });
    const slot = sheet.inventory.find((i) => i.itemId === req.itemId);
    if (!slot) return ack?.({ ok: false, error: 'Item não está no inventário.' });
    const def = INVENTORY_ITEMS.find((i) => i.id === req.itemId);
    if (!def?.equipable) return ack?.({ ok: false, error: 'Item não é equipável.' });

    // desequipar item da mesma categoria anteriormente
    if (req.equipped) {
      const cat = def.category;
      sheet.inventory.forEach((i) => {
        const d = INVENTORY_ITEMS.find((j) => j.id === i.itemId);
        if (d?.category === cat && i.equipped) i.equipped = false;
      });
    }
    slot.equipped = req.equipped;

    // sincronizar derived.weaponId / derived.shieldId conforme equipamento
    if (def.category === 'weapon') {
      if (req.equipped) {
        // mapear ID do inventário → WEAPON_PRESETS
        const weaponMap: Record<string, string> = { 'machado': 'machado-grande', 'cajado': 'clava' };
        sheet.derived.weaponId = weaponMap[req.itemId] ?? req.itemId;
      } else if (sheet.derived.weaponId === (req.itemId)) {
        sheet.derived.weaponId = 'adaga'; // arma padrão
      }
    } else if (def.category === 'shield') {
      if (req.equipped) {
        sheet.derived.shieldId = req.itemId;
        // atualizar CA do token
        const token = room.tokens.find((t) => t.id === sheet.tokenId);
        if (token) {
          const sizeMod = RACE_BY_ID.get(sheet.raceId)?.size === 'small' ? 1 : 0;
          const armorPreset = ARMOR_BY_ID.get(sheet.derived.armorId);
          const shieldPreset = ITEM_BY_ID.get(sheet.derived.shieldId);
          token.ac = 10 + abilityMod(sheet.abilities.dex) + (armorPreset?.acBonus ?? 0) + (shieldPreset?.acBonus ?? 0) + sizeMod;
          io.to(room.id).emit('token:updated', token);
        }
      } else if (sheet.derived.shieldId === req.itemId) {
        sheet.derived.shieldId = '';
        // atualizar CA do token
        const token = room.tokens.find((t) => t.id === sheet.tokenId);
        if (token) {
          const sizeMod = RACE_BY_ID.get(sheet.raceId)?.size === 'small' ? 1 : 0;
          const armorPreset = ARMOR_BY_ID.get(sheet.derived.armorId);
          token.ac = 10 + abilityMod(sheet.abilities.dex) + (armorPreset?.acBonus ?? 0) + sizeMod;
          io.to(room.id).emit('token:updated', token);
        }
      }
    }

    io.to(room.id).emit('sheet:updated', { ...sheet });
    ack?.({ ok: true });
  });

  socket.on('dm:place-item', (req: { itemId: string; x: number; y: number; quantity?: number }, ack?: (res: { ok: boolean; error?: string }) => void) => {
    const room = roomOf();
    if (!room || !isDm()) return ack?.({ ok: false, error: 'Apenas o Mestre pode colocar itens.' });
    const def = INVENTORY_ITEMS.find((i) => i.id === req.itemId);
    if (!def) return ack?.({ ok: false, error: 'Item inválido no banco de dados.' });
    room.items.push({ id: uid('mit'), itemId: req.itemId, name: def.name, category: def.category, x: req.x, y: req.y, quantity: req.quantity ?? 1 });
    io.to(room.id).emit('items:changed', room.items);
    io.to(room.id).emit('chat:message', { id: uid('msg'), from: 'Masmoura', text: `📦 Mestre colocou ${def.name} no mapa.`, ts: Date.now() });
    ack?.({ ok: true });
  });

  socket.on('dm:remove-item', (req: { id?: string; itemId?: string; x?: number; y?: number }, ack?: (res: { ok: boolean; error?: string }) => void) => {
    const room = roomOf();
    if (!room || !isDm()) return ack?.({ ok: false, error: 'Apenas o Mestre pode remover itens.' });
    const before = room.items.length;
    if (req.id) {
      room.items = room.items.filter((it) => it.id !== req.id);
    } else if (req.itemId && req.x != null && req.y != null) {
      room.items = room.items.filter((it) => !(it.itemId === req.itemId && it.x === req.x && it.y === req.y));
    }
    if (room.items.length === before) return ack?.({ ok: false, error: 'Item não encontrado.' });
    io.to(room.id).emit('items:changed', room.items);
    io.to(room.id).emit('chat:message', { id: uid('msg'), from: 'Masmoura', text: `🗑️ Mestre removeu um item do mapa.`, ts: Date.now() });
    ack?.({ ok: true });
  });

  socket.on('sheet:editSpellSlots', ({ sheetId, delta }) => {
    const room = roomOf();
    if (!room || !isDm()) return;
    const sheet = room.sheets.find((s) => s.id === sheetId);
    if (!sheet) return;
    sheet.spellSlots.used = Math.max(0, Math.min(sheet.spellSlots.total, sheet.spellSlots.used + delta));
    io.to(room.id).emit('sheet:updated', { ...sheet });
  });

  socket.on('item:move', ({ id, x, y }) => {
    const room = roomOf();
    if (!room || !isDm()) return;
    const item = room.items.find((it) => it.id === id);
    if (!item) return;
    item.x = Math.max(0, x);
    item.y = Math.max(0, y);
    io.to(room.id).emit('item:moved', { id: item.id, x: item.x, y: item.y });
  });

  // ----------------------------------------------------------------- lobby

  socket.on('lobby:start', () => {
    const room = roomOf();
    if (!room || !isDm() || !room.lobbyOpen) return;
    room.lobbyOpen = false;
    io.to(room.id).emit('lobby:started');
    io.to(room.id).emit('chat:message', {
      id: uid('msg'),
      from: 'Masmoura',
      text: 'A expedição à Masmoura da Vigília começou. Boa sorte, heróis.',
      ts: Date.now(),
    });
  });

  // -------------------------------------------------------------------- chat

  socket.on('chat:send', (text) => {
    const room = roomOf();
    const clean = text.trim().slice(0, 300);
    if (!room || !clean || !socket.data.name) return;
    const msg = { id: uid('msg'), from: socket.data.name, text: clean, ts: Date.now() };
    room.chat.push(msg);
    io.to(room.id).emit('chat:message', msg);
  });

  // ------------------------------------------------------------------ fichas

  socket.on('sheet:create', (input: SheetCreateInputMsg, ack) => {
    const room = roomOf();
    if (!room || !socket.data.playerId) return ack?.({ ok: false, errors: [{ field: 'room', message: 'Entre na sala primeiro.' }] });
    if (socket.data.role !== 'player') return ack?.({ ok: false, errors: [{ field: 'role', message: 'A Mestra não cria heróis — invoque NPCs no mapa.' }] });
    if (room.sheets.some((s) => s.ownerId === socket.data.playerId)) {
      return ack?.({ ok: false, errors: [{ field: 'limit', message: 'Você já tem um herói nesta aventura.' }] });
    }
    if (room.seatInfo().players > MAX_PLAYERS) {
      return ack?.({ ok: false, errors: [{ field: 'seats', message: 'Sala cheia.' }] });
    }

    const payload = {
      name: String(input.name ?? ''),
      raceId: String(input.raceId ?? ''),
      classId: String(input.classId ?? ''),
      baseAbilities: input.baseAbilities,
      armorId: input.armorId,
      weaponId: input.weaponId,
      shieldId: input.shieldId,
      knownSpells: Array.isArray(input.knownSpells) ? input.knownSpells.filter((s): s is string => typeof s === 'string') : [],
      backstory: typeof input.backstory === 'string' ? input.backstory.slice(0, 200) : undefined,
      mdg: input.mdg,
    };
    const errors = validateCreateInput(payload as never);
    if (errors.length > 0) return ack?.({ ok: false, errors });

    // validar knownSpells contra a classe
    if (payload.knownSpells.length > 0) {
      const classSpellSlugs = new Set(
        SRD_SPELLS.filter((s) => s.classes.includes(payload.classId)).map((s) => s.slug)
      );
      for (const slug of payload.knownSpells) {
        if (!classSpellSlugs.has(slug)) {
          return ack?.({ ok: false, errors: [{ field: 'knownSpells', message: `Magia "${slug}" não pertence à classe.` }] });
        }
      }
    }

    const derived = computeDerivedSheet(payload as never);
    const importedHp = payload.mdg?.hpMax;
    const startHp = importedHp ? Math.max(1, Math.min(derived.maxHp, importedHp)) : derived.maxHp;
    // heróis nascem no centro da Sala 1 (Entrada)
    const spawn = findSpawnCell(room, 6, 13);
    const token: Token = {
      id: uid('pc'),
      name: payload.name.trim(),
      kind: 'pc',
      x: spawn.x,
      y: spawn.y,
      sizeCells: 1,
      color: '#6b7280',
      hp: startHp,
      maxHp: derived.maxHp,
      ac: derived.ac,
      speedCells: derived.speedCells,
      initiative: derived.initiative,
      visionRangeCells: RACE_BY_ID.get(payload.raceId)?.vision === 'normal' ? 5 : 6,
      hiddenFromPlayers: false,
      dead: false,
      ownerPlayerId: socket.data.playerId,
    };
    room.tokens.push(token);

    const sheet: import('@vtt/shared').CharacterSheet = {
      id: uid('sheet'),
      tokenId: token.id,
      ownerId: socket.data.playerId,
      name: token.name,
      raceId: payload.raceId,
      classId: payload.classId,
      level: 1,
      abilities: derived.abilities,
      spellSlots: { used: 0, total: derived.spellSlotsTotal },
      knownSpells: payload.knownSpells,
      potions: 2,
      inventory: [],
      backstory: payload.backstory,
      derived,
    };
    room.sheets.push(sheet);

    io.to(room.id).emit('token:added', token);
    io.to(room.id).emit('sheet:added', sheet);
    ack?.({ ok: true });
  });

  socket.on('disconnect', () => {
    const room = roomOf();
    if (!room) return;
    room.leave(socket.id);
    io.to(room.id).emit('seats:update', room.seatInfo());
  });
}

function labelForCheck(req: CheckRequest): string {
  switch (req.kind) {
    case 'd20': return req.label ?? (req.dc ? `Teste CD ${req.dc}` : 'Teste');
    case 'pool': return `Pilha ${req.poolSize}d10 ≥ ${req.difficulty}`;
    case 'percentile': return `Percentil (${req.skillValue}%)`;
    case 'fixed': return 'Graduado 2d6';
  }
}

/** Cura aplicada por um token (Mestre ajustando a ficha). */
function applyHeal(room: Room, io: any, tokenId: string, amount: number): void {
  const token = room.tokens.find((t) => t.id === tokenId);
  if (!token) return;
  const amt = Math.max(0, Math.floor(amount));
  const wasDead = token.dead;
  token.hp = Math.min(token.maxHp, token.hp + amt);
  if (token.hp > 0) {
    token.dead = false;
    token.dying = false;
    token.stabilized = false;
  }
  if (wasDead && !token.dead) {
    io.to(room.id).emit('chat:message', {
      id: uid('msg'),
      from: 'Masmoura',
      text: `${token.name} voltou à consciência (${token.hp} PV).`,
      ts: Date.now(),
    });
  }
  io.to(room.id).emit('token:updated', token);
}

function applyDamage(room: Room, io: any, tokenId: string, amount: number): void {
  const token = room.tokens.find((t) => t.id === tokenId);
  if (!token) return;
  const delta = Math.max(0, Math.floor(amount));
  const hpBefore = token.hp;
  token.hp -= delta;

  if (token.hp <= 0) {
    token.dead = true;
    token.dying = false;
    token.stabilized = false;
    if (hpBefore > 0) {
      io.to(room.id).emit('chat:message', {
        id: uid('msg'),
        from: 'Masmoura',
        text: `${token.name} caiu (${token.hp} PV).`,
        ts: Date.now(),
      });
    }
  }

  io.to(room.id).emit('token:updated', token);
}
