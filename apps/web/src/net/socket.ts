import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, RollEntry, ServerToClientEvents } from '@vtt/shared';
import { useVttStore, type DiceShowItem, type DiceShowDie } from '../store';

/** No cliente: escuta ServerToClientEvents, emite ClientToServerEvents. */
export type VttSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: VttSocket | null = null;
let lastName: string | null = null;
let lastWant: 'dm' | 'player' = 'player';
let lastRoom: string | null = null;

export function getSocket(): VttSocket {
  if (!socket) {
    socket = io('/', { path: '/socket.io', transports: ['websocket', 'polling'] });
    registerListeners(socket);
  }
  return socket;
}

function registerListeners(s: VttSocket): void {
  const st = (): ReturnType<typeof useVttStore.getState> => useVttStore.getState();

  s.on('connect', () => {
    if (lastName && st().joined) {
      if (lastRoom) s.emit('room:join', lastRoom, lastName, lastWant, () => undefined);
      else s.emit('room:join', lastName, lastWant, () => undefined);
    }
  });

  s.on('disconnect', (reason) => {
    if (st().joined) st().showToast(`Desconectado (${reason}). Tentando reconectar...`);
  });

  s.on('room:snapshot', (snapshot) => {
    st().setSnapshot(snapshot);
  });

  s.on('seats:update', (seats) => st().patchSnapshot((snap) => ({ ...snap, seats })));

  s.on('token:added', (token) =>
    st().patchSnapshot((snap) => ({ ...snap, tokens: snap.tokens.some((t) => t.id === token.id) ? snap.tokens : [...snap.tokens, token] })),
  );

  s.on('token:moved', ({ id, x, y }) =>
    st().patchSnapshot((snap) => ({
      ...snap,
      tokens: snap.tokens.map((t) => (t.id === id ? { ...t, x, y } : t)),
    })),
  );

  s.on('token:removed', (id) =>
    st().patchSnapshot((snap) => ({
      ...snap,
      tokens: snap.tokens.filter((t) => t.id !== id),
      sheets: snap.sheets.filter((sh) => sh.tokenId !== id),
    })),
  );

  s.on('token:updated', (token) =>
    st().patchSnapshot((snap) => ({
      ...snap,
      tokens: snap.tokens.map((t) => (t.id === token.id ? token : t)),
    })),
  );

  s.on('wall:added', (data) =>
    st().patchSnapshot((snap) => ({ ...snap, map: { ...snap.map, walls: [...snap.map.walls, data] } })),
  );

  s.on('wall:removed', (data) =>
    st().patchSnapshot((snap) => {
      const eq = (w: { x1: number; y1: number; x2: number; y2: number }): boolean =>
        (w.x1 === data.x1 && w.y1 === data.y1 && w.x2 === data.x2 && w.y2 === data.y2) ||
        (w.x1 === data.x2 && w.y1 === data.y2 && w.x2 === data.x1 && w.y2 === data.y1);
      const walls = [...snap.map.walls];
      const idx = walls.findIndex(eq);
      if (idx !== -1) walls.splice(idx, 1);
      return { ...snap, map: { ...snap.map, walls } };
    }),
  );

  s.on('fog:painted', ({ cells, mode }) =>
    st().patchSnapshot((snap) => {
      const set = new Set(snap.map.fogHidden);
      for (const c of cells) {
        if (mode === 'hide') set.add(c);
        else set.delete(c);
      }
      return { ...snap, map: { ...snap.map, fogHidden: [...set] } };
    }),
  );

  // desenho colaborativo em tempo real
  s.on('map:drawing', (stroke) =>
    st().patchSnapshot((snap) => ({ ...snap, drawings: [...(snap.drawings ?? []).slice(-299), stroke] })),
  );
  s.on('map:drawCleared', () => st().patchSnapshot((snap) => ({ ...snap, drawings: [] })));
  s.on('map:drawingRemoved', ({ ids }) =>
    st().patchSnapshot((snap) => {
      const set = new Set(ids);
      return { ...snap, drawings: (snap.drawings ?? []).filter((d) => !set.has(d.id)) };
    }),
  );
  s.on('map:drawingMoved', ({ id, dx, dy }) =>
    st().patchSnapshot((snap) => ({
      ...snap,
      drawings: (snap.drawings ?? []).map((d) =>
        d.id === id
          ? { ...d, points: d.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
          : d,
      ),
    })),
  );


s.on('dice:rolled', (entry) => {
    if (entry.visibility === 'dm' && st().me?.role !== 'dm') return;
    st().patchSnapshot((snap) => ({ ...snap, rolls: [...snap.rolls.slice(-49), entry] }));
    try {
      st().pushDiceShow(rollDiceShow(entry));
    } catch {
      // animação nunca pode quebrar o fluxo
    }
    // Toast informativo (apenas rolagens visíveis)
    if (entry.visibility === 'all' || st().me?.role === 'dm') {
      st().showToast(`🎲 ${entry.roller}: ${entry.formula} = ${entry.total}`);
    }
  });

  s.on('sheet:updated', (sheet) =>
    st().patchSnapshot((snap) => ({
      ...snap,
      sheets: snap.sheets.map((s) => (s.id === sheet.id ? sheet : s)),
    })),
  );

  s.on('lobby:started', () => st().patchSnapshot((snap) => ({ ...snap, lobbyOpen: false })));

  s.on('items:changed', (items) =>
    st().patchSnapshot((snap) => ({ ...snap, items })),
  );

  s.on('item:moved', ({ id, x, y }) =>
    st().patchSnapshot((snap) => ({
      ...snap,
      items: snap.items.map((it) => (it.id === id ? { ...it, x, y } : it)),
    })),
  );

  s.on('chat:message', (message) =>
    st().patchSnapshot((snap) => ({ ...snap, chat: [...snap.chat.slice(-99), message] })),
  );

s.on('sheet:added', (sheet) => {
    const exists = st().snapshot?.sheets.some((sh) => sh.id === sheet.id);
    if (!exists) {
      st().patchSnapshot((snap) => ({ ...snap, sheets: [...snap.sheets, sheet] }));
    }
    if (sheet.ownerId === st().me?.id) {
      st().setSideTab('sheets');
    }
  });

  s.on('error', (message) => st().showToast(message, 'error'));
}

export interface JoinResult {
  ok: boolean;
  error?: string;
}

function whenConnected(s: VttSocket): Promise<void> {
  if (s.connected) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const ok = (): void => {
      cleanup();
      resolve();
    };
    const fail = (): void => {
      cleanup();
      reject(new Error('Falha ao conectar ao servidor'));
    };
    const cleanup = (): void => {
      s.off('connect', ok);
      s.off('connect_error', fail);
    };
    s.once('connect', ok);
    s.once('connect_error', fail);
  });
}

