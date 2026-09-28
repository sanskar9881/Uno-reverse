# Sound files

The game ships with synthesized sounds (Web Audio), so it works with zero assets.

To use real audio instead, drop files in this folder and register them in
`src/game/sounds.ts` → `SOUND_FILES`, for example:

```ts
export const SOUND_FILES: Partial<Record<SoundName, string>> = {
  play: '/sounds/play.mp3',
  victory: '/sounds/victory.mp3',
};
```

Available sound names: `play`, `draw`, `uno`, `turn`, `yourTurn`, `join`, `leave`,
`victory`, `catch`, `error`, `click`. Any sound without a file keeps using the synth.
Keep files short (under ~1 s, except `victory`) and small (mp3/ogg, < 50 KB).
