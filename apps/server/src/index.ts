import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from 'socket.io';
import {
  SRD_CONDITIONS,
  SRD_MONSTERS,
  SRD_SPELLS,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type SocketData,
} from '@vtt/shared';
import { RoomManager } from './rooms';
import { registerHandlers } from './socket';

const PORT = Number(process.env.PORT ?? 3001);

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get('/api/health', async () => ({ ok: true, ts: Date.now() }));
app.post('/api/dev/reset', async () => {
  rooms.resetAll();
  rooms.getOrCreate('sala-demo');
  return { ok: true };
});
app.get('/api/srd/monsters', async () => SRD_MONSTERS);
app.get('/api/srd/spells', async () => SRD_SPELLS);
app.get('/api/srd/conditions', async () => SRD_CONDITIONS);

const io = new Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>(app.server, {
  cors: { origin: true },
});

const rooms = new RoomManager();
rooms.getOrCreate('sala-demo');
registerHandlers(io, rooms);

await app.listen({ port: PORT, host: '0.0.0.0' });
console.log(`[VTT] API + WebSocket em http://localhost:${PORT}`);
