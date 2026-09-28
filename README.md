# UNO Party

A real-time multiplayer UNO-style card game for 2–8 friends, played in the browser. One person creates a room, shares the 6-character code or link, and everyone plays from their own phone or computer. The server runs every rule; browsers only send what a player wants to do.

![A four-player table](docs/screenshots/05-board-desktop-4p.png)

> "UNO" is a trademark of Mattel. This is an unofficial fan project with original card art. Rename it before publishing it publicly or commercially.

## Features

- **Rooms:** 6-character codes (no look-alike characters such as 0/O or 1/I), copy code, copy invite link, native share sheet on phones, 2–8 players, host crown, host can remove players, and host settings for turn time (15/30/45/60 s) and match length (no limit, 100, 250 or 500 points).
- **Full deck and rules:** the standard 108 cards with numbers, Skip, Reverse (acts as Skip with two players), Draw Two, Wild and Wild Draw Four. Wild Draw Four is only playable without a card of the active color. The start card is flipped until it's a number. You may play a card you just drew or pass, and the discard pile is reshuffled when the deck runs out.
- **UNO:** call it at one card, or early at two cards on your turn. If you forget, anyone can catch you for +2 cards until the next player acts.
- **Scoring:** official points, rounds, next round (the starting seat rotates), rematch, and an optional target score that ends the match.
- **Turn timer:** when time runs out, the server draws a card for you and passes.
- **Connection handling:** a refresh keeps your seat. Offline players keep their seat for 60 s in a game (15 s in the lobby), and their turns shorten to 10 s. The host role moves on after 10 s offline, or immediately on leaving. A duplicated tab can take a seat over, the last player standing wins by default, and empty rooms are deleted.
- **Interface:** dark card-table look, original card design, animations for dealing, playing and drawing, confetti, toasts, keyboard shortcuts, a compact layout for phones, and reduced-motion support.
- **Sound:** synthesized effects for play, draw, UNO, turns, join, leave and victory, with a mute toggle. Any sound can be replaced with a real audio file.
- **Security:** every payload is validated with zod, events are rate-limited per socket and per IP, turn IDs reject stale or duplicate actions, and hands never leave the server except to their owner. Messages are capped at 16 KB, and the server uses helmet, a CORS allow-list and constant-time token checks.
- **Stats:** MongoDB stores games played, wins, points and a leaderboard, with an in-memory fallback.

| Lobby | Phone | Round over |
| --- | --- | --- |
| ![Lobby](docs/screenshots/03-lobby-host.png) | ![Phone](docs/screenshots/07-board-mobile.png) | ![Round over](docs/screenshots/11-round-over-winner.png) |

## Tech stack

| Part | Technology |
| --- | --- |
| Client | React 19, TypeScript, Vite 7, Tailwind CSS 4, Zustand, Motion, Socket.IO client, React Router 7, canvas-confetti |
| Server | Node.js 20.19+, Express 5, Socket.IO 4, zod, helmet, Mongoose 8 |
| Shared | Plain TypeScript in `shared/` (types, events, constants, rule helpers) imported by both sides as `@shared` |
| Tests | Vitest (engine and multiplayer over real sockets), Playwright (browser end to end) |
| Hosting | Vercel (client), Render (server), MongoDB Atlas (stats) |

## Getting started

You need Node.js 20.19 or newer (22 recommended) and npm 10.

```bash
unzip uno-party.zip && cd uno-party     # or: git clone <your repo> && cd uno-party
npm run install:all
npm run dev
```

Open http://localhost:5173 in two or more tabs. Each tab is its own player (the seat is saved per tab), so give each one a different nickname. To play from a phone on the same Wi-Fi, open the "Network" address that Vite prints, such as `http://192.168.1.20:5173`. The client automatically talks to port 3001 on the same host.

| Script (repo root) | What it does |
| --- | --- |
| `npm run install:all` | Installs root, server and client dependencies |
| `npm run dev` | Server on :3001 (auto-restart) and client on :5173 (hot reload) |
| `npm run build` | Production builds of both |
| `npm test` | Server test suite |
| `npm run typecheck` | Strict TypeScript checks for both |
| `npm run e2e` | Browser end-to-end tests (see Testing) |

## Environment variables

