/**
 * Suíte de fumaça — Masmoura da Vigília (protocolo atual).
 * Uso: node scripts/smoke.mjs  (servidor precisa estar em :3001)
 */
import { io } from 'socket.io-client';

const URL = 'http://localhost:3001';

// estado limpo: descarta salas em memória de rodadas anteriores
await fetch(`${URL}/api/dev/reset`, { method: 'POST' }).catch(() => {});
let passed = 0;
let failed = 0;

function check(name, cond) {
  if (cond) {
    passed++;
    console.log(`PASS - ${name}`);
  } else {
    failed++;
    console.log(`FAIL - ${name}`);
  }
}

const waitFor = (sock, ev, timeoutMs = 4000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      sock.off(ev, h);
      reject(new Error(`timeout esperando ${ev}`));
    }, timeoutMs);
    const h = (...args) => {
      clearTimeout(t);
      resolve(args);
    };
    sock.on(ev, h);
  });

/** Espera o 1º evento que satisfizer o predicado (descarta os demais de transição). */
const waitForMatch = (sock, ev, pred, timeoutMs = 4000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      sock.off(ev, h);
      reject(new Error(`timeout esperando ${ev} que satisfaça o predicado`));
    }, timeoutMs);
    const h = (...args) => {
      if (!pred(...args)) return;
      clearTimeout(t);
      sock.off(ev, h);
      resolve(args);
    };
    sock.on(ev, h);
  });

function connect() {
  return new Promise((resolve) => {
    const s = io(URL, { transports: ['websocket'] });
    s.on('connect', () => resolve(s));
  });
}

// ------------------------------------------------------------------ início

const dm = await connect();
const p1 = await connect();
const p2 = await connect();
const p3 = await connect();
const p4 = await connect();

// listener ANTES do join: o servidor envia o snapshot no momento da entrada
const dmSnapP = waitFor(dm, 'room:snapshot');

// 1. DM entra primeiro
const joinAckDm = await new Promise((r) => dm.emit('room:join', 'Mestre Ana', 'dm', r));
check('DM entrou na sala', joinAckDm.ok === true && joinAckDm.role === 'dm');
check('ack traz playerId e vagas', typeof joinAckDm.playerId === 'string' && joinAckDm.seats?.maxPlayers === 4);
await dmSnapP;

// 2. quatro jogadores entram (promises de snapshot criadas antes dos joins)
const snapPromises = [p1, p2, p3, p4].map((s) => waitFor(s, 'room:snapshot'));
const acks = [];
for (const [s, name] of [[p1, 'Bruno'], [p2, 'Carla'], [p3, 'Diego'], [p4, 'Elisa']]) {
  acks.push(await new Promise((r) => s.emit('room:join', name, 'player', r)));
}
check('4 jogadores entraram como player', acks.every((a) => a.ok && a.role === 'player'));

// 3. quinto jogador é recusado
const p5 = await connect();
const ackFull = await new Promise((r) => p5.emit('room:join', 'Extra', 'player', r));
check('Sala cheia: 5º herói é recusado', ackFull.ok === false && /cheia/.test(ackFull.error ?? ''));

// o último a entrar recebe o snapshot mais atual (com assentos cheios)
const [snapshot] = await snapPromises[3];
check('Sala começa sem nenhum monstro no mapa', snapshot.tokens.length === 0);
check('Assentos refletidos no snapshot', snapshot.seats.players === 4 && snapshot.seats.maxPlayers === 4);
check('Snapshot traz o nome do Mestre', typeof snapshot.seats.dmName === 'string' && snapshot.seats.dmName.length > 0);
check('Snapshot não possui campo combat', snapshot.combat === undefined);

// a Mestra invoca os monstros usados pelo roteiro de testes (mapa começa vazio)
const seedDefs = [
  { name: 'Goblin Batedor', kind: 'monster', x: 21 * 64, y: 13 * 64, hp: 20, maxHp: 20, ac: 15, color: '#e74c3c' },
  { name: 'Orc Guerreiro', kind: 'monster', x: 22 * 64, y: 23 * 64, hp: 15, maxHp: 15, ac: 13, color: '#9b59b6' },
  { name: 'Lobo Faminto', kind: 'monster', x: 17 * 64, y: 12 * 64, hp: 11, maxHp: 11, ac: 13, color: '#a3a375' },
  { name: 'Espectro da Vigília', kind: 'monster', x: 34 * 64, y: 20 * 64, hp: 22, maxHp: 22, ac: 12, color: '#7dd3fc' },
];
for (const def of seedDefs) {
  const addedP = waitFor(p1, 'token:added');
  dm.emit('token:add', def);
  const [tok] = await addedP;
  snapshot.tokens.push(tok);
}
check('Mestra invocou os monstros do encontro', snapshot.tokens.length === 4);

