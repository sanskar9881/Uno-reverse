/**
 * Game server for browser end-to-end tests: the real server plus a tiny
 * control API (on CONTROL_PORT) that can rig the next deck, so scripted
 * scenarios like "win the round" are deterministic. Never deploy this.
 */
import { createServer } from 'node:http';
import type { Card } from '@shared';
import { createUnoServer } from '../../src/server';
import { card, cards, fillerCards, riggedDeck } from '../helpers/cards';

const port = Number(process.env.PORT ?? 3001);
const controlPort = Number(process.env.CONTROL_PORT ?? 3099);
const ms = (name: string, fallback: number) => Number(process.env[name] ?? fallback);

let nextDeck: Card[] | undefined;

const server = createUnoServer({
  config: { port, clientOrigins: (process.env.CLIENT_ORIGIN ?? '').split(',').filter(Boolean), trustProxy: false },
  manager: {
    deckFactory: () => {
      const deck = nextDeck;
      nextDeck = undefined;
      return deck;
    },
    lobbyGraceMs: ms('LOBBY_GRACE_MS', 15_000),
    gameGraceMs: ms('GAME_GRACE_MS', 60_000),
    hostTransferMs: ms('HOST_TRANSFER_MS', 10_000),
    disconnectedTurnMs: ms('DISCONNECTED_TURN_MS', 10_000),
    // DETERMINISTIC=1: the host always starts round 1, so rigged scripts know whose turn it is.
    rng: process.env.DETERMINISTIC === '1' ? () => 0 : undefined,
  },
});

await server.listen(port);

createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    try {
      if (req.method === 'POST' && req.url === '/deck') {
        // { hands: ["r1 b2 …", …], start: "r5", draws: "y9", filler: "y9" }
        const spec = JSON.parse(body) as { hands: string[]; start?: string; draws?: string; filler?: string };
        nextDeck = riggedDeck(spec.hands.map(cards), card(spec.start ?? 'r5'), cards(spec.draws ?? ''), fillerCards(40, spec.filler ?? 'y9'));
        res.writeHead(200).end('ok');
      } else if (req.method === 'GET' && req.url === '/metrics') {
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(server.manager.metrics()));
      } else {
        res.writeHead(404).end();
      }
    } catch (error) {
      res.writeHead(400).end(String(error));
    }
  });
}).listen(controlPort, '127.0.0.1');

console.log(`e2e server on :${port}, control on :${controlPort}`);