/** Cria uma sala nova no servidor e devolve o código (ou null em falha). */
export async function createRoom(): Promise<string | null> {
  const s = getSocket();
  try {
    await whenConnected(s);
  } catch {
    return null;
  }
  return new Promise((resolve) => {
    s.timeout(8000).emit('room:create', (err, res) => {
      if (err || !res?.ok) resolve(null);
      else resolve(res.roomId ?? null);
    });
  });
}

export function joinRoom(name: string, want: 'dm' | 'player', roomCode?: string): Promise<JoinResult> {
  const store = useVttStore.getState();
  store.setJoining(true);
  lastName = name.trim();
  lastWant = want;
  lastRoom = roomCode ? roomCode.trim().toUpperCase().slice(0, 16) : null;

  const s = getSocket();

  return whenConnected(s).then(
    () =>
      new Promise<void>((resolve) => {
        const done = (
          err: unknown,
          res?: { ok: boolean; role?: 'dm' | 'player'; playerId?: string; roomId?: string; error?: string },
        ): void => {
          if (err || !res || !res.ok) {
            useVttStore
              .getState()
              .setJoinError(
                res?.error ?? (err ? 'Tempo esgotado ao entrar na sala' : 'Não foi possível entrar.'),
              );
            resolve();
            return;
          }
          const me = { id: res.playerId ?? '', name: name.trim(), role: res.role ?? 'player' } as const;
          useVttStore.getState().setRoomId(res.roomId ?? lastRoom ?? 'sala-demo');
          useVttStore.getState().setJoined(me, useVttStore.getState().snapshot);
          resolve();
        };
        if (lastRoom) s.timeout(8000).emit('room:join', lastRoom, name.trim(), want, done);
        else s.timeout(8000).emit('room:join', name.trim(), want, done);
      }),
    () => {
      useVttStore.getState().setJoinError('Servidor inacessível. Ele está rodando?');
    },
  ).then(() => ({ ok: !useVttStore.getState().joinError, error: useVttStore.getState().joinError ?? undefined }));
}

