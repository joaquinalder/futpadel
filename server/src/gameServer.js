import { createServer } from 'node:http';
import express from 'express';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';

import { MatchRoom } from './rooms/MatchRoom.js';

export function createGameServer() {
  const app = express();
  app.disable('x-powered-by');
  app.get('/', (_req, res) => res.send('Futpadel game server'));
  app.get('/health', (_req, res) => res.json({ ok: true }));

  const httpServer = createServer(app);
  const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }), greet: false });
  gameServer.define('match', MatchRoom).filterBy(['vsCpu', 'court']);
  return { httpServer, gameServer };
}
