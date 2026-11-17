import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from '@colyseus/sdk';
import { createGameServer } from '../src/gameServer.js';
import { CPU_ID } from '../src/ai/BotBrain.js';

const { httpServer, gameServer } = createGameServer();
let endpoint;

before(async () => {
  await gameServer.listen(0, '127.0.0.1');
  endpoint = `http://127.0.0.1:${httpServer.address().port}`;
});

after(async () => { await gameServer.gracefullyShutdown(false); });

async function waitFor(condition) {
  for (let i = 0; i < 100; i++) {
    if (condition()) return;
    await delay(25);
  }
  assert.ok(condition(), 'Timed out waiting for the synchronized room state');
}

test('serves a health check and accepts two clients in the same court', async (t) => {
  const health = await fetch(`${endpoint}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });

  const options = { court: 'classic', vsCpu: false };
  const first = await new Client(endpoint).joinOrCreate('match', { ...options, name: 'Demo A' });
  t.after(() => first.leave());
  const second = await new Client(endpoint).joinOrCreate('match', { ...options, name: 'Demo B' });
  t.after(() => second.leave());
  assert.equal(first.roomId, second.roomId);

  await waitFor(() => first.state?.phase === 'serving' && first.state.players.size === 2);
  assert.equal(first.state.players.get(first.sessionId).team, 0);
  assert.equal(first.state.players.get(second.sessionId).team, 1);
  first.send('serve');
  await waitFor(() => second.state?.phase === 'rally');
});

test('starts solo practice with the CPU in a separate room', async (t) => {
  const cpuRoom = await new Client(endpoint).create('match', { court: 'neon', vsCpu: true });
  t.after(() => cpuRoom.leave());
  const online = await new Client(endpoint).joinOrCreate('match', { court: 'neon', vsCpu: false });
  t.after(() => online.leave());
  assert.notEqual(cpuRoom.roomId, online.roomId);
  await waitFor(() => cpuRoom.state?.players?.has(CPU_ID) && online.state?.players?.size === 1);
  assert.equal(cpuRoom.state.phase, 'serving');
  assert.equal(online.state.phase, 'waiting');
});
