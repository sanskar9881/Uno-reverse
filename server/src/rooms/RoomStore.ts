import type { Room } from './types';

/**
 * Storage for active rooms. The in-memory implementation is all an MVP needs;
 * a Redis implementation would serialize `Room` (already plain JSON) in `save`
 * and add a per-room lock so several server instances can share state.
 */
export interface RoomStore {
  get(code: string): Room | undefined;
  has(code: string): boolean;
  save(room: Room): void;
  delete(code: string): void;
  all(): Room[];
  readonly size: number;
}

export class InMemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, Room>();

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  has(code: string): boolean {
    return this.rooms.has(code);
  }

  save(room: Room): void {
    this.rooms.set(room.code, room);
  }

  delete(code: string): void {
    this.rooms.delete(code);
  }

  all(): Room[] {
    return [...this.rooms.values()];
  }

  get size(): number {
    return this.rooms.size;
  }
}
