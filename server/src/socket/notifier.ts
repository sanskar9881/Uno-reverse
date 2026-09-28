import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared';
import type { RoomNotifier } from '../rooms/RoomManager';
import { buildClientState } from '../rooms/views';

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

/**
 * Pushes state to players by socket id (every socket is automatically in a
 * room named after its id). Each player gets their own snapshot, which is how
 * hidden hands stay hidden: nobody is ever sent a payload containing another
 * player's cards.
 */
export function createSocketNotifier(io: TypedServer, now: () => number = Date.now): RoomNotifier {
  return {
    roomUpdated(room, events) {
      const time = now();
      for (const player of room.players) {
        if (!player.connected || !player.socketId) continue;
        io.to(player.socketId).emit('state', buildClientState(room, player.id, events, time));
      }
    },
    sessionEnded(socketId, reason, message) {
      io.to(socketId).emit('session:ended', { reason, message });
    },
  };
}