// ------------------------------------------------------------------
// Construtores da animação central de rolagem
// ------------------------------------------------------------------

let dshowSeq = 0;
const dshowId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${(dshowSeq++).toString(36)}`;

function verdictOf(tone: 'good' | 'bad' | 'crit' | 'neutral', label: string): DiceShowItem['verdict'] {
  return { tone, label };
}

/** rolagem solta (DicePanel) — sistema d20/pilha/percentil/graduado */
function rollDiceShow(entry: RollEntry): DiceShowItem {
  const dice: DiceShowDie[] = [];
  for (const g of entry.detail.groups) {
    for (const v of g.values) {
      if (dice.length >= 6) break;
      dice.push({ sides: g.sides, value: v });
    }
  }
  let emoji = '🎲';
  let verdict: DiceShowItem['verdict'];
  const c = entry.check;
  if (c) {
    switch (c.system) {
      case 'd20':
        if (c.outcome === 'critical-success') {
          verdict = verdictOf('crit', 'CRÍTICO!'); emoji = '🔥';
        } else if (c.outcome === 'critical-failure') {
          verdict = verdictOf('bad', 'DESASTRE'); emoji = '💀';
        } else if (c.outcome === 'success') {
          verdict = verdictOf('good', `SUCESSO ${c.margin! >= 0 ? '+' : ''}${c.margin}`);
        } else if (c.outcome === 'failure') {
          verdict = verdictOf('bad', `FALHA ${c.margin!}`);
        } else {
          verdict = verdictOf('neutral', 'TOTAL');
        }
        break;
      case 'pool':
        if (c.dramatic) { verdict = verdictOf('crit', 'DRAMÁTICO!'); emoji = '🔥'; }
        else if (c.botch) { verdict = verdictOf('bad', 'FALHA TOTAL'); emoji = '💀'; }
        else verdict = verdictOf(c.successes >= 3 ? 'good' : c.successes >= 1 ? 'neutral' : 'bad', `${c.successes} SUCESSO${c.successes === 1 ? '' : 'S'}`);
        break;
      case 'percentile':
        if (c.grade === 'extreme') { verdict = verdictOf('crit', 'EXTREMO'); emoji = '🔥'; }
        else if (c.grade === 'fumble') { verdict = verdictOf('bad', 'DESASTRE'); emoji = '💀'; }
        else verdict = verdictOf(c.grade === 'failure' ? 'bad' : 'good', c.grade.toUpperCase());
        break;
      case 'fixed':
        verdict = c.outcome === 'full'
          ? verdictOf('good', 'SUCESSO TOTAL')
          : c.outcome === 'partial'
            ? verdictOf('neutral', 'PARCIAL')
            : verdictOf('bad', 'FALHA');
        break;
    }
  }
  return {
    id: dshowId('dshow'),
    title: entry.roller,
    sub: entry.formula,
    emoji,
    dice,
    total: entry.total,
    verdict,
  };
}


