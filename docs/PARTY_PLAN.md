# Party Night: build plan for Claude Code

This is the spec for turning UNO Party into a hub of party games. It adds three new games and a redesign:

- Name Wheel
- Spin the Bottle
- Couples Truth or Dare (private, 18+)

Work through **one phase at a time, in order**. Each phase is shippable on its own.

## How to work (applies to every phase)

1. Read `CLAUDE.md` and follow its invariants.
2. Run `npm test` before changing anything, to confirm the baseline is green.
3. Build the phase. Everything that already works must keep working unless the phase says otherwise.
4. The phase is done when all of these hold:
   - `npm test`, `npm run typecheck` and `npm run build` all pass.
   - You've run `npm run dev` and checked every item in the phase checklist at 1280×800 and 390×844. There are no console errors and no horizontal scrolling on mobile.
   - UNO still works: create, join, play. Run `npm run e2e` when Python Playwright is available.
   - The work is committed with the phase's commit message.
5. Finish with a short summary: what changed, how you verified it, and anything you couldn't verify.

### Guardrails

- **Dependencies:** don't add any beyond those named in this plan without asking.
- **Server authority:** for every online game, the server decides the randomness, turn order and card draws.
- **Brand name:** keep it in one constant, `APP_NAME` in `shared/constants.ts`, defaulting to `"Party Night"`. "UNO" is a Mattel trademark, so the hub is not called UNO; the UNO game keeps its name on its own screens.
- **Mobile first:** everything is usable one-handed on a phone, with touch targets of at least 44 px.
- **Accessibility:** respect `prefers-reduced-motion`, keep keyboard focus visible, and never use color as the only signal.
- **Sounds:** follow the pattern in `client/src/game/sounds.ts`. They are synthesized, respect mute, and can be overridden with audio files.

---

## Phase 1: Game hub and a new look

**Goal:** the landing page becomes a shelf of games, and the app gets a richer visual system. UNO's behavior doesn't change.

### Routing

- `/`: the hub.
- `/uno`: the current UNO landing page (create or join).
- `/wheel`, `/bottle`, `/couples`: placeholder pages showing "Coming soon" with a back link. Later phases fill them in.
- `/room/:code`: unchanged.
- Update `e2e/run_e2e.py` so its landing-page steps start at `/uno`.

### Hub

Give each game a tile with its own original SVG illustration, its name, a one-line description and a badge:

| Game | Illustration | Badge |
| --- | --- | --- |
| UNO | fanned cards | "2–8 players, online" |
| Spin the Bottle | a glass bottle on a rug | "2–12 players, one phone or online" |
| Name Wheel | a carnival wheel | "Any names, one screen" |
| Couples Truth or Dare | two cards and a candle | "2 players, 18+" |

- The tiles deal in once when the page loads.
- Hovering or pressing a tile lifts it with a slight tilt and a deeper shadow.
- Below the tiles, add a "Have a code?" input. It validates like UNO and navigates to `/room/CODE`, where the existing join panel asks for a nickname if needed.
- On the hub, the nickname and avatar sit behind a small avatar button in the top bar. The `/uno` page keeps its current profile fields.

### Design system

All of this lives in `client/src/index.css`, inside `@layer`.

**Tokens.** Keep the night palette and add accents for each game:

| Game | Accent colors |
| --- | --- |
| Bottle | amber `#F4A340`, bottle glass `#3FB8A9` |
| Wheel | carnival red `#E6394A`, gold `#F7C948` |
| Couples | wine `#5B1633`, rose `#FF6F91`, candle `#F6C177` |

**Background.** Layered radial light plus subtle grain, made with an SVG `feTurbulence` data URI. Add a slow ambient drift on the hub only, and keep it static when reduced motion is on.

**Shared components** in `client/src/components/ui/`:

- **Surface:** a panel with an inner highlight and a soft shadow.
- **Button:** add a loading state and an icon slot.
- **Chip.**
- **SegmentedControl:** move it out of `Lobby.tsx`.
- **Sheet:** a bottom sheet on phones and a centered dialog on desktop.
- **PageHeader:** a back button, the page title and the sound toggle.

**Motion.** One orchestrated entrance per page, and quick, responsive feedback on every press. Avoid scattered decorative animation.

**Fonts.** Keep Bagel Fat One for display text and Baloo 2 for the interface. Add `@fontsource-variable/fraunces`, used only by the couples game.

### UNO polish

This is visual only. Don't change any aria-labels or selectors that the e2e tests use.

- A wooden rim around the felt table, made with CSS gradients.
- A light sheen that sweeps across a card when it's hovered or selected.
- A richer emblem on the card back.
- A soft spotlight under your hand while it's your turn.

### Checklist

- The hub looks polished on a phone and on desktop.
- Every tile opens its route.
- A code entered on the hub joins an UNO room.
- UNO works exactly as before.

**Commit:** `feat: game hub and refreshed design system`

---

## Phase 2: Name Wheel (runs entirely in the browser)

**Route:** `/wheel`