// lobby: aberto na entrada; só o Mestre inicia a expedição
check('Lobby aberto ao entrar', snapshot.lobbyOpen === true);
const lobbyP = waitFor(p3, 'lobby:started');
dm.emit('lobby:start');
await lobbyP;
check('Mestre inicia a expedição (lobby fecha)', true);

// 4. movimento + permissões
const goblin = snapshot.tokens.find((t) => t.name.includes('Goblin'));
dm.emit('token:move', { id: goblin.id, x: goblin.x + 64, y: goblin.y });
const moved = await waitFor(p1, 'token:moved');
check('token:moved propagado para outro cliente', moved[0].id === goblin.id);

// jogador não pode mover monstro: nenhum evento chega ao DM em 400 ms
let playerMovedMonster = false;
const permHandler = (e) => {
  if (e.id === goblin.id && e.x === 0) playerMovedMonster = true;
};
dm.on('token:moved', permHandler);
p1.emit('token:move', { id: goblin.id, x: 0, y: 0 });
await new Promise((r) => setTimeout(r, 400));
dm.off('token:moved', permHandler);
check('Permissão: player não move monstro', !playerMovedMonster);

// 5. criação de herói (humano guerreiro, CON base 12 → final 13 → mod +1 → PV 11)
const heroTokAddedP = waitFor(p1, 'token:added');
const createdP = waitFor(p1, 'sheet:added');
p1.emit(
  'sheet:create',
  { name: 'Thorin', raceId: 'humano', classId: 'guerreiro', baseAbilities: { str: 15, dex: 12, con: 12, int: 10, wis: 10, cha: 10 } },
  () => undefined,
);
const [sheet] = await createdP;
const [heroToken] = await heroTokAddedP;
snapshot.tokens.push(heroToken);
check('Ficha criada com dono correto', sheet.ownerId === acks[0].playerId);
check('PV derivado: d10 + CON(+1 humano) = 11', sheet.derived.maxHp === 11);
check('Proficiência nível 1 = +2', sheet.derived.prof === 2);
check('CA: 10 + DES(+1 humano) + cota de malha(5) = 16', sheet.derived.ac === 16);

// névoa: Mestre pinta e o evento propaga (mapa em branco não tem névoa a revelar)
const fogP = waitFor(dm, 'fog:painted');
dm.emit('fog:paint', { cells: ['5,5', '5,6'], mode: 'hide' });
const [fog] = await fogP;
check('Mestre pinta névoa e evento propaga', fog.mode === 'hide' && fog.cells.length === 2);
const fogP2 = waitFor(dm, 'fog:painted');
dm.emit('fog:paint', { cells: ['5,5', '5,6'], mode: 'reveal' });
const [fog2] = await fogP2;
check('Mestre revela névoa pintada', fog2.mode === 'reveal' && fog2.cells.length === 2);

// paredes: adicionar e depois remover
const wallAddP = waitFor(dm, 'wall:added');
const wallSeg = { x1: 3 * 64, y1: 4 * 64, x2: 6 * 64, y2: 4 * 64 };
dm.emit('wall:add', wallSeg);
const [wallAdded] = await wallAddP;
check('Mestre adiciona parede e evento propaga', wallAdded.x1 === wallSeg.x1 && wallAdded.x2 === wallSeg.x2);
const wallRemP = waitFor(dm, 'wall:removed');
dm.emit('wall:remove', wallSeg);
const [wallRemoved] = await wallRemP;
check(
  'Mestre remove parede (mesmo segmento devolvido)',
  (wallRemoved.x1 === wallSeg.x1 && wallRemoved.y1 === wallSeg.y1 && wallRemoved.x2 === wallSeg.x2 && wallRemoved.y2 === wallSeg.y2),
);

