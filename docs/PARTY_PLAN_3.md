# Party Night build plan, part 3

This plan uses the same workflow as `docs/PARTY_PLAN.md`: one phase at a time, in order, following its "How to work" steps and guardrails. If `npm run audit:layout` exists (from part 2), run it before every commit and fix everything it reports.

---

## Phase 12: Connection reliability

**Goal:** nobody sees "Couldn't reach the game server" just because the free server was asleep, and a settings mistake can't silently block connections.

### Client

- **Wake the server early.** As soon as any page loads, send one `GET` to `/health` on the game server. This starts the free-plan wake-up while people are still typing their nickname.
- **Wait long enough.**
  - Create, Join and Rejoin wait up to 3 minutes for a connection instead of 60 seconds, then finish automatically without a second click.
  - While waiting, show one clear message: "Waking up the game server. This can take up to a minute." After 90 seconds, add "Still waking up…".
  - The button shows a loading state, and the wait can be cancelled.
- **Offline.** If the browser is offline (`navigator.onLine` is false), say "You're offline" straight away instead of waiting.
- **Inside a room.** The "Reconnecting…" banner gets a "Retry now" button.

### Server

- **Normalize `CLIENT_ORIGIN`:**
  - Split it on commas.
  - Trim spaces and quotes, and strip trailing slashes.
  - Lowercase the scheme and host.
  - Ignore empty entries.
  - An empty list still means any origin is allowed.
- **Log rejections.** Log one warning for each rejected origin, including the allowed list. Rate-limit it so the logs don't flood.
- **Tests.**
  - `https://example.com/` in `CLIENT_ORIGIN` allows the origin `https://example.com`.
  - So does `HTTPS://Example.com`.

### Build

In `client/vite.config.ts`, fail the build with a clear message when it runs on Vercel (`process.env.VERCEL` is set) and `VITE_SERVER_URL` is missing. Local builds and `npm run e2e` keep working without it.

### Checklist

- Start the client, click Create Game, and start the server about 40 seconds later. The room is created without a second click.
- A trailing slash in `CLIENT_ORIGIN` still works.
- A Vercel build without `VITE_SERVER_URL` fails with the message.

**Commit:** `fix: connection reliability and origin handling`

---

## Phase 13: The "card room" design system, in dark and light

**Concept:** a card table at night under a warm lamp: walnut wood, felt with a stitched edge, brass accents, and cards that feel like premium printed stock. This replaces the purple look everywhere.

### Fonts

- **Display:** Bricolage Grotesque, weights 700–800 (`@fontsource-variable/bricolage-grotesque`). Use it for headings, numbers and card symbols.
- **Interface:** Manrope, weights 500–800 (`@fontsource-variable/manrope`). Use it for everything else.
- Remove Bagel Fat One and Baloo 2. Keep Fraunces only in the couples game.
- Import only the Latin subsets, and cache only woff2 files for offline use.

### Dark theme tokens

| Token | Value |
| --- | --- |
| Room background | vertical gradient `#14161A` → `#0E0F12`, plus a lamp glow `radial-gradient(ellipse 70% 60% at 50% 42%, rgba(255,205,140,0.08), transparent 70%)` |
| Surface (panels, seat plates) | `rgba(20,22,25,0.95)`, 1 px inner line |
| Surface 2 (buttons, chips) | `rgba(244,241,234,0.07)` |
| Ink (text) | `#F4F1EA` |
| Muted text | `#B4ADA0` |
| Line | `rgba(244,241,234,0.12)` (0.10–0.14) |
| Brass (accent) | `#E3B35A`, hover `#F0C572`, text on brass `#1A1406` |
| Danger / offline | `#F08A7A` |
| Wood | `linear-gradient(180deg, #6E4A33 0%, #4E3222 52%, #38241A 100%)` under a grain of `repeating-linear-gradient(96deg, rgba(0,0,0,0.10) 0 2px, transparent 2px 11px)` |
| Felt, green (default) | `#1F6B52` / `#155441` / `#0E3E30` (center / middle / edge of a radial gradient) |
| Felt, teal | `#1A6577` / `#0F4C5C` / `#0A3542` |
| Felt, burgundy | `#74303D` / `#5A1F2B` / `#3D131C` |
| Felt, navy | `#2C3B63` / `#1E2A4A` / `#141C33` |
| Lamp on felt | `radial-gradient(ellipse 60% 55% at 50% 45%, rgba(255,226,170,0.13), transparent 70%)` layered over the felt |