### Names

- A list editor: one name per line in a textarea, or add names one at a time as chips. Pasting a list works.
- Between 2 and 100 entries; duplicates are allowed.
- Buttons to shuffle, sort A–Z and clear.
- A field for the wheel's title.
- Saved wheels, stored by name in localStorage, can be loaded and deleted.

### Wheel graphics (SVG)

- Segments alternate colors from a carnival palette.
- Labels stay readable: rotated along the radius, shrunk to fit, and ellipsized when too long.
- Pegs around the rim.
- A pointer at the top that flicks each time it passes a peg.
- Bulbs around the rim that chase while the wheel spins.
- A center hub cap showing the wheel's title.

### Spinning

- The wheel spins when you tap the Spin button, tap the wheel, or flick it. The flick's speed sets how hard it spins.
- Choose the winner first with `crypto.getRandomValues`. Then animate the wheel so it lands exactly on that winner, at a random spot inside the segment rather than always the center.
- A spin lasts 4–7 seconds and slows down with a realistic deceleration curve.
- Play a tick sound for each peg, speeding up and slowing down with the wheel. Where the phone supports it, add a light vibration.

### Result

- A winner sheet with confetti.
- Buttons for "Spin again", "Remove and spin again" and "Copy result".
- A history of the last 10 results.

### Options

- Spin length: short, normal or long.
- Remove winners automatically.
- Sound on or off.

### Sharing

"Share wheel" encodes the title and names in the URL hash as base64url JSON, capped at about 2 KB. Opening the link recreates the same wheel.

### Tests

Add Vitest to the client for the pure logic, and test that:

- Winner selection is uniform (a chi-square test over 100k draws).
- The landing angle always maps to the chosen segment.
- The share link round-trips.

### Checklist

- Spins work with 2, 10 and 100 names.
- Long names stay readable.
- A shared link opens the same wheel.
- It's comfortable to use on a phone.

**Commit:** `feat: name wheel`

---

## Phase 3: Spin the Bottle on one phone

**Route:** `/bottle`. This mode is for people sitting together around one phone. There's no server.

### Setup

- Add 2–12 players by name, each with an optional emoji.
- Groups can be saved and reused locally.

### Table and bottle

- The players sit evenly around a circle on a warm wooden floor or rug.
- The bottle is an SVG glass bottle with highlights and a shadow that rotates with it.

### Spinning

- The bottle spins when you tap it or flick it.
- Choose the target first with secure randomness. It's never the spinner unless the "can land on yourself" option is on.
- The spin lasts 3–6 seconds, decelerates, and wobbles slightly at the end.
- On landing, a highlight ring appears around the target and a sound plays.

### Prompts after landing

Offer three prompt packs:

- **Off:** the bottle just points.
- **Party** (the default): friendly truths and dares.
- **Flirty 18+:** available only after a confirmation that everyone playing is 18 or older.

Write the prompts in `shared/games/bottle/prompts.ts`: at least 60 Party and 60 Flirty prompts. They're fun and never explicit.

### Turns

By default, the person the bottle lands on spins next. An option switches to going clockwise instead.

### Checklist

- It works with 2 players and with 12.
- The bottle always lands on the chosen player.
- Prompts appear after landing and match the chosen pack.
- It's easy to use on a phone lying flat on a table.

**Commit:** `feat: spin the bottle (one phone)`

---

## Phase 4: Online rooms for new games, starting with Spin the Bottle

**Goal:** rooms can host more than UNO, and Spin the Bottle can be played online.

### Server

Choose the least risky refactor. All existing tests must pass unchanged.

**Room changes.**

- Add `gameType: 'uno' | 'bottle' | 'couples'` to the room and to `RoomView`.
- `room:create` accepts an optional `gameType`, which defaults to `'uno'`.
- Maximum players per game type: UNO 8, bottle 12, couples 2.

**Game state.**

- Keep UNO's state exactly where it is.
- New games live in a separate discriminated union, for example `room.party: BottleState | CouplesState | null`, so no UNO code changes.
- Each new game's rules go in pure modules under `server/src/games/<name>/`. Like `engine.ts`, they are pure and synchronous, and they're unit-tested.
- Views go in `ClientState.party` and follow the same privacy rules as UNO.

**Reuse.** The lobby, presence, reconnects, host transfer and cleanup stay as they are.

### Spin the Bottle online

**State.**

- The turn order, `spinnerId` and `turnId`.
- `spin`, which is `null` or `{ id, seatOrder, targetId, startedAt, durationMs, turns }`.
- `prompt`, which is `null` or the drawn prompt.

`seatOrder` is snapshotted when a spin starts, so someone joining or leaving mid-spin can't change where the bottle points.

**Spinning.**

- The event is `bottle:spin { turnId }`. Only the current spinner can send it, and only while no spin is running.
- The server picks the target with secure randomness from the connected players other than the spinner.

**Sync.**

- Every client animates the same spin using `startedAt` and the server clock offset, the way UNO does.
- Someone who joins mid-spin sees it at the correct point.