// segundo herói do mesmo jogador é rejeitado
let dupRejected = false;
p1.emit('sheet:create', { name: 'Clone', raceId: 'elfo', classId: 'mago', baseAbilities: { str: 8, dex: 14, con: 10, int: 15, wis: 12, cha: 10 } }, (res) => {
  dupRejected = res.ok === false;
});
await new Promise((r) => setTimeout(r, 300));
check('Um herói por jogador (duplicado rejeitado)', dupRejected);

// point-buy estourado é rejeitado
let pbRejected = false;
p2.emit('sheet:create', { name: 'Cheaty', raceId: 'anao', classId: 'barbaro', baseAbilities: { str: 15, dex: 15, con: 15, int: 15, wis: 15, cha: 15 } }, (res) => {
  pbRejected = res.ok === false;
});
await new Promise((r) => setTimeout(r, 300));
check('Point-buy > 27 é rejeitado', pbRejected);

// 6. dados
const rollP = waitFor(p2, 'dice:rolled');
dm.emit('dice:roll', { formula: '1d20+5', visibility: 'all' });
const [entry] = await rollP;
check('dice:rolled com total válido (6..25)', entry.total >= 6 && entry.total <= 25);

// rolagem privada não vaza
let leaked = false;
p2.on('dice:rolled', (e) => {
  if (e.visibility === 'dm') {
    leaked = true;
    console.log(`  [debug] p2 recebeu privada: ${JSON.stringify(e)}`);
  }
});
dm.emit('dice:roll', { formula: '2d6+3', visibility: 'dm' });
await new Promise((r) => setTimeout(r, 350));
check('Rolagem privada (dm) não vaza para o jogador', !leaked);

// teste d20 vs CD
const chkP = waitFor(p2, 'dice:rolled');
p2.emit('dice:check', { kind: 'd20', modifier: 3, mode: 'normal', dc: 12, visibility: 'all' });
const [checkEntry] = await chkP;
check(
  'teste d20 classificado vs CD',
  checkEntry.check?.system === 'd20' &&
    ((checkEntry.check.die === 20 && checkEntry.check.outcome === 'critical-success') ||
      (checkEntry.check.die === 1 && checkEntry.check.outcome === 'critical-failure') ||
      (checkEntry.check.margin >= 0 ? checkEntry.check.outcome === 'success' : checkEntry.check.outcome === 'failure')),
);

// pilha inválida
let poolErr = false;
p2.on('error', () => {
  poolErr = true;
});
p2.emit('dice:check', { kind: 'pool', poolSize: 0, difficulty: 6, visibility: 'all' });
await new Promise((r) => setTimeout(r, 300));
check('Pilha inválida rejeitada com erro', poolErr);

// pilha válida
const poolP = waitFor(p3, 'dice:rolled');
p3.emit('dice:check', { kind: 'pool', poolSize: 5, difficulty: 6, visibility: 'all' });
const [poolEntry] = await poolP;
check('pilha: sucessos ≤ dados', poolEntry.check.successes <= 5);

// 7. token:toggleDead — DM marca e desmarca monstro como morto
const goblinTok = snapshot.tokens.find((t) => t.name === 'Goblin Batedor');
const toggleDeadP1 = waitFor(p1, 'token:updated');
dm.emit('token:toggleDead', { id: goblinTok.id });
const [toggled1] = await toggleDeadP1;
check('token:toggleDead: monstro marcado como morto', toggled1.dead === true && toggled1.id === goblinTok.id);

const toggleDeadP2 = waitFor(p1, 'token:updated');
dm.emit('token:toggleDead', { id: goblinTok.id });
const [toggled2] = await toggleDeadP2;
check('token:toggleDead: monstro desmarcado como morto', toggled2.dead === false && toggled2.id === goblinTok.id);

// 8. token:setKind — DM altera o tipo do token
const orcTok = snapshot.tokens.find((t) => t.name === 'Orc Guerreiro');
const setKindP = waitFor(p1, 'token:updated');
dm.emit('token:setKind', { id: orcTok.id, kind: 'npc' });
const [kindUpdated] = await setKindP;
check('token:setKind: tipo alterado para npc', kindUpdated.kind === 'npc' && kindUpdated.id === orcTok.id);

