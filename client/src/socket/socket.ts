import { io, type Socket } from 'socket.io-client';
import type { AckResponse, ClientToServerEvents, ErrorCode, ServerToClientEvents } from '@shared';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function resolveServerUrl(): string {
  const fromEnv = import.meta.env.VITE_SERVER_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  // Local dev default: same host as the page, port 3001 (also works from a phone on your Wi-Fi).
  return `${window.location.protocol}//${window.location.hostname}:3001`;
}

export const SERVER_URL = resolveServerUrl();

export const socket: GameSocket = io(SERVER_URL, {
  autoConnect: false,
  reconnectionDelay: 400,
  reconnectionDelayMax: 3000,
  timeout: 20_000,
});

export type ClientErrorCode = ErrorCode | 'NETWORK';

type EventName = keyof ClientToServerEvents;
type PayloadOf<E extends EventName> = Parameters<ClientToServerEvents[E]>[0];
type ResultOf<E extends EventName> =
  Parameters<ClientToServerEvents[E]>[1] extends (response: AckResponse<infer T>) => void ? T : object;

export type RequestResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: { code: ClientErrorCode; message: string } };

/** Emits an event and resolves with the server's acknowledgement (or a NETWORK error on timeout). */
export function request<E extends EventName>(
  event: E,
  payload: PayloadOf<E>,
  timeoutMs = 8000,
): Promise<RequestResult<ResultOf<E>>> {
  return new Promise((resolve) => {
    const emitter = socket.timeout(timeoutMs) as unknown as {
      emit(ev: string, p: unknown, cb: (err: Error | null, res: RequestResult<ResultOf<E>>) => void): void;
    };
    emitter.emit(event, payload, (err, res) => {
      if (err) {
        resolve({ ok: false, error: { code: 'NETWORK', message: "Couldn't reach the game server. Check your connection." } });
      } else {
        resolve(res);
      }
    });
  });
}

/** Waits for a live connection (free hosting can take a while to wake up). */
export function ensureConnected(timeoutMs = 60_000): Promise<boolean> {
  if (socket.connected) return Promise.resolve(true);
  if (!socket.active) socket.connect();
  return new Promise((resolve) => {
    const done = (value: boolean) => {
      clearTimeout(timer);
      socket.off('connect', onConnect);
      resolve(value);
    };
    const onConnect = () => done(true);
    const timer = setTimeout(() => done(false), timeoutMs);
    socket.on('connect', onConnect);
  });
}