Server (`server/.env`, copy from `server/.env.example`). Everything is optional for local development.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | HTTP and Socket.IO port. Render sets this for you. |
| `CLIENT_ORIGIN` | empty (any origin) | Comma-separated list of allowed browser origins, e.g. `https://uno-party.vercel.app` |
| `MONGODB_URI` | empty | MongoDB connection string for stats. Without it, stats live in memory. |
| `TRUST_PROXY` | `false` | Set `true` behind Render or any proxy so rate limits see real client IPs |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn` or `error` |

Client (`client/.env`, copy from `client/.env.example`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_SERVER_URL` | `http(s)://<page host>:3001` | Game server URL, e.g. `https://uno-party-server.onrender.com` |

## Architecture

```
uno-party/
├── shared/              Types, socket event contracts, constants, rule helpers (client + server)
├── server/
│   ├── src/game/        Pure rules engine: deck, turns, scoring, UNO, per-player views
│   ├── src/rooms/       RoomManager (lifecycle, timers, presence), RoomStore, room codes
│   ├── src/socket/      zod schemas, rate limits, event handlers, per-player broadcasting
│   ├── src/services/    Stats: MongoDB with in-memory fallback
│   ├── src/routes/      GET /api/stats/:profileId, GET /api/leaderboard
│   └── tests/           Engine + multiplayer tests, rigged-deck helpers, e2e server
├── client/
│   ├── src/pages/       Landing, Room (lobby or table), 404
│   ├── src/components/  cards/, lobby/, game/ (table, seats, hand, modals), ui/
│   ├── src/game/        Actions, sounds, event feedback, seat layout, animation registry
│   ├── src/socket/      Typed Socket.IO client, connection and seat lifecycle
│   └── src/store/       Zustand stores: game state, toasts, effects
├── e2e/                 Playwright browser tests and service script
├── render.yaml          Render blueprint for the server
└── client/vercel.json   Vercel settings for the client
```

**How a move flows**

1. The browser emits `game:play { turnId, cardId, chosenColor }` and waits for an acknowledgement.
2. The server checks the payload shape (zod), the rate limit and the seat, then the engine checks the turn, the `turnId`, that the card is in the player's hand, and that it's legal.
3. The engine updates the game and returns a list of events. RoomManager restarts the turn timer and records stats when a round ends.
4. Every player receives their own `state` snapshot, containing public table information, their own hand only, and the events that just happened. Then the acknowledgement is sent.
5. The browser replaces its state and turns the events into sounds, toasts and animations.

## Multiplayer architecture

- **Server authoritative.** Clients never compute outcomes. The shared rule helpers are only used to highlight playable cards; the engine in `server/src/game/engine.ts` decides.
- **Snapshots, not diffs.** After each change every player gets a full personalized snapshot (a few KB). There's no client-side reconciliation, a reconnecting player is instantly correct, and one player's view can never contain another player's cards. Events travel with the snapshot so the client can animate them.
- **Identity.** Joining returns a `playerId` and a random 48-character seat token, stored in `sessionStorage`, so each tab is one seat and a refresh reclaims it. The nickname, avatar and an anonymous profile ID are stored in `localStorage` for stats.
- **Stale and duplicate actions.** Every turn has a `turnId`. Actions for an old turn are rejected, so double clicks, lag and a timer firing at the same moment can't apply twice.
- **Presence.** Disconnects start a grace timer (60 s in a game, 15 s in the lobby). A reconnect cancels it, and when it expires the seat is released and the player's cards are shuffled back into the deck.
- **Scaling.** Active games are held in memory behind a `RoomStore` interface, and room state is plain JSON, so a Redis store can replace it. To run several server instances you'd also add the Socket.IO Redis adapter and route each room to one instance (turn timers run in-process). The current deployment is a single instance, which comfortably handles thousands of rooms.

## Testing

```bash
npm test          # 74 server tests
npm run e2e       # browser tests (needs: pip install playwright && playwright install chromium)
```

- **Engine tests (39):** deck composition, matching rules, every action card, draw-then-play, reshuffle, UNO timing, scoring, timeouts, and players leaving mid-round.
- **Multiplayer tests (35):** real Socket.IO clients against a real server, covering rooms, privacy of hands, every card type, UNO and catches, rounds, rematch, target score, disconnects, reconnects, host handover, forfeits, cleanup, malformed payloads, forged actions, simultaneous plays and rate limits. It finishes with complete random games with 4 and 8 bots that check every card is accounted for after every step.
- **Browser tests (3 scenarios, Playwright):** separate browser contexts per player against the built client and a server that can deal a rigged deck. They save screenshots to `e2e-screenshots/`.

Where each of the 19 multi-tab test scenarios is automated:

| Scenario | Server tests | Browser tests |
| --- | --- | --- |
| Create room, join with code | ✓ | ✓ (link and code) |
| 2-player game, 4+ player game | ✓ (2, 5, 8 players) | ✓ (2 and 4) |
| Valid play, invalid play | ✓ | ✓ (UI message and forged socket event) |
| Draw card | ✓ | ✓ |
| Skip, Reverse, Draw Two, Wild, Wild Draw Four | ✓ | ✓ |
| UNO button, missed-UNO penalty | ✓ | ✓ |
| Winner, round restart | ✓ | ✓ |
| Player disconnect, player reconnect | ✓ | ✓ (closed browser, page refresh) |
| Host leaves | ✓ | ✓ |
| Phone layout | – | ✓ (390×844, no horizontal scroll) |

To test by hand, run `npm run dev`, open several tabs (or a phone), and work through the same list.

## MongoDB setup

Stats are optional. Without `MONGODB_URI`, the server keeps them in memory until it restarts.

1. Create a free M0 cluster at https://cloud.mongodb.com.
2. Under **Database Access**, add a user with read and write access.
3. Under **Network Access**, allow `0.0.0.0/0`. Render's free plan has no fixed outbound IP.
4. Choose **Connect → Drivers**, copy the connection string, and add a database name: `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/uno-party?retryWrites=true&w=majority`
5. Put it in `server/.env` (locally) or in the Render environment as `MONGODB_URI`.

On startup the server logs `Stats: connected to MongoDB`. It writes one `player_stats` document per profile, and only when a round ends; live games never touch the database. If MongoDB is unreachable at startup, the server logs a warning and falls back to memory.

For a local database instead of Atlas, run `docker run -d -p 27017:27017 mongo:7` and set `MONGODB_URI=mongodb://localhost:27017/uno-party`.

## Deployment

Deploy the server first, because the client needs its URL.

### Server on Render

1. Push the repo to GitHub.
2. In Render, choose **New → Blueprint** and pick the repo. `render.yaml` sets up everything else.
3. When asked, set `CLIENT_ORIGIN` to your client URL (you can come back to this after step 2 of the Vercel section) and, optionally, `MONGODB_URI`.
4. Check that `https://<your-service>.onrender.com/health` returns `{"ok":true,…}`.

If you set up a Web Service by hand instead of using the blueprint, use these settings: root directory `server`, build command `npm ci --include=dev && npm run build`, start command `npm start`, health check path `/health`, and environment `NODE_VERSION=22`, `TRUST_PROXY=true`, `CLIENT_ORIGIN`, `MONGODB_URI`.

Two things to know about the free plan. It sleeps after 15 minutes without traffic, so the first visitor waits up to a minute; the client shows "Waking up the game server" meanwhile. Active games also live in memory, so a restart or redeploy ends them, while stats in MongoDB are kept.

### Client on Vercel

1. In Vercel, choose **Add New → Project** and import the repo.
2. Set **Root Directory** to `client`. The framework is detected as Vite, and `client/vercel.json` provides the build settings and the single-page-app rewrite.
3. Add the environment variable `VITE_SERVER_URL=https://<your-service>.onrender.com`.
4. Keep **Include files outside the root directory in the Build Step** turned on (it's the default). The client imports `../shared`.
5. Deploy, then add the Vercel URL to `CLIENT_ORIGIN` on Render. Separate several with commas, such as the production domain plus a preview domain.

Open the Vercel URL, create a room, and join it from your phone to confirm everything is connected.

## Replacing sounds

Every sound is synthesized with Web Audio, so there are no files to download. To use real audio, put files in `client/public/sounds/` and register them in `SOUND_FILES` in `client/src/game/sounds.ts`, for example `play: '/sounds/play.mp3'`. Any sound without a file keeps using the synthesizer. The list of sound names is in `client/public/sounds/README.md`.

## Rule choices

These follow the official rules unless noted.

- Wild Draw Four can't be challenged. Instead, the server only allows it when you hold no card of the active color.
- Draw Two and Draw Four don't stack.
- A final Draw Two or Draw Four still makes the next player draw, and those cards count toward the score.
- When time runs out, the server draws one card for you and ends your turn.

## Known limitations

- There is one server instance and games are held in memory; see Scaling above for the path to Redis.
- The MongoDB stats service is type-checked and falls back safely, but the automated tests use the in-memory store.
- There are no accounts. Stats follow an anonymous profile ID stored in the browser.

## Keyboard shortcuts

`D` draws, `P` passes, `U` calls UNO, `←`/`→` choose a card, `Enter` plays it, and `1`–`4` pick a color in the color picker.
