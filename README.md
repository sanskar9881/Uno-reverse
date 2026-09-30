# Party Night

A hub of real-time party games, played in the browser: **UNO**, **Spin the Bottle**, **Name Wheel**, **Couples Truth or Dare** and **Intimacy Night**. Some games need no server at all (Name Wheel, one-phone Spin the Bottle, Together-mode Couples and Intimacy Night); the rest run in private rooms where one person creates a room, shares the 6-character code or link, and everyone plays from their own phone or computer. Wherever randomness or turn order matters, the server decides — browsers only send what a player wants to do.

Installable as a home-screen app (PWA); the one-phone games work offline once you've visited the site.

![The hub](docs/screenshots/00-hub-desktop.png)

> "UNO" is a trademark of Mattel. This is an unofficial fan project with original card art; the hub itself is branded "Party Night" so it never uses the UNO name outside the UNO game's own screens.

## The games

| Game | Route | Modes | Notes |
| --- | --- | --- | --- |
| **UNO** | `/uno` | Online room, 2–8 players | The full 108-card deck and official rules. See below for details. |
| **Spin the Bottle** | `/bottle` | One phone (no server) or online room, 2–12 players | Party or Flirty (18+) prompt packs, or the bottle just points. |
| **Name Wheel** | `/wheel` | Browser only, no server | Any names, shareable via a link, saved wheels. |
| **Couples Truth or Dare** | `/couples` | Together (one phone) or Long distance (online room, 2 players) | 18+, three consent levels, 240+ cards. |
| **Intimacy Night** | `/intimacy` | Together (one phone) or Long distance (online room, 2 players) | 18+, no truth-or-dare choice — draw one card at a time, 150+ cards across 5 categories. |

| Wheel | Bottle online | Couples |
| --- | --- | --- |
| ![Name Wheel](docs/screenshots/16-wheel-result.png) | ![Spin the Bottle online](docs/screenshots/18-bottle-online-result.png) | ![Couples Truth or Dare](docs/screenshots/20-couples-online-card.png) |

### UNO

- **Rooms:** 6-character codes (no look-alike characters such as 0/O or 1/I), copy code, copy invite link, native share sheet on phones, 2–8 players, host crown, host can remove players, and host settings for turn time (15/30/45/60 s) and match length (no limit, 100, 250 or 500 points).
- **Full deck and rules:** the standard 108 cards with numbers, Skip, Reverse (acts as Skip with two players), Draw Two, Wild and Wild Draw Four. Wild Draw Four is only playable without a card of the active color. The start card is flipped until it's a number. You may play a card you just drew or pass, and the discard pile is reshuffled when the deck runs out.
- **UNO:** call it at one card, or early at two cards on your turn. If you forget, anyone can catch you for +2 cards until the next player acts.
- **Scoring:** official points, rounds, next round (the starting seat rotates), rematch, and an optional target score that ends the match.
- **Turn timer:** when time runs out, the server draws a card for you and passes.
- **Connection handling:** a refresh keeps your seat. Offline players keep their seat for 60 s in a game (15 s in the lobby), and their turns shorten to 10 s. The host role moves on after 10 s offline, or immediately on leaving. A duplicated tab can take a seat over, the last player standing wins by default, and empty rooms are deleted.
- **Stats:** MongoDB stores games played, wins, points and a leaderboard, with an in-memory fallback.

### Spin the Bottle

- **One phone:** add 2–12 players with a name and emoji, save groups for reuse, and pass the phone around. No server, nothing leaves the browser.
- **Online:** create or join a private room (`gameType: 'bottle'`); the server picks who the bottle lands on with secure randomness and every device animates the identical spin from a shared `startedAt` timestamp and server clock offset, the same trick UNO's turn timer uses.
- **Options:** prompt pack (Off, Party, or Flirty 18+ — gated behind a one-time confirmation that everyone is an adult), whether the bottle can land on the spinner, and whether turns go clockwise instead of following the bottle.
- **Prompts:** 60+ Party and 60+ Flirty prompts in `shared/games/bottle/prompts.ts`, fun and never explicit.

### Name Wheel

