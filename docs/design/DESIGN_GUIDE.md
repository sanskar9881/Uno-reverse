# Party Night design guide ("card room")

This guide and the files it describes define exactly how every screen should look.

**Don't invent styles.** Use the kit's classes and components, and compare your screens with `docs/design/styleguide.html` until they match.

## What's in the kit

| File | What it is |
| --- | --- |
| `client/src/styles/cardroom/tokens.css` | Every color, shadow, font and layer as a CSS variable. Dark is the default; `<html data-theme="light">` switches to light. Felt colors use `data-felt`. |
| `client/src/styles/cardroom/base.css` | Page background (the "room"), text defaults, focus ring, reduced motion. |
| `client/src/styles/cardroom/components.css` | Buttons, inputs, chips, segmented controls, switches, sliders, avatars, seats, timers, top bar, sheets, toasts, lobby, results, hub tiles. |
| `client/src/styles/cardroom/cards.css` | The UNO card face and back, and their states: playable, selected, dim. |
| `client/src/styles/cardroom/table.css` | The table: wood, felt and stitching; piles, seats, controls, hand, and the phone layout. |
| `client/src/styles/cardroom/games.css` | Looks for Spin It (floor, rug, wheel, bottle), Couples (candlelit, tarot cards), Group (dare cards), and the hub tile art. |
| `client/src/styles/cardroom/index.css` | Imports all of the above. |
| `client/src/styles/cardroom/tailwind-theme.css` | Maps the tokens to Tailwind utilities (`bg-surface`, `text-ink`, `text-muted`, `border-line`, `bg-brass`, `text-on-brass`, `font-display`, and so on). |
| `client/src/components/cardroom/cardroom.tsx` | Presentational React pieces (listed below). |
| `docs/design/styleguide.html` | The visual reference. Open it in a browser and switch between the themes and the felt colors. |

The React pieces in `cardroom.tsx`:

- `PnMark`, `PnCardFace`, `PnCardBack`, `PnTable`, `PnDirection`
- `PnAvatar`, `PnAvatarRing`, `PnSeat`, `PnTimerBar`, `PnColorChip`, `PnCodeTiles`
- `PnBottle`, `PnTarot`, `PnDareCard`, `PnGameArt`
- The layout helpers `pnSeatSlots` and `pnFan`

## Install

1. **Fonts.** Run `npm --prefix client install @fontsource-variable/bricolage-grotesque @fontsource-variable/manrope @fontsource-variable/fraunces`.
2. **`client/src/main.tsx`.** Import `@fontsource-variable/bricolage-grotesque`, `@fontsource-variable/manrope` and `@fontsource-variable/fraunces`. Remove the old font imports (Bagel Fat One, Baloo 2).
3. **`client/src/index.css`.** Import the kit and the Tailwind bridge right after `@import "tailwindcss";`:
   ```css
   @import "tailwindcss";
   @import "./styles/cardroom/tailwind-theme.css";
   @import "./styles/cardroom/index.css";
   ```
4. **Remove the old theme:**
   - Delete the old `@theme` color and font tokens and the old background and card CSS from `index.css`.
   - Replace the old utility names across the code (for example `bg-night`, `text-muted`, `bg-card-yellow`) with the bridged utilities or the `pn-` classes.
   - Search every `.tsx` file for hex colors. None should be left, apart from the kit.
5. **Themes.** The theme toggle keeps setting `data-theme` on `<html>`. Update `<meta name="theme-color">` to `#0e0f12` in dark and `#f3eee5` in light.

## Rules

- Take colors, shadows, radii and fonts only from the tokens: `var(--pn-...)` or the bridged utilities.
- Buttons use `.pn-btn` plus a modifier:
  - `--primary`: at most one per screen.
  - `--ghost`, `--danger`
  - `--sm`, `--lg`, `--block`
  - `--round` for the UNO! button, plus `--call` when it can be pressed.
- Icon buttons use `.pn-icon-btn` (44×44) with an `aria-label`. Icons are inline stroke SVGs, never emoji.
- Players are shown with `PnAvatar`: their initial on a tone color. The saved avatar number, 0–11, picks the tone. Emoji avatars are gone.
- Text never overflows: `min-w-0` on flex children, ellipsis plus a `title` on names, and clamped font sizes. Touch targets are at least 44 px.
- Keep every aria-label and test selector the e2e tests use. If you must change one, update the tests.
- Toasts use `.pn-toasts`. On phones they sit above the action row (set `--pn-toast-offset` on game screens); on desktop they go top right.
- After each screen, screenshot it at 390×844, 768×1024, 1280×800 and 844×390, in both themes. Compare with `styleguide.html`, and run the layout audit if it exists.

---

## Screens

### App shell and top bar

`base.css` paints the room behind every page, so don't give pages their own background. The couples game is the exception: it wraps its pages in `.pn-theme-couples`.

**Desktop:**

