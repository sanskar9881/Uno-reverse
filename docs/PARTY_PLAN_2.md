# Party Night build plan, part 2

This plan uses the same workflow as `docs/PARTY_PLAN.md`: one phase at a time, in order, following its "How to work" steps and guardrails.

Every phase in this file also needs two extra checks before you commit:

- Run the layout audit (added in Phase 7) and fix everything it reports.
- Check the phase in both the light and dark themes.

---

## Phase 7: Light and dark themes, and a layout for every screen size

### Themes

**Choices.** System (the default), Light and Dark. Put a sun/moon toggle in every page header and the same setting in the profile sheet (Phase 8). Save the choice in localStorage.

**No flash of the wrong theme.** A tiny inline script in `client/index.html` sets `data-theme` on `<html>` before the first paint. Also set `color-scheme` and update `<meta name="theme-color">` to match.

**Colors come only from tokens.** Every color is a token defined for both themes. Search the `.tsx` files for hard-coded hex values and replace them with tokens.

**Light versions of each game's look:**

| Screen | Light theme |
| --- | --- |
| Hub | warm ivory background with lighter surfaces |
| UNO | pale felt with a light wooden rim; the cards keep their colors |
| Name Wheel | daytime carnival on a cream background |
| Spin the Bottle | a daylight wooden floor |
| Couples | blush and ivory instead of candlelit wine |

**Contrast.** In both themes, text meets WCAG AA: 4.5:1 for body text, and 3:1 for large text and icons.

### Layouts

Each game gets a deliberate layout for each screen class, rather than a squeezed desktop layout:

| Layout | When |
| --- | --- |
| Phone | width under 640 px |
| Tablet | 640–1023 px |
| Desktop | 1024 px and wider |
| Short landscape | height under 500 px (a phone held sideways) |

**UNO**

- Desktop: seats around the oval table.
- Tablet: a smaller oval.
- Phone: the opponent strip, compact piles and the hand.
- Short landscape: the hand and actions move to the right side.

**Name Wheel**

- Desktop: the wheel with the names panel beside it.
- Phone: the wheel on top, with the names in a bottom sheet.

**Spin the Bottle**

- Desktop: the table with a side panel for players and settings.
- Phone: a full-screen table with controls at the bottom.

**Couples**

- Phone: everything fits on a single screen (see Phase 11).
- Desktop: the card in the center, with controls beside it.

**Hub and lobbies**

- One column on phones, two on tablets, three or four on desktop.

### Layout rules

**Screen height.**

- Use `100dvh` and safe-area insets.
- Game screens never scroll the page; only lists inside them scroll.

**Overlap.**

- Nothing overlaps unless it's meant to, like fanned cards, modals and toasts.
- Give each layer a named z-index token.

**Overflow.**

- Put `min-w-0` on flex children.
- Truncate names with an ellipsis, and put the full text in a tooltip and aria-label.
- Use `line-clamp` for long text.
- Use `text-wrap: balance` on headings.
- Size fonts fluidly with `clamp()`.

**Touch targets.** At least 44×44 px.

**Toasts.** They must never cover a button you need. On phones, show them bottom-center above the action bar; on desktop, top-right.

### Layout audit

Add `e2e/layout_audit.py` (Playwright), runnable with `npm run audit:layout`.

**What it visits.** Every route and main state, using the rigged e2e server where needed:

- The hub.
- UNO: the landing page, the lobby, the table mid-game, round over, and the color picker.
- Name Wheel: with 2 names, with 100 names, and the result.
- Spin the Bottle: setup and table, in both modes.
- Couples: the age gate, and a card with a timer.

**Viewports.** Each state at 320×568, 360×740, 390×844, 430×932, 768×1024, 1024×768, 1280×800, 1440×900, 1920×1080 and 844×390 (landscape), in both light and dark.

**What it checks.** Each failure is reported with a CSS path:

1. No horizontal scrolling.
2. No visible element sticks out of the viewport, except inside scroll containers.
3. No two text elements or controls overlap (their bounding boxes intersect). Elements marked `data-overlap-ok`, such as fanned cards, stacks and overlays, are skipped.
4. No clipped text: an element's `scrollWidth` or `scrollHeight` is larger than its box without an intended ellipsis or line clamp.

**Screenshots.** Save one for every combination to `e2e-screenshots/layout/`.

