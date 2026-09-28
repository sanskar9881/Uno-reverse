import type { Card } from '@shared';
import type { RoomManagerOptions } from '../../src/rooms/RoomManager';
import { createUnoServer, type UnoServer } from '../../src/server';
import { TestClient } from './testClient';

export interface TestServer {
  server: UnoServer;
  url: string;
  /** Set before starting a round to deal a rigged deck. */
  nextDeck: Card[] | undefined;
  client(): Promise<TestClient>;
  close(): Promise<void>;
}

export async function startTestServer(options: RoomManagerOptions = {}): Promise<TestServer> {
  const holder: { deck: Card[] | undefined } = { deck: undefined };
  const server = createUnoServer({
    config: { clientOrigins: [], trustProxy: false },
    manager: {
      deckFactory: () => {
        const deck = holder.deck;
        holder.deck = undefined;
        return deck;
      },
      ...options,
    },
  });
  const port = await server.listen(0);
  const url = `http://127.0.0.1:${port}`;
  const clients: TestClient[] = [];
  return {
    server,
    url,
    get nextDeck() {
      return holder.deck;
    },
    set nextDeck(deck: Card[] | undefined) {
      holder.deck = deck;
    },
    async client() {
      const c = new TestClient(url);
      await c.connect();
      clients.push(c);
      return c;
    },
    async close() {
      for (const c of clients) c.disconnect();
      await server.close();
    },
  };
}

export const profile = (nickname: string, avatar = 0) => ({ nickname, avatar });