- Add names by pasting a list, typing one at a time, shuffle, sort A–Z, or clear. 2–100 entries, duplicates allowed.
- An original SVG wheel: alternating carnival colors, pegs that flick the pointer, bulbs that chase while it spins, a title in the hub cap.
- The winner is chosen first with `crypto.getRandomValues` (uniform, verified by a chi-square test over 100k draws), then the wheel animates to land on it at a random spot inside the segment.
- Spin length (short/normal/long), auto-remove winners, a history of the last 10 results, and "Share wheel" — the title and names round-trip through the URL hash as base64url JSON.

### Couples Truth or Dare

- **Age gate:** shown once, remembered per device.
- **Together:** one phone, passed back and forth. Each partner picks a comfort level (Sweet / Flirty / Spicy); the game always plays at the lower of the two. Starting Spicy needs both partners to confirm on the shared screen, since there's no way to know who's actually holding the phone.
- **Long distance:** a private online room (`gameType: 'couples'`, capped at 2 players). Each partner sets their own level from their own device — the server enforces the lower-of-two rule, and lowering a level takes effect on the very next card, from either side.
- **A turn:** choose Truth or Dare, the card flips (a gentle glow, a soft chime, a light vibration), then Pass (redraw, unlimited, no penalty), Done (turn passes), or ❤️ Heart (save to favourites, stored on-device). Some dares carry a countdown (e.g. "for 60 seconds").
- **Custom cards and Our Deck:** either partner can save their own cards, with an optional photo, to Our Deck — a library stored on-device and shared with Intimacy Night, so nothing is imported twice. "Play only our cards" skips the built-in deck entirely. Online, a saved card can be added into the live room (text and photo both travel to your partner); it then lives only in the room's memory and disappears when the room closes.
- **Content:** 240+ cards in `shared/games/couples/decks.ts` (40+ truths and dares per level), warm, playful, inclusive, and never explicit even at Spicy.

### Intimacy Night

- **Age gate:** shown once, remembered per device.
- **Together:** one phone, passed back and forth. No Truth-or-Dare choice — partners take turns drawing one card at a time from a shuffled deck, with a 3D flip. Each partner sets their own comfort level (Sweet / Flirty / Spicy) via a compact slider in the header; the game plays at the lower of the two, same rule as Couples.
- **Long distance:** a private online room (`gameType: 'intimacy'`, capped at 2 players), reusing the same room-code, lobby and presence system as every other game.
- **Categories:** Kiss, Touch and massage, Flirty talk, Mood and setting, and Romance and dates. Pick which are in play at any time; at least one always stays selected.
- **Timed cards:** a card phrased "...for N seconds/minutes" shows a Start button instead of running immediately, so nobody's caught off guard — tapping it runs a get-ready countdown, then the timer, and the screen stays awake for the duration (Screen Wake Lock API, where supported).
- **Custom cards and Our Deck:** shares the same on-device library as Couples Truth or Dare (text plus an optional photo). "Play only our cards" skips the built-in deck.
- **Content:** 150+ cards in `shared/games/intimacy/decks.ts` (10+ per level and category), sensual and suggestive, never explicit.
- **One screen, no scroll:** the card sits upper-middle, the comfort slider lives in the header, and the draw/done action sits below the card — the layout audit checks every viewport from a 320px phone to a short landscape phone, in both themes.

## Tech stack