**Done when** the audit reports zero issues. Also look through a sample of the screenshots.

**Commit:** `feat: light and dark themes, responsive layouts, layout audit`

---

## Phase 8: Profiles and unique names

**Profile sheet.** The avatar button in the header opens a sheet for nickname, avatar, theme and sound. It's saved on the device and becomes the default name everywhere.

**Unique names in every group.** Compare names after trimming, normalizing and ignoring case. This is the same `normalizeNickname` rule the server already uses for UNO.

- **Online rooms (every game):** the server rejects a name that's taken and returns a free suggestion, such as "Riya 2". The join screen shows the error inline with a one-tap "Use Riya 2" button.
- **One-phone groups:** this covers Spin the Bottle players and Couples partner names. A name that's already in the group shows an inline message and isn't added.
- **Name Wheel:** entries may repeat, because people use repeats as extra chances. Show a small note when there are duplicates.

**Tests.**

- A server test for the suggested name.
- Client tests for the one-phone duplicate check.

**Commit:** `feat: profiles and unique names`

---

## Phase 9: Spin the Bottle, two ways to play

`/bottle` opens a choice screen with two large options:

1. **Play on this phone:** for a group sitting together. Enter the names (unique, as in Phase 8) and spin straight away. No room is needed, and it works offline.
2. **Play online:** "Create a room" or "Join with a code". Creating a room opens the lobby with the code and invite link; joining uses the code.

**One table.** Both options open the same table component, so they look and feel identical. The online version also shows the room code in the header.

**Quick restart.** Remember the last choice and group, so "Play again" takes one tap.

**Take it online.** A one-phone game has a "Take it online" button. It creates a room with the same settings, and the players join from their own phones.

**Checklist.**

- Both paths reach a spinning table within two taps from the hub.
- Both work in both themes and in every layout.

**Commit:** `feat: spin the bottle on one phone or online`

---

## Phase 10: UNO by the official rules, with house rules as options

Implement the classic rules from Mattel's official instructions, and check each point against the official rules as you go. The defaults follow the official game. House rules are off by default.

### Official rules

**Deck.** The classic 108 cards, as now.

**Start card.** Flip the top card to start the discard pile and apply its effect:

| Start card | What happens |
| --- | --- |
| Number | Play starts normally. |
| Skip | The first player is skipped. |
| Reverse | The "dealer" (the seat before the starting seat) plays first, and play goes the other way. |
| Draw Two | The first player draws two and is skipped. |
| Wild | The first player picks the color, then plays. |
| Wild Draw Four | Put it back, reshuffle, and flip another card. |

**Wild Draw Four: bluffing and challenges.**

- Wild Draw Four can be played at any time, so bluffing is allowed. It's only legal when you hold no card of the current color.
- The next player sees two buttons, "Accept (draw 4)" and "Challenge", with a timer. If the timer runs out, they accept.
- The outcomes:
  - **Accept:** draw 4 and lose the turn.
  - **Challenge, and the play was illegal:** the player who played it draws 4. The challenger draws nothing and takes their turn.
  - **Challenge, and the play was legal:** the challenger draws 6 (4 plus 2) and loses their turn.
- The chosen color stays either way.
- After any challenge, only the challenger sees the challenged player's hand, for a few seconds, as in the physical game.
- This is the only exception to hand privacy. Add it to `CLAUDE.md`.

**UNO call.** You call UNO as you play your second-to-last card; the current calling window already allows this. If another player catches you before the next player starts their turn, you draw 2.

**Drawing.** If you can't play, or don't want to, draw one card. You may play it if it's playable; otherwise the turn passes. This is the current behavior.

**Scoring.** Official points, as now. The match target defaults to **500**.

**Two players.** Reverse acts like Skip, and Skip and Draw Two let you play again. This is the current behavior.

### House rules

The host toggles these in the lobby. All are off by default.

- **Stacking:** a Draw Two can be answered with a Draw Two, and a Wild Draw Four with a Wild Draw Four. The total passes along until someone can't stack, and that player draws it all.
- **Draw until you can play.**
- **Must play a drawn card** if it's playable.
- **7-0:** playing a 7 swaps hands with a player you choose. Playing a 0 passes every hand one seat in the direction of play.
- **Jump-in:** play an identical card (same color and same number) out of turn.
- **Modern 112-card deck:**
  - It adds one Wild Shuffle Hands card. Playing it collects all hands, shuffles them, and deals them back evenly, starting with the player on the left. The player who played it then picks a color.
  - It adds three Wild Customizable cards. They act as Wilds, and the host can write a rule that's shown when one is played.
  - Use the official point values for these cards.

