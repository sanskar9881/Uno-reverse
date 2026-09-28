import { create } from 'zustand';

/** A burst of face-down cards flying from the draw pile to an opponent. */
export interface Flight {
  id: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  count: number;
}

interface FxStore {
  flights: Flight[];
  launch(flight: Omit<Flight, 'id'>): void;
  land(id: number): void;
}

let nextId = 1;

export const useFxStore = create<FxStore>((set, get) => ({
  flights: [],
  launch(flight) {
    set({ flights: [...get().flights, { ...flight, id: nextId++ }].slice(-12) });
  },
  land(id) {
    set({ flights: get().flights.filter((f) => f.id !== id) });
  },
}));
