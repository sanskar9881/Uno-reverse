import { io, type Socket } from 'socket.io-client';
import type { AckResponse, ClientState, ClientToServerEvents, ServerToClientEvents, SessionEndReason } from '@shared';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface Waiter {
  predicate: (state: ClientState) => boolean;
  resolve: (state: ClientState) => void;
}

/** A scripted player: records every snapshot it receives and can await specific states. */
export class TestClient {
  readonly socket: ClientSocket;
  readonly states: ClientState[] = [];
  readonly endedSessions: { reason: SessionEndReason; message: string }[] = [];
  private waiters: Waiter[] = [];

  constructor(url: string) {
    this.socket = io(url, { transports: ['websocket'], forceNew: true, reconnection: false, autoConnect: false });
    this.socket.on('state', (state) => {
      this.states.push(state);
      this.waiters = this.waiters.filter((w) => {
        if (!w.predicate(state)) return true;
        w.resolve(state);
        return false;
      });
    });
    this.socket.on('session:ended', (payload) => this.endedSessions.push(payload));
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.once('connect', () => resolve());
      this.socket.once('connect_error', reject);
      this.socket.connect();
    });
  }

  get state(): ClientState {
    const latest = this.states.at(-1);
    if (!latest) throw new Error('No state received yet');
    return latest;
  }

  get id(): string {
    return this.state.selfId;
  }

  /** Emits an event and resolves with the server's ack. */
  async send<T extends object = object>(event: string, payload: unknown = {}): Promise<AckResponse<T>> {
    const socket = this.socket as unknown as {
      timeout(ms: number): { emitWithAck(ev: string, p: unknown): Promise<AckResponse<T>> };
    };
    return socket.timeout(4000).emitWithAck(event, payload);
  }

  /** Emits and throws if the server rejected it. */
  async ok<T extends object = object>(event: string, payload: unknown = {}): Promise<T> {
    const res = await this.send<T>(event, payload);
    if (!res.ok) throw new Error(`${event} failed: ${res.error.code} ${res.error.message}`);
    return res as unknown as T;
  }

  waitFor(predicate: (state: ClientState) => boolean, timeoutMs = 4000): Promise<ClientState> {
    const latest = this.states.at(-1);
    if (latest && predicate(latest)) return Promise.resolve(latest);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        reject(new Error(`Timed out waiting for state (last status: ${latest?.room.status ?? 'none'})`));
      }, timeoutMs);
      const waiter: Waiter = {
        predicate,
        resolve: (s) => {
          clearTimeout(timer);
          resolve(s);
        },
      };
      this.waiters.push(waiter);
    });
  }

  /** Waits for a snapshot whose event batch contains the given event type. */
  waitForEvent(type: string, timeoutMs = 4000): Promise<ClientState> {
    const start = this.states.length;
    return new Promise((resolve, reject) => {
      const found = this.states.slice(start).find((s) => s.events.some((e) => e.type === type));
      if (found) return resolve(found);
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        reject(new Error(`Timed out waiting for event ${type}`));
      }, timeoutMs);
      const waiter: Waiter = {
        predicate: (s) => s.events.some((e) => e.type === type),
        resolve: (s) => {
          clearTimeout(timer);
          resolve(s);
        },
      };
      this.waiters.push(waiter);
    });
  }

  disconnect(): void {
    this.socket.disconnect();
  }
}