// 9. token:damage — DM aplica dano e token:updated é emitido
const loboTok = snapshot.tokens.find((t) => t.name === 'Lobo Faminto');
const dmgP = waitFor(p1, 'token:updated');
dm.emit('token:damage', { id: loboTok.id, amount: 5 });
const [dmgResult] = await dmgP;
check('token:damage: dano aplicado emite token:updated', dmgResult.id === loboTok.id && dmgResult.hp < loboTok.hp);

// 10. chat (matcher)
const chatP = waitForMatch(p2, 'chat:message', (m) => m.text === 'Olá, masmoura!');
p1.emit('chat:send', 'Olá, masmoura!');
const [msg] = await chatP;
check('chat:message entregue', msg.from === 'Bruno');

// 11. importação de ficha do Gerador MdG (atributos finais, sem raça; PV da ficha respeitado)
p4.disconnect();
await new Promise((r) => setTimeout(r, 300));

const mdgJson = JSON.stringify({
  app: 'Gerador MdG',
  type: 'gerador-mdg-character',
  version: 2,
  character: {
    name: 'Bruma da Ponte',
    class: { id: 'guerreiro', name: 'Guerreiro' },
    abilities: [
      { id: 'strength', abbreviation: 'for', value: 16 },
      { id: 'dexterity', abbreviation: 'des', value: 13 },
      { id: 'constitution', abbreviation: 'con', value: 15 },
      { id: 'intelligence', abbreviation: 'int', value: 9 },
      { id: 'wisdom', abbreviation: 'sab', value: 12 },
      { id: 'charisma', abbreviation: 'car', value: 8 },
    ],
    resources: { hitPoints: { current: 7, max: 8 } },
  },
});
const pImp = await connect();
await new Promise((r) => pImp.emit('room:join', 'Importada', 'player', r));
const impP = waitFor(pImp, 'sheet:added');
const impTokP = waitFor(dm, 'token:added');
pImp.emit(
  'sheet:create',
  {
    name: JSON.parse(mdgJson).character.name,
    raceId: 'humano',
    classId: 'guerreiro',
    baseAbilities: { str: 16, dex: 13, con: 15, int: 9, wis: 12, cha: 8 },
    mdg: { hpMax: 8 },
  },
  () => undefined,
);
const [impSheet] = await impP;
check('MdG: importação aceita acima do point-buy', impSheet.abilities.str === 16);
check('MdG: sem bônus racial aplicado', impSheet.abilities.wis === 12 && impSheet.abilities.cha === 8);
const [impToken] = await impTokP;
// guerreiro d10 + CON 15(+2) = 12 máx; ficha MdG trouxe max 8 → nasce com 8
check('MdG: PV inicial = valor da ficha (8) abaixo do máximo (12)', impToken.hp === 8 && impToken.maxHp === 12);

// ------------------------------------------------------ desenho colaborativo
const drawP1 = waitFor(dm, 'map:drawing');
const drawP2 = waitFor(p2, 'map:drawing');
const stroke = { id: 'smoke-stroke-1', points: [{ x: 100, y: 120 }, { x: 180, y: 220 }, { x: 300, y: 260 }], color: 0xef4444, size: 3 };
p1.emit('map:draw', stroke, (res) => check('Desenho: jogador recebe ack ok', res?.ok === true));
const [gotByDm] = await drawP1;
check('Desenho: Mestre vê o traço do jogador em tempo real', gotByDm.id === stroke.id && gotByDm.points.length === 3);
const [gotByP2] = await drawP2;
check('Desenho: outro jogador também vê o traço', gotByP2.id === stroke.id && gotByP2.author === 'Bruno');

// limpeza propaga para todos
const clearP = waitFor(p3, 'map:drawCleared');
dm.emit('map:drawClear');
const [cleared] = await clearP;
check('Desenho: limpar apaga para todos (evento recebido)', cleared === undefined || cleared === null);

// novo traço + snapshot traz os desenhos para quem acabou de entrar
p3.disconnect();
await new Promise((r) => setTimeout(r, 150));
const stroke2 = { id: 'smoke-stroke-2', points: [{ x: 10, y: 10 }], color: 0x3b82f6, size: 3 };
const snapDrawnP = waitFor(p1, 'map:drawing');
p1.emit('map:draw', stroke2);
await snapDrawnP;
const late = await connect();
const lateSnapP = waitFor(late, 'room:snapshot');
await new Promise((r) => late.emit('room:join', 'Chegou Tarde', 'player', r));
const [lateSnap] = await lateSnapP;
check(
  'Desenho: snapshot inicial contém os traços existentes',
  Array.isArray(lateSnap.drawings) && !lateSnap.drawings.some((d) => d.id === stroke.id) && lateSnap.drawings.some((d) => d.id === stroke2.id),
);