### Light theme tokens

The same materials, in daylight:

| Token | Value |
| --- | --- |
| Room background | `#F3EEE5` → `#E8E1D4`, with a soft warm glow |
| Surface | `#FFFFFF` |
| Surface 2 | `rgba(29,27,23,0.05)` |
| Ink | `#1D1B17` |
| Muted text | `#625B50` |
| Line | `rgba(29,27,23,0.12)` |
| Brass | `#C9952F` for fills and rings, with text on brass `#1A1406`. Brass-colored text on light backgrounds uses `#8A6116`. |
| Danger | `#C2412D` |
| Wood | lighter: `#8A6243` → `#6A4730` → `#573A28`, same grain |
| Felt | the same options as dark, with a slightly stronger lamp highlight |

Everything meets WCAG AA in both themes. Check the muted text and the brass text especially.

### Avatars

- Players show their initial on a colored circle instead of an emoji.
- The profile's avatar picker becomes 12 colors. The saved avatar number maps to a color, so the server doesn't change.
- The tones are `#9CC5A1`, `#A9B8E8`, `#E7A88B`, `#E8C77A`, `#C9A5D8`, `#E7C3A0`, `#8FD1CF`, `#F2A7B8`, `#B7D38A`, `#D6B38A`, `#9FB4C7` and `#E0B0E8`.
- The initial is `#111315`. Check its contrast on every tone.

### Components

**Buttons**

- **Secondary:** 48 px tall, radius 14, Surface 2 fill, 1 px line border, Manrope 700 at 15 px.
- **Primary:** brass fill with `#1A1406` text.
- **Disabled:** 40% opacity.
- **Loading:** shows a spinner.
- **Icon buttons:** 44×44, radius 12. The icon is muted and turns to ink on hover.
- **Text buttons:** 40 px tall, muted, and turn to ink on hover.

**Room code chip.** 36 px tall, radius 10, 1 px line, Manrope 800 with 0.18em letter spacing.

**Seat plate (desktop)**

- 176×64, radius 22, Surface fill with a 1 px inner line and a soft shadow.
- A 40 px avatar.
- The name at 15/700, with an ellipsis if it's too long.
- A status line at 13/600, muted: "5 cards", "1 card", or "Reconnecting" in the danger color.
- The UNO! badge is brass, in the display font at 12 px.
- Offline plates are shown at 62% opacity.
- On a player's turn, a brass ring around their avatar empties as their time runs out.

**Your plate.** Your avatar inside a conic brass timer ring (the filled part is time left), your name with "(you)", and a line like "7 cards, 120 points".

**Timer bar.** 4 px tall, rounded, with a green-to-brass gradient that turns red below 20%.

**Color chip.** A 28 px pill with a dark translucent fill, a colored dot with a white ring, and the color's name.

**Sheets, modals, toasts and inputs.** Surface fill, 1 px line, radius 20–28, and a brass focus ring.

### Apply everywhere

- These screens use the new tokens and components:
  - the hub and the UNO landing page;
  - the lobby, room join and the profile sheet;
  - the round-over screen and toasts;
  - the page header of every game.
- The hub keeps its four tiles, restyled in the new materials.
- Every aria-label and test selector keeps working.

### Checklist

- Every screen looks right in both themes.
- A grep finds no old purple colors left.
- Contrast passes AA.
- The layout audit is clean.

**Commit:** `feat: card room design system in dark and light`

---

## Phase 14: Rebuild the UNO table

### Desktop table (1024 px and wider)

**The table**

- A rounded rectangular table fills the space between the top bar and your controls.
- The walnut rim has a corner radius of about 84 px at 1440 px wide, scaling with the screen. It has a soft outer shadow and a highlight along its top edge.
- The felt sits 24 px inside the rim.
- A dashed "stitch" line (2 px, white at 9%) runs 18 px inside the felt.
- The host picks the felt color in the lobby: green by default, or teal, burgundy or navy.

**Seats** sit on the table edge, with each plate half over the rim. Turn order runs clockwise from your left.

