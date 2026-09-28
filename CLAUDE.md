# CLAUDE.md

Guidance for Claude Code (and humans) working in this repo.

## What this is

UNO Party: a real-time multiplayer UNO-style game. There are three packages. `shared/` holds pure TypeScript imported as `@shared`, `server/` is Express plus Socket.IO and authoritative, and `client/` is React, Vite and Tailwind 4. See README.md for features and deployment.

## Commands

- `npm run install:all`: install everything (root, server, client).
- `npm run dev`: server on :3001 (tsx watch) and client on :5173.
- `npm test`: server Vitest suite (engine and multiplayer over real sockets). Must stay green.
- `npm run typecheck`: strict TypeScript for server and client.
- `npm run build`: server bundle (tsup) and client (vite).
- `npm run e2e`: builds the client, starts `e2e/services.sh` (rigged server :3001, control :3099, preview :4173), runs `e2e/run_e2e.py` and writes screenshots to `e2e-screenshots/`. Needs Python Playwright.

## Invariants (don't break these)

- **The server is authoritative.** Rules live only in `server/src/game/engine.ts`, which is pure, synchronous and does no I/O. `shared/rules.ts` is for UI hints and must match the engine.
- **Hands are private.** Only `server/src/game/views.ts` and `server/src/rooms/views.ts` build what a player sees, and a player's snapshot contains only their own hand. Seat tokens are never broadcast. Tests check both.
- **Every turn action carries a `turnId`,** and stale actions are rejected. Keep it that way for any new action.
- **Room state is plain JSON** (`server/src/rooms/types.ts`) behind the `RoomStore` interface, so a Redis store can replace it. Don't put class instances or timers in it; timers live in RoomManager maps.
- **Adding a client→server event** takes five steps:
  1. Add the type to `shared/events.ts`.
  2. Add a zod schema to `server/src/socket/schemas.ts`.
  3. Add a handler and rate-limit bucket in `server/src/socket/registerHandlers.ts`.
  4. Add a RoomManager method.
  5. Add a test in `server/tests/multiplayer.test.ts`.
- **Adding a game event:** add it to the `GameEvent` union in `shared/types.ts`, then handle it in `client/src/game/feedback.ts` with a sound, toast or animation.

## Gotchas

- `shared/package.json` has `"type": "module"`. Without it, tsx loads `shared/` as CommonJS and the server crashes in dev.
- Tailwind v4: custom CSS in `client/src/index.css` must stay inside `@layer components` or `@layer base`. Unlayered CSS beats every utility, which is how cards once lost `absolute` positioning.
- Card CSS scales with container query units (`cqw`) on children of `.uno-card`. Never use `cqw` on `.uno-card` itself, because it resolves against the parent; that bug turned cards into ovals.
- Each tab is a seat (token in `sessionStorage`). The profile (nickname, avatar) is shared via `localStorage`, so two tabs need different nicknames.
- Debug handle: `localStorage['uno-party:debug'] = '1'` exposes `window.__unoParty = { store, socket }`. The browser tests rely on it.
- Rigged decks for tests use short notation: `r5`, `gS` (skip), `bR` (reverse), `yD` (draw two), `W`, `W4`. See `server/tests/helpers/cards.ts`. Five skips keep the turn in a 2-player game, which makes scripted wins easy.

## Conventions

- TypeScript strict everywhere, ES modules, 2-space indentation, single quotes, around 120 columns.
- Client actions go through `client/src/game/actions.ts`, which blocks double submits and shows server errors as toasts. Components read state from Zustand stores.
- Animations find elements through `client/src/game/domRegistry.ts`; don't thread refs through components.
- UI copy is sentence case with plain verbs. Errors say what happened and how to fix it.
- After UI changes, run `npm run e2e` and look at the screenshots.