**Landing.** When the spin lands (on a server timer), the server draws a prompt from the room's pack if one is enabled. The target becomes the next spinner.

**Disconnects.** If the spinner disconnects, their turn passes after 10 seconds, following the UNO pattern.

**Events.** New events are typed in `shared/events.ts`, validated with zod and rate-limited.

**Lobby.** Reuse the UNO lobby UI, with the bottle's settings: the prompt pack and who spins next.

### Tests

Server tests cover:

- Only the spinner can spin.
- The target is always a connected player other than the spinner.
- A stale `turnId` is rejected.
- The turn passes correctly.
- Disconnects are handled.
- Targets are roughly uniform over 10k spins.

### Checklist

- Three browser windows see the same spin land on the same player at the same moment.
- Refreshing mid-spin shows the spin correctly.
- UNO rooms still work.

**Commit:** `feat: online rooms for new games, spin the bottle online`

---

## Phase 5: Couples Truth or Dare (private, 18+)

**Route:** `/couples`

### Age gate

On the first visit, show "This game is for adults. Both of you should be 18 or older." with two buttons: "We're both 18+" and "Back". Remember the answer in localStorage.

### Modes

- **Together:** one phone passed back and forth. No server.
- **Long distance:** a private online room with `gameType: 'couples'` and at most 2 players.

### Levels

| Level | Feel |
| --- | --- |
| Sweet | romantic, getting to know each other |
| Flirty | playful, teasing |
| Spicy | sensual and suggestive, never graphic or explicit |

Consent is part of the design:

- Each partner picks their own comfort level, and the game always plays at **the lower of the two**.
- In Together mode, both partners confirm on the phone before Spicy starts.
- Either partner can lower the level at any time, and it takes effect instantly.

### A turn

1. The current partner chooses Truth or Dare.
2. A card is drawn from the shuffled deck for that level and kind.
3. A 3D flip reveals it. Online, both partners see the flip at the same moment.
4. The partner picks one of:
   - **Done:** the turn passes to the other partner.
   - **Pass:** draw another card. Passes are unlimited and carry no penalty.
   - **Heart:** save the card to favourites, stored locally.

Some dares include a timer, such as "for 60 seconds"; show a countdown for those. Cards don't repeat until their deck is used up, and then the deck reshuffles.

### Custom cards

- Either partner can write their own truths and dares, up to 200 characters each.
- In Together mode, custom cards are saved on the device.
- Online, they're held only in the room's memory and disappear when the room closes.

### Card content

Put the decks in `shared/games/couples/decks.ts`, with at least 40 truths and 40 dares per level (240+ cards).

**Tone:**

- Warm, playful and consensual.
- Inclusive of any couple, with no gendered assumptions.
- Nothing unsafe, humiliating or illegal.
- Spicy stays suggestive and never becomes explicit.

**Examples of the tone:**

| Level | Truth | Dare |
| --- | --- | --- |
| Sweet | "What's a small thing I do that makes your day better?" | "Hold my hands and tell me three things you love about me." |
| Flirty | "What did you notice about me the first time we met?" | "Whisper the last thing you daydreamed about me." |
| Spicy | "What's something you've wanted to try with me but never said?" | "Kiss me somewhere I choose." or "Give me a slow two-minute massage." |

### Online play

- The server holds the deck order and the current card, so both partners always see the same card.
- The level is the minimum of the two partners' chosen levels.
- The events are `couples:choose`, `couples:pass`, `couples:done`, `couples:level` and `couples:addCard`. Each is typed, validated with zod and rate-limited.

### Look

- A candlelit theme: a deep wine-to-plum background with soft bokeh lights.
- Cards styled like tarot cards, with gold edges and an elegant back pattern.
- Fraunces for headings.
- A gentle glow when a card is revealed.

### Privacy

- No stats and no leaderboard.
- Card text is never logged.
- A room holds at most 2 players, and its code is the only way in.

### Checklist

- Both modes work.
- Spicy never appears unless both partners chose it.
- Lowering the level takes effect immediately.
- The deck doesn't repeat.
- It works well on a phone.
- Server tests cover draws, levels, Pass and Done.

**Commit:** `feat: couples truth or dare (18+)`

---

## Phase 6: Polish and ship

- **PWA:** add a manifest, icons and a service worker (`vite-plugin-pwa` is allowed) so people can add the app to their home screen. The one-phone games (Name Wheel, one-phone Spin the Bottle and Together-mode Couples) work offline.
- **Sound and haptics:** give every new game a full pass.
- **E2E:** extend `e2e/run_e2e.py` with one scenario per new game:
  - Name Wheel: spin and see a result.
  - Spin the Bottle online: three players see the same result.
  - Couples online: two players draw cards, and the consent rule for levels holds.
- **Performance:** lazy-load each game route with `React.lazy` so the hub loads quickly.
- **README:** list the games, add screenshots, and document any new settings.

**Commit:** `chore: polish, pwa, e2e and docs`