```tsx
<header className="pn-topbar">
  <div className="pn-topbar__group">
    <a className="pn-brand" href="/"><PnMark />Party Night</a>
    <span className="pn-divider-v" />
    <button className="pn-code" aria-label={`Room code ${code}. Copy`}>{code}</button>
    <span className="pn-meta">Round {n}</span>
  </div>
  <div className="pn-topbar__group pn-topbar__group--tight">
    <button className="pn-text-btn">Scores</button>
    <button className="pn-icon-btn" aria-label="Switch theme">{moonOrSunIcon}</button>
    <button className="pn-icon-btn" aria-label="Mute sounds">{speakerIcon}</button>
    <button className="pn-text-btn">Leave</button>
  </div>
</header>
```

**Phone** (under 640 px): drop the brand and the divider. Scores and Leave become icon buttons (trophy and exit icons).

### Hub `/`

```tsx
<main className="pn-hub">
  <header className="pn-hub__hero">
    <h1 className="pn-hub__title">Party Night</h1>
    <p className="pn-hub__sub">Games for your group, on one phone or online.</p>
  </header>
  <div className="pn-hub__grid">
    <a className="pn-tile" href="/uno">
      <div className="pn-tile__art"><PnGameArt game="uno" /></div>
      <div className="pn-tile__body">
        <h3 className="pn-tile__title">UNO</h3>
        <p className="pn-tile__desc">The classic card game at a real table.</p>
        <span className="pn-chip pn-tile__badge">2 to 8 players, online</span>
      </div>
    </a>
    {/* Spin It (spin), Couples (couples), Truth and Dare Group (group) */}
  </div>
  <form className="pn-hub__join">
    <input className="pn-input pn-input--code" placeholder="CODE" aria-label="Room code" />
    <button className="pn-btn pn-btn--lg">Join</button>
  </form>
</main>
```

The grid is 1 column on phones, 2 on tablets and 4 on desktop; that's already in the CSS. The avatar button in the top bar opens the profile sheet.

### UNO landing `/uno` and room join

- A `.pn-page--narrow` page containing a `.pn-panel`.
- **Nickname:** `.pn-label`, `.pn-input` and `.pn-hint`. A taken name shows `.pn-hint--error` and puts `aria-invalid="true"` on the input.
- **Avatar:** a `.pn-tone-picker` with 12 `.pn-tone-option` radio buttons, each wrapping a `PnAvatar` with the player's initial.
- **Actions:** Create Game (`.pn-btn--primary .pn-btn--lg`) and Join Game (`.pn-btn--lg`) side by side. Join reveals `.pn-input--code`.
- **Connection state:** `.pn-banner` ("Waking up the game server…"), or `.pn-banner--error`.

### Lobby

- **Room code:** `<PnCodeTiles code={code} />`, with Copy code, Copy invite link and Share as `.pn-btn--sm` buttons.
- **Players:** a `.pn-players` grid of `.pn-player-slot` cells (`.is-you`, or `.is-empty` for an open seat). The host's kick button is a `.pn-icon-btn` inside `.pn-player-slot__kick`.
- **Settings:** each setting is a `.pn-label` over a `.pn-segmented .pn-segmented--block`: time per turn, match target, table felt (Green, Teal, Burgundy or Navy), and house rules. Guests see them disabled.
- **Start:** Start Game is `.pn-btn--primary .pn-btn--lg .pn-btn--block`.

### UNO table

The page is a `.pn-game` grid with four rows: top bar, stage, controls, hand. Set `--pn-toast-offset: 220px` on it on phones.

**Stage, desktop (1024 px and wider):**

- Measure the stage.
- Place `<PnTable felt={room.felt}>` with 36 px on top, 120 px on the sides (scale down on smaller desktops) and 16 px at the bottom.
- Compute the seats with `pnSeatSlots(opponents.length, tableBox)`.
- Render each seat as `<div className="pn-seat-slot" style={{ '--x': x+'px', '--y': y+'px' }}><PnSeat .../></div>`.

Inside the felt:

```tsx
<PnDirection reversed={direction === -1} />
<div className="pn-felt__center">
  <button className={`pn-draw pn-pile ${canDraw ? 'is-available' : ''}`} aria-label={`Draw a card, ${count} left`}>
    <span className="pn-pile__stack" style={{ '--pn-card-w': pileW + 'px' }}>
      <PnCardBack style={{ translate: '-4px 4px', filter: 'brightness(.78)' }} />
      <PnCardBack style={{ translate: '-2px 2px', filter: 'brightness(.88)' }} />
      <PnCardBack />
    </span>
    <span className="pn-pile__label">{count} left</span>
  </button>
  <div className="pn-pile">
    <div className="pn-pile__stack" style={{ '--pn-card-w': pileW + 'px' }}>
      {/* the previous 2 discards with small random tilts, then the top card */}
      <PnCardFace color={top.color} value={top.value} style={{ rotate: tilt + 'deg' }} />
    </div>
    <PnColorChip color={currentColor} />
  </div>
</div>
```

Pile card width is `clamp(78, viewportHeight × 0.13, 118)` on desktop and `clamp(62, viewportWidth × 0.2, 92)` on phones.