// borracha: apaga um traço específico para todos
const eraseP = waitFor(p1, 'map:drawingRemoved');
late.emit('map:drawErase', { ids: [stroke2.id] }, (res) => check('Borracha: ack ok', res?.ok === true));
const [removed] = await eraseP;
check('Borracha: ids removidos propagados', Array.isArray(removed.ids) && removed.ids.includes(stroke2.id));
const snapAfterEraseP = waitFor(late, 'room:snapshot');
late.disconnect();
await new Promise((r) => setTimeout(r, 150));
const late2 = await connect();
void snapAfterEraseP;
const late2SnapP = waitFor(late2, 'room:snapshot');
await new Promise((r) => late2.emit('room:join', 'Chegou Tarde 2', 'player', r));
const [late2Snap] = await late2SnapP;
check('Borracha: snapshot não traz mais o traço apagado', Array.isArray(late2Snap.drawings) && !late2Snap.drawings.some((d) => d.id === stroke2.id));

// ------------------------------------------------------- salas múltiplas
const dm2 = await connect();
const createAck = await new Promise((r) => dm2.emit('room:create', r));
check(
  'Salas: room:create devolve código',
  createAck?.ok === true && typeof createAck.roomId === 'string' && /^[A-Z0-9]{5}$/.test(createAck.roomId),
);
const code2 = createAck.roomId;

const pNew = await connect();
const snapNewP = waitFor(pNew, 'room:snapshot');
const joinNew = await new Promise((r) => pNew.emit('room:join', code2, 'Heroi Sala B', 'player', r));
check('Salas: jogador entra por código', joinNew?.ok === true && joinNew.role === 'player');
const [snapNew] = await snapNewP;
check(
  'Salas: sala nova isolada e vazia (nenhum token)',
  Array.isArray(snapNew.tokens) && snapNew.tokens.length === 0,
);
const dm2SnapNow = (await new Promise((r) => dm2.emit('room:join', code2, 'Mestre Ana', 'dm', r)));
check('Salas: DM reentra na própria sala', dm2SnapNow?.ok === true);

const badJoin = await new Promise((r) => {
  const sBad = io(URL, { transports: ['websocket'] });
  sBad.on('connect', () => sBad.emit('room:join', 'ZZZZZ', 'Curioso', 'player', (res) => { r(res); sBad.disconnect(); }));
});
check('Salas: código inexistente é recusado', badJoin?.ok === false && /não encontrada/i.test(badJoin.error ?? ''));

// ============================================================ inventário
// DM coloca item no mapa
const placeP = waitFor(dm, 'items:changed');
dm.emit('dm:place-item', { itemId: 'pocao-cura', x: 2, y: 3, quantity: 2 }, (res) => {
  check('DM coloca poção no mapa', res?.ok === true);
});
await placeP;

// Jogador coleta item
const collectP = waitFor(p1, 'sheet:updated');
p1.emit('inventory:collect', { itemId: 'pocao-cura', x: 2, y: 3 }, (res) => {
  check('Jogador coleta poção', res?.ok === true);
});
await collectP;

// Jogador usa item
p1.emit('inventory:use', { itemId: 'pocao-cura' }, (res) => {
  check('Jogador usa poção', res?.ok === true);
});

// Jogador dropa item
p1.emit('inventory:drop', { itemId: 'pocao-cura' }, (res) => {
  check('Jogador dropa item', res?.ok === true);
});

// DM remove item
const removeP = waitFor(dm, 'items:changed');
dm.emit('dm:remove-item', { itemId: 'pocao-cura', x: 2, y: 3 }, (res) => {
  check('DM remove item do mapa', res?.ok === true);
});
await removeP;

dm2.disconnect();
pNew.disconnect();

// saída limpa
for (const s of [...new Set([dm, p1, p2, p3, p4, p5, pImp, late, late2])].filter(Boolean)) s.disconnect();

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed === 0 ? 0 : 1);