| Part | Technology |
| --- | --- |
| Client | React 19, TypeScript, Vite 7, Tailwind CSS 4, Zustand, Motion, Socket.IO client, React Router 7, canvas-confetti, vite-plugin-pwa |
| Server | Node.js 20.19+, Express 5, Socket.IO 4, zod, helmet, Mongoose 8 |
| Shared | Plain TypeScript in `shared/` (types, events, constants, rule helpers, and each game's pure logic and content) imported by both sides as `@shared` / `@shared/*` |
| Tests | Vitest (server and client), Playwright (browser end to end) |
| Hosting | Vercel (client), Render (server), MongoDB Atlas (stats) |

## Getting started

You need Node.js 20.19 or newer (22 recommended) and npm 10.

```bash
unzip party-night.zip && cd party-night     # or: git clone <your repo> && cd party-night
npm run install:all
npm run dev
```

Open http://localhost:5173 in two or more tabs. Each tab is its own player (the seat is saved per tab), so give each one a different nickname. To play from a phone on the same Wi-Fi, open the "Network" address that Vite prints, such as `http://192.168.1.20:5173`. The client automatically talks to port 3001 on the same host.

| Script (repo root) | What it does |
| --- | --- |
| `npm run install:all` | Installs root, server and client dependencies |
| `npm run dev` | Server on :3001 (auto-restart) and client on :5173 (hot reload) |
| `npm run build` | Production builds of both, including the service worker |
| `npm test` | Server and client test suites |
| `npm run typecheck` | Strict TypeScript checks for both |
| `npm run e2e` | Browser end-to-end tests (see Testing) |

## Environment variables

Server (`server/.env`, copy from `server/.env.example`). Everything is optional — the single-service deploy below needs none of these.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | HTTP and Socket.IO port. Render sets this for you. |
| `CLIENT_ORIGIN` | empty (any origin) | Only needed if the client is hosted separately from this server. Comma-separated allowed browser origins, e.g. `https://party-night.example.com`. The server always allows its own address in addition to this list, so it's never needed for a normal same-service deploy. |
| `MONGODB_URI` | empty | MongoDB connection string for UNO stats. Without it, stats live in memory. |
| `TRUST_PROXY` | `false` | Set `true` behind Render or any proxy so rate limits see real client IPs |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn` or `error` |

Client (`client/.env`, copy from `client/.env.example`) — only needed for `npm run dev`, or if you deploy the client separately from the server:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_SERVER_URL` | dev: `http(s)://<page host>:3001`. Production build: the page's own origin | Game server URL. Only set this if the client isn't served by this same service, e.g. `https://party-night-server.onrender.com` |

## Architecture

```
party-night/
├── shared/
│   ├── constants.ts, types.ts, events.ts, rules.ts   Core types, socket contracts, UNO rule helpers
│   └── games/
│       ├── bottle/prompts.ts    Party/Flirty prompt packs
│       ├── couples/decks.ts     Truth/Dare decks, level and deck-cycling helpers
│       ├── intimacy/decks.ts    Category decks, sharing the level/pool helpers below
│       └── common.ts            Shared comfort-level, timer-text and deck-cycling helpers
├── server/
│   ├── src/game/         Pure UNO rules engine: deck, turns, scoring, per-player views
│   ├── src/games/
│   │   ├── bottle/engine.ts     Pure online Spin the Bottle state machine
│   │   ├── couples/engine.ts    Pure online Couples Truth or Dare state machine
│   │   └── intimacy/engine.ts   Pure online Intimacy Night state machine
│   ├── src/rooms/         RoomManager (lifecycle, timers, presence, all game types), RoomStore, room codes
│   ├── src/socket/        zod schemas, rate limits, event handlers, per-player broadcasting
│   ├── src/services/      Stats: MongoDB with in-memory fallback
│   ├── src/routes/        GET /api/stats/:profileId, GET /api/leaderboard
│   ├── src/server.ts      In production, also serves client/dist (static files + SPA fallback)
│   └── tests/             Engine, multiplayer, bottle, couples, intimacy and config/static-serving tests; e2e server
├── client/
│   ├── src/pages/         Hub, per-game pages (lazy-loaded), Room (lobby or table), 404
│   ├── src/components/    cards/, lobby/, game/ (UNO table), bottle/, couples/, intimacy/, shared/ (Our Deck), hub/, ui/ (shared design system)
│   ├── src/game/          Actions, sounds, event feedback, each game's pure logic under wheel/, bottle/, couples/, intimacy/, and ourDeck/ (shared custom-card library)
│   ├── src/socket/        Typed Socket.IO client, connection and seat lifecycle
│   └── src/store/         Zustand stores: game state, toasts, effects
├── e2e/                   Playwright browser tests and service script
├── render.yaml            Render blueprint: builds and serves both client and server as one service
└── client/vercel.json     Optional: Vercel settings, only if you deploy the client separately
```

**How an online move flows** (UNO, Spin the Bottle, Couples and Intimacy Night all follow this shape)

1. The browser emits an event, e.g. `game:play { turnId, cardId, chosenColor }` or `bottle:spin { turnId }`, and waits for an acknowledgement.
2. The server checks the payload shape (zod), the rate limit and the seat, then the relevant pure engine checks the turn, the `turnId`, and the rules.
3. The engine updates its state and returns what changed. RoomManager restarts any timers involved (a UNO turn timer, a bottle spin/landing timer) and records UNO stats when a round ends.
4. Every player receives their own `state` snapshot: public table info, their own hand only (UNO), and the relevant `party` state (Spin the Bottle, Couples or Intimacy Night, all fully public to their room). Then the acknowledgement is sent.
5. The browser replaces its state and turns it into sounds, toasts, haptics and animations.

## Multiplayer architecture

- **Server authoritative.** Clients never compute outcomes. The shared rule/logic helpers are only used for UI hints (playable UNO cards, wheel physics, prompt draws in one-phone modes); the pure engines in `server/src/game/` and `server/src/games/*` decide for every online game.
- **One room, one of four game types.** `Room.gameType` is `'uno' | 'bottle' | 'couples' | 'intimacy'`. UNO's state lives in `room.game`, exactly where it always has; the other three share a `room.party: BottleState | CouplesState | IntimacyState | null` discriminated union, so adding a game type never touches another one's code path.
- **Snapshots, not diffs.** After each change every player gets a full personalized snapshot (a few KB). There's no client-side reconciliation, a reconnecting player is instantly correct, and one player's view can never contain another player's UNO hand.
- **Identity.** Joining returns a `playerId` and a random 48-character seat token, stored in `sessionStorage`, so each tab is one seat and a refresh reclaims it. The nickname, avatar and an anonymous profile ID are stored in `localStorage` for stats.
- **Stale and duplicate actions.** Every turn has a `turnId`, in UNO, Spin the Bottle, Couples and Intimacy Night alike. Actions for an old turn are rejected, so double clicks, lag and a timer firing at the same moment can't apply twice.
- **Presence.** Disconnects start a grace timer (60 s in a game, 15 s in the lobby). A reconnect cancels it, and when it expires the seat is released. If the current bottle spinner disconnects before spinning, their turn passes after 10 s, the same pattern as a UNO turn timing out.
- **Scaling.** Active games are held in memory behind a `RoomStore` interface, and room state is plain JSON, so a Redis store can replace it. To run several server instances you'd also add the Socket.IO Redis adapter and route each room to one instance (turn and spin timers run in-process). The current deployment is a single instance, which comfortably handles thousands of rooms.

## Progressive Web App

Built with `vite-plugin-pwa`: a manifest, a maskable + regular icon, and a service worker that precaches the built app shell. Once you've loaded the site once, Name Wheel, one-phone Spin the Bottle and Together-mode Couples and Intimacy Night all work fully offline — verified by loading each route with the network disabled. Online rooms still need a live connection to the game server, same as before.

## Testing

```bash
npm test          # 93 server tests, 11 client tests
npm run e2e       # browser tests (needs: pip install playwright && playwright install chromium)
```

- **Engine tests (39):** UNO deck composition, matching rules, every action card, draw-then-play, reshuffle, UNO timing, scoring, timeouts, and players leaving mid-round.
- **Bottle engine tests (4) + bottle integration tests (6):** the pure targeting/rotation math (uniform over 10k spins, never the spinner unless allowed), and the online flow end to end — only the current spinner can spin, a stale `turnId` is rejected, the target is always a connected player other than the spinner and every client agrees on it, nobody can spin mid-spin, and a disconnected spinner's turn passes automatically.
- **Couples tests (9):** creating a room, both partners seeing the identical drawn card, turn/stale-action checks, Pass keeping the same kind without ending the turn, Done passing the turn and clearing the card, the lower-of-two-levels rule (and that lowering takes effect immediately), Spicy never appearing unless both chose it, the deck not repeating until exhausted, and custom cards.
- **Multiplayer tests (35):** real Socket.IO clients against a real server, covering UNO rooms, privacy of hands, every card type, UNO calls and catches, rounds, rematch, target score, disconnects, reconnects, host handover, forfeits, cleanup, malformed payloads, forged actions, simultaneous plays and rate limits. It finishes with complete random games with 4 and 8 bots that check every card is accounted for after every step.
- **Client tests (11):** Name Wheel's winner-selection uniformity (chi-square over 100k draws), the landing-angle-to-segment mapping, and the share-link round trip.
- **Browser tests (6 scenarios, Playwright):** separate browser contexts per player against the built client and a server that can deal a rigged deck. Three cover UNO end to end (create/join, full game, lobby/host transfer); one spins the Name Wheel and checks a result appears; one creates an online bottle room with three players and asserts every client lands on the same target at the same moment; one creates an online couples room, has both partners draw the identical card, and asserts the lower-of-two consent rule holds when one partner picks Spicy and the other stays at the default. They save screenshots to `e2e-screenshots/`.

To test by hand, run `npm run dev`, open several tabs (or a phone), and work through the hub.

## MongoDB setup

UNO stats are optional. Without `MONGODB_URI`, the server keeps them in memory until it restarts.

1. Create a free M0 cluster at https://cloud.mongodb.com.
2. Under **Database Access**, add a user with read and write access.
3. Under **Network Access**, allow `0.0.0.0/0`. Render's free plan has no fixed outbound IP.
4. Choose **Connect → Drivers**, copy the connection string, and add a database name: `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/party-night?retryWrites=true&w=majority`
5. Put it in `server/.env` (locally) or in the Render environment as `MONGODB_URI`.

On startup the server logs `Stats: connected to MongoDB`. It writes one `player_stats` document per profile, and only when a UNO round ends; live games never touch the database, and Spin the Bottle / Couples never record stats at all. If MongoDB is unreachable at startup, the server logs a warning and falls back to memory.

For a local database instead of Atlas, run `docker run -d -p 27017:27017 mongo:7` and set `MONGODB_URI=mongodb://localhost:27017/party-night`.

## Deployment

The whole app deploys as **one Render service**. It builds the client and the server together, and the server serves the built client itself — same address for the site, the API and Socket.IO, so there's no CORS to configure and no `VITE_SERVER_URL` to set.

1. Push the repo to GitHub.
2. In Render, choose **New → Blueprint** and pick the repo. `render.yaml` sets up everything: it installs and builds both `client/` and `server/`, then starts the server, which serves the built client and answers `/api`, `/socket.io` and `/health` itself.
3. `CLIENT_ORIGIN` and `MONGODB_URI` are both optional — leave them blank for a working default deploy. The service always allows its own address, whatever `CLIENT_ORIGIN` says.
4. Check that `https://<your-service>.onrender.com/health` returns `{"ok":true,…}`, then open the same URL — that's the app itself now, not a separate site.

If you set up a Web Service by hand instead of using the blueprint, use these settings: no root directory (the build needs both `client/` and `server/`), build command `npm --prefix server ci --include=dev && npm --prefix client ci --include=dev && npm run build`, start command `npm --prefix server start`, health check path `/health`, and environment `NODE_VERSION=22`, `TRUST_PROXY=true`.

Two things to know about the free plan. It sleeps after 15 minutes without traffic, so the first visitor waits — the client shows "Waking up the game server" and keeps waiting up to 3 minutes, then finishes creating or joining the game automatically once it connects. Active games also live in memory, so a restart or redeploy ends them, while UNO stats in MongoDB are kept.

### Hosting the client separately

You don't need to — the single service above is the whole app. But if you'd rather host the client elsewhere (Vercel, a CDN, a second environment), the pieces are still there: set `VITE_SERVER_URL` on the client build to this service's URL, `client/vercel.json` has Vercel's build settings and single-page-app rewrite, and set `CLIENT_ORIGIN` on the server to that client's origin (comma-separate more than one, e.g. a production domain plus a preview domain).

## Replacing sounds

Every sound is synthesized with Web Audio, so there are no files to download. To use real audio, put files in `client/public/sounds/` and register them in `SOUND_FILES` in `client/src/game/sounds.ts`, for example `play: '/sounds/play.mp3'`. Any sound without a file keeps using the synthesizer. The list of sound names is in `client/public/sounds/README.md`.

## Rule choices

These follow the official UNO rules unless noted.

- Wild Draw Four can't be challenged. Instead, the server only allows it when you hold no card of the active color.
- Draw Two and Draw Four don't stack.
- A final Draw Two or Draw Four still makes the next player draw, and those cards count toward the score.
- When time runs out, the server draws one card for you and ends your turn.

## Known limitations

- There is one server instance and games are held in memory; see Scaling above for the path to Redis.
- The MongoDB stats service is type-checked and falls back safely, but the automated tests use the in-memory store, and only UNO records stats at all.
- There are no accounts. Stats follow an anonymous profile ID stored in the browser.
- Spin the Bottle and Couples don't currently reassign a departed player's turn beyond the spinner-disconnect and 2-player cases described above; a couples session with a partner gone simply waits.

## Keyboard shortcuts (UNO)

`D` draws, `P` passes, `U` calls UNO, `←`/`→` choose a card, `Enter` plays it, and `1`–`4` pick a color in the color picker.