**Stage, tablet (640–1023 px):** use `size="tablet"`, with at most 2 opponents per side.

**Stage, phone (under 640 px):**

- A `.pn-opponents` row of `<PnSeat compact />` above the table.
- Below it, `<PnTable size="compact">` filling the stage with 12 px margins.

**Short landscape (height under 500 px):** the table on the left two-thirds, and the controls and hand stacked on the right.

**Seats:**

- `meta` is "5 cards", "1 card", or "Reconnecting" when offline.
- `uno` shows when they've called it.
- The current player gets `current` and `progress` (time left, 0–1).

**Controls:**

```tsx
<div className="pn-controls">
  <div className="pn-me">
    <PnAvatarRing progress={myTurn ? timeLeft : 1}><PnAvatar name={me.nickname} tone={me.avatar} size={44} /></PnAvatarRing>
    <span className="pn-me__text"><span className="pn-me__name">{me.nickname} (you)</span><span className="pn-me__meta">{n} cards, {score} points</span></span>
  </div>
  <p className={`pn-status ${myTurn ? 'is-my-turn' : ''}`} aria-live="polite">{status}</p>
  <span className={`pn-seconds ${low ? 'is-low' : ''}`}>{seconds}s</span>
  <div className="pn-controls__actions">
    <button className="pn-btn">Draw card</button>
    <button className="pn-btn">Pass</button>
    <button className={`pn-btn pn-btn--round ${canUno ? 'pn-btn--call' : ''}`} aria-label="Call UNO">UNO!</button>
  </div>
  <PnTimerBar progress={timeLeft} />  {/* give it className pn-controls__timer via a wrapper div */}
</div>
```

**Hand:**

- The container is `.pn-hand`, with height `topRoom + cardHeight + sag + 12`.
- Place each card as a `<button className="pn-hand__card">` using `pnFan(count, { containerWidth, cardWidth })`: left/top from x/y, `rotate` in degrees, and `zIndex` from z (40 for the selected card).
- Inside each button, render `<PnCardFace ... playable selected dim />`:
  - `playable` when it can be played on your turn, lifted 12 px;
  - `selected` for the picked card, lifted 30 px;
  - `dim` when it's your turn and the card can't be played.
- Hand card width is `clamp(70, viewportHeight × 0.12, 108)` on desktop and `clamp(56, (viewportWidth − 24) / 5.2, 86)` on phones.

**Modals:**

- **Color picker:** a `.pn-sheet` holding a `.pn-color-grid` of four `.pn-color-option` buttons (`data-color`), each with `<small>Press 1</small>` to `4`.
- **Leave confirm:** a `.pn-sheet` with Stay (`.pn-btn`) and Leave game (`.pn-btn--danger`).
- **Round over:** a `.pn-sheet` containing:
  - `.pn-result`: the winner's avatar inside `PnAvatarRing progress={1}`, the title, and a points line;
  - a `.pn-scoreboard` table;
  - `.pn-sheet__actions` with Next Round (primary) and Rematch.
  - Keep the confetti.

### Spin It `/spin`

- **Mode switch:** `.pn-segmented` (Wheel or Bottle) in the page header.
- **Names:** on desktop a `.pn-panel` beside the stage; on phones a sheet. Each name is a `.pn-name-row` inside `.pn-name-list`.
- **Wheel:**
  - `.pn-wheel`, then `.pn-wheel__rim`, then `.pn-wheel__face`. Draw the segments with SVG or a conic gradient in the card colors.
  - Place `.pn-wheel__bulb` dots around the rim; they alternate `is-off` while spinning.
  - Add `.pn-wheel__pointer`, `.pn-wheel__hub` (the wheel title) and `.pn-wheel__stand`.
- **Bottle:** a `.pn-floor` holding a `.pn-rug` (with `data-felt`), the players as avatars and name chips around the circle, and `<PnBottle />` in the center (rotate it to spin). The chosen player gets a brass ring.

### Couples `/couples`

- Wrap the page in `.pn-theme-couples`. It has its own candlelit tokens in dark, and blush and ivory in light.
- Lay out one screen with `.pn-couples-screen`: header, `.pn-level` (Sweet `.pn-range` Spicy), `.pn-card-stage` holding a `PnTarot`, then `.pn-card-actions` (Pass, Done as primary, Heart).
- The back of the deck is `<PnTarot back />`.
- Timed cards show `.pn-countdown` with `--pn-progress`, and the get-ready count inside `.pn-countdown__inner`.

### Truth and Dare Group `/group`

- Use the same one-screen layout as Couples, without the candlelit theme.
- The card is `<PnDareCard type="normal|spicy|revealing" kind="Truth|Dare" text=... foot="Harsh's turn" />`.
- The type toggles are `.pn-switch` rows, and the options (No-touch, Drinks) are `.pn-switch` too.

### Profile sheet

A `.pn-sheet` containing:

- the nickname field;
- the `.pn-tone-picker`;
- Theme as a `.pn-segmented` with System, Light and Dark;
- Sound as a `.pn-switch`;
- Save as `.pn-btn--primary .pn-btn--block`.