| Opponents | Where they sit |
| --- | --- |
| 1 | top center |
| 2 | top |
| 3–4 | along the top |
| 5 | 3 on top, 1 on the left, 1 on the right |
| 6–7 | 3 on top, 2 on the left, 2 on the right |

**Center of the felt**

- The draw pile: three stacked card backs, with "38 left" below and a brass outline when you're allowed to draw.
- The discard pile: the top card slightly rotated, with the two previous cards peeking out. The color chip sits under it.
- The direction of play: two faint arcs with arrowheads printed on the felt (white at 12%). They flip when play reverses.

**Below the table**, in this order:

1. One row with your plate, the status line (brass on your turn), the seconds left, and then Draw card, Pass and UNO!.
2. The 4 px timer bar.
3. Your hand.

**Your hand**

- Cards fan out with a small rotation (about 4° per card) and a slight downward curve.
- Cards you can play lift 12 px and get a white ring.
- The selected card lifts 30 px and gets a brass ring.
- Other cards are desaturated (saturate 0.35, brightness 0.72).
- The status line says what to do, e.g. "Your turn. Tap Blue Reverse again to play it."

### Tablet and phone

**Tablet.** The same table, smaller, with at most 2 opponents on each side.

**Phone**

- Opponents sit in a grid at the top, 3 per row. With more players, the grid scrolls sideways.
- The table sits below, with a 44 px rim radius and the felt 12 px inside it.
- The piles are 76 px wide.
- The controls:
  - a row with your avatar ring, the status (up to two lines) and the seconds left;
  - the timer bar;
  - the three buttons in a 3-column grid.
- Hand cards are 72 px wide.

**Short landscape.** The table on the left, and your hand and controls on the right.

### Cards

Keep the design original. Don't copy Mattel's card art.

**Shape.** Proportion 63:88 (height = width × 1.4), with a corner radius of 11% of the width.

**Face**

- A 160° gradient for each color, from light through base to dark.
- A thin inner frame 5.5% in from the edge: 1.5 px white at 62%, or 38% on wilds.
- A white rounded diamond in the center: 56% of the width, radius 13%, rotated 45°. It holds the symbol in the color's ink shade.

**Symbols**

- Numbers in Bricolage Grotesque 800 at 44% of the width. +2 and +4 are at 32%.
- Skip and Reverse are stroke icons at 36%.
- Wild has a dark body and a four-color diamond with a white ring.
- Wild Draw Four adds "+4" in white with a dark outline.

**Corners.** The symbol at 17% of the width, in the top-left corner and again in the bottom-right corner rotated 180°. A plain Wild shows a small four-color diamond.

**Back.** A charcoal body with a radial gradient, a brass inner frame, a brass ring, and a four-color diamond emblem.

**Colors**

| Color | Base | Light | Dark | Ink |
| --- | --- | --- | --- | --- |
| Red | `#E5484D` | `#F07A7D` | `#B3323A` | `#B02C35` |
| Yellow | `#F2B90C` | `#FFD24A` | `#C99000` | `#9E7200` |
| Green | `#2FA36B` | `#55C48C` | `#1E7A4E` | `#1B6E46` |
| Blue | `#2F7FE0` | `#5E9EF0` | `#1E5CAE` | `#1C56A3` |
| Wild body | `#202026` | `#3A3A44` | `#121216` | white |

### Motion

Dealing, playing and drawing still fly to and from the right places on the new table. A played card lands with a small bounce into its tilt.

### Checklist

- Test 2, 4 and 8 players on desktop, tablet, phone and landscape, in both themes.
- No overlaps; the layout audit proves this.
- Cards are readable at every size.
- The e2e tests pass.

**Commit:** `feat: uno table rebuilt as a card room`

---

## Phase 15: The other games in the new look

- **Spin the Bottle:** the same wood and lamp light, with a wooden floor and a rug. Players appear as the new seat plates, and the bottle is glass with a brass cap.
- **Name Wheel:** the wheel in the card colors on a wooden stand, with brass pegs and a brass pointer. The names panel becomes a Surface sheet.
- **Couples:** keeps its candlelit look, but uses the new components, buttons and header.

**Checklist:** every game works in both themes and every layout, and the layout audit is clean.

**Commit:** `feat: bottle, wheel and couples in the card room look`