Show the active house rules as chips in the table header and in the lobby.

### Card design

Keep the cards original. Don't copy Mattel's card art, logo or layout. Make them feel like a real printed deck:

- Real card proportions (the 63×88 mm ratio), rounded corners, a thin white edge, and a subtle paper texture with gloss.
- Big, bold, easy-to-read center symbols. Corner indices in both corners that stay readable at the smallest sizes.
- Clear, distinct icons for Skip, Reverse and Draw Two, and distinctive faces for Wild and Wild Draw Four.
- An original emblem and pattern on the card back.
- Tuned for both themes and every card size: the hand, the piles and the opponent fan.

### Tests

- **Engine tests** covering:
  - every start-card case;
  - the challenge: legal, illegal and timeout;
  - stacking, draw until playable, must play, 7-0 and jump-in;
  - Wild Shuffle Hands, and scoring with the modern deck.
- **Multiplayer tests** for the challenge flow, plus a random bot game with every house rule on.
- **Existing tests:** keep them passing. Only change the ones that assumed the old start-card re-flip or the strict Wild Draw Four, where the official rule changes the behavior. List the tests you changed.
- **E2E:** update the browser tests that play Wild Draw Four so the next player accepts it.

**Commit:** `feat: official uno rules, house rules and new card design`

---

## Phase 11: Couples, with a one-screen layout, timers and a bigger deck

### One screen on every device

- The card sits in the upper-middle of the screen. Truth/Dare, Done, Pass and Heart sit right below it.
- Nothing needs scrolling on any device from 320×568 up. The layout audit must prove this.
- The level control becomes a compact slider (Sweet → Flirty → Spicy) in the header. The lower-of-two consent rule stays as it is.
- Settings and custom cards open in a sheet rather than on the main screen.

### Timers

**Timed cards.** A card can carry a duration: 30 seconds, or 1, 2, 3, 5, 7 or 10 minutes. It shows a "Start" button instead of starting on its own.

**Start** runs a get-ready countdown, then the timer:

- **Countdown:** a big 3-2-1, lasting 3, 5 or 10 seconds as chosen in settings.
- **Timer:** a large ring, pause and resume, a "+1 min" button, and a sound plus vibration when time's up.

**Screen stays awake.** Use the Wake Lock API, where supported, while a timer runs.

### Names in cards

At the start, both partners enter their names (unique, as in Phase 8). Cards use placeholders such as `{partner}`, which show the partner's name.

### A bigger built-in deck

**Size and categories.** Add 150 more cards across the levels, with new categories: Kiss, Massage, Tease, Date night (real-life plans) and Truth talk.

**Tone.** Keep the built-in decks non-explicit. Spicy is sensual and suggestive, and never describes sex acts, positions or nudity.

**Ideas to include:**

- Kiss {partner}'s navel.
- Kiss their feet.
- A playful lick on the nose.
- A one-minute smooch.
- Take a shower together.
- Sit on {partner}'s lap and kiss them slowly.
- Plan a kiss on the beach for your next trip.
- Surprise {partner} with a gift this week, like a watch.
- A slow dance to one song.
- Feed {partner} a dessert while they're blindfolded.

### Our deck: private custom cards

**Writing cards.** The couple writes their own cards. Each has text, a level, a kind (truth or dare), an optional duration and an optional photo from the phone.

**Bulk import.** Paste a list, one card per line:

- A duration in brackets, such as "(3 min)", is detected automatically.
- A level prefix such as "spicy:" sets the level.

**Backup.** Export and import the deck as a JSON file, for backups or moving to a new phone.

**Privacy.**

- Custom cards and photos stay on the device, in IndexedDB. They're never sent to the server and aren't stored in the PWA cache.
- In online mode, only the text of custom cards is shared, and only for the lifetime of that room.
- Photos never leave the device.

**Deck choice.** A toggle to play "Built-in only", "Our deck only" or "Mix".

### Tests

- **Client:** bulk-import parsing (durations, level prefixes and empty lines) and placeholder replacement.
- **Server:** custom card text is never logged and disappears when the room closes.

**Commit:** `feat: couples one-screen layout, timers, names and our deck`
