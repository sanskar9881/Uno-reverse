import type { CouplesLevel, IntimacyCategory } from '../../types';
import { COMFORT_LEVEL_RANK, COMFORT_LEVELS, drawFromPool, lowerLevel, timerSecondsFor, type PoolEntry } from '../common';

export type { CouplesLevel, IntimacyCategory };
export { drawFromPool, lowerLevel, timerSecondsFor, type PoolEntry };

export const INTIMACY_LEVELS = COMFORT_LEVELS;
export const INTIMACY_LEVEL_RANK = COMFORT_LEVEL_RANK;

export const INTIMACY_CATEGORIES = ['kiss', 'touch', 'flirtyTalk', 'mood', 'romance'] as const satisfies readonly IntimacyCategory[];

export const INTIMACY_CATEGORY_LABEL: Record<IntimacyCategory, string> = {
  kiss: 'Kiss',
  touch: 'Touch and massage',
  flirtyTalk: 'Flirty talk',
  mood: 'Mood and setting',
  romance: 'Romance and dates',
};

const KISS_SWEET = [
  'Give me a gentle kiss on the forehead.',
  'Give me a soft kiss on the cheek.',
  'Kiss the back of my hand like an old movie.',
  'Give me a quick kiss and tell me what it tasted like.',
  'Give me a kiss and hold my face while you do it.',
  'Give me three tiny kisses in a row, anywhere you like.',
  'Give me a kiss goodnight, even though it is not bedtime.',
  'Give me a kiss and then a warm hug for five seconds.',
  'Give me a kiss on the nose.',
  'Give me a kiss and whisper something kind right after.',
];

const KISS_FLIRTY = [
  'Give me a slow kiss on the neck.',
  'Give me a kiss that lasts for 5 seconds.',
  'Kiss me like we just reunited after a long trip.',
  'Give me a kiss and bite your lip right after.',
  'Give me a kiss on the collarbone.',
  'Give me a kiss with your hand on my jaw.',
  'Give me a lingering kiss on the corner of my mouth.',
  'Give me a kiss and a wink to go with it.',
  'Give me a kiss like it is our first date all over again.',
  'Give me a kiss that starts soft and gets a little bolder.',
];

const KISS_SPICY = [
  'Give me a slow, deep kiss for 10 seconds.',
  'Kiss me somewhere I have not been kissed tonight.',
  'Give me a kiss that starts at my ear and ends at my lips.',
  'Give me a hungry kiss for 8 seconds.',
  'Give me a kiss with your hands in my hair.',
  'Give me a slow kiss down my neck for 15 seconds.',
  'Give me a kiss that makes me forget what we were talking about.',
  'Give me a breathless kiss for 10 seconds.',
  'Give me a kiss and pull away slower than usual.',
  'Give me a kiss that trails from my jaw to my collarbone.',
];

const TOUCH_SWEET = [
  'Give me a hand massage for 30 seconds.',
  'Hold my hand and trace slow circles on my palm for 20 seconds.',
  'Give me a gentle shoulder squeeze for 20 seconds.',
  'Give me a warm hug for 30 seconds, no talking.',
  'Give me a light head scratch for 20 seconds.',
  'Rest your hand on my back and just breathe with me for 20 seconds.',
  'Give me a slow foot rub for 30 seconds.',
  'Trace a heart on my back and have me guess it.',
  'Give me a gentle arm rub for 20 seconds.',
  'Hold both my hands and just look at me for 15 seconds.',
];

const TOUCH_FLIRTY = [
  'Give me a neck and shoulder massage for a minute.',
  'Trace your fingers slowly down my arm for 20 seconds.',
  'Give me a slow back rub for a minute.',
  'Run your fingers through my hair for 30 seconds.',
  'Give me a lingering hand-hold and trace my fingers one by one.',
  'Give me a scalp massage for 30 seconds.',
  'Trace a slow line from my shoulder to my wrist.',
  'Give me a warm, close hug and sway for 20 seconds.',
  'Give me a feet-to-calves massage for a minute.',
  'Trace your fingers along my collarbone for 15 seconds.',
];

const TOUCH_SPICY = [
  'Give me a slow massage on my lower back for a minute.',
  'Trace your fingers slowly down my spine for 30 seconds.',
  'Give me a two-minute massage anywhere I ask.',
  'Trace your fingers along my inner arm for 20 seconds.',
  'Give me a slow massage on my chest and shoulders for a minute.',
  'Trace a slow path with your fingertips from my ear to my hip.',
  'Give me a massage that moves a little lower with each stroke for a minute.',
  'Trace your fingers along my thigh for 20 seconds.',
  'Give me a massage focused entirely on my hips for a minute.',
  'Trace slow circles on my stomach for 20 seconds.',
];

const TALK_SWEET = [
  'Tell me one thing you find attractive about me that is not physical.',
  'Tell me the moment you knew you wanted to be with me.',
  "Whisper something you're grateful for about us.",
  'Tell me your favorite compliment anyone has given you about me.',
  'Tell me what you love about my laugh.',
  'Whisper one thing you are looking forward to with me.',
  'Tell me a nickname you secretly want to call me.',
  'Tell me what you thought the first time you saw me smile.',
  'Whisper one small thing that made you fall for me.',
  'Tell me what home feels like when I am there.',
];

const TALK_FLIRTY = [
  'Whisper what you find most attractive about me right now.',
  'Tell me, in a low voice, what you noticed about me tonight.',
  'Whisper a compliment about my body, softly.',
  'Tell me the boldest thought you have had about me this week.',
  'Whisper what you would do if we were alone right now.',
  'Tell me what outfit of mine you cannot stop thinking about.',
  'Whisper my name like you mean it.',
  'Tell me what you find most charming about the way I flirt.',
  'Whisper the first thing you want to do when we get some privacy.',
  'Tell me what you think about right before you fall asleep.',
];

const TALK_SPICY = [
  'Whisper exactly what you want to do to me next.',
  'Tell me a fantasy you have had about us.',
  'Whisper what you love most about our chemistry.',
  'Tell me the most daring thing you have thought about doing with me.',
  'Whisper what you plan to do once this game ends.',
  'Tell me what you crave most when we are finally alone.',
  'Whisper a way you would want to surprise me tonight.',
  'Tell me what turns you on the most about how I touch you.',
  'Whisper the first thing you would do if we had the whole night alone.',
  'Tell me what you think about when you miss me physically.',
];

const MOOD_SWEET = [
  'Light a candle or dim the lights for the rest of the round.',
  'Put on one song that reminds you of us.',
  'Grab a blanket and get close for the next card.',
  'Turn your phone face down until this game ends.',
  'Fluff a pillow and get comfortable together.',
  'Pick a scent, a candle, tea, anything, and set it up for the mood.',
  'Turn the lights low and stay close for the rest of the round.',
  'Put your phones in another room until this game ends.',
  'Choose a playlist for the rest of tonight.',
  'Sit closer than you currently are for the rest of this round.',
];

const MOOD_FLIRTY = [
  'Dim the lights and sit close for the rest of the round.',
  'Light two candles and put them between you.',
  'Put on slow music and stay close while it plays.',
  'Turn off the overhead lights for the rest of this round.',
  'Set up a cozy spot on the floor or bed for the next few cards.',
  'Pick a drink for each other, even just water, and toast to tonight.',
  'Dim the room and light one candle just for this round.',
  'Turn on music that sets a slower, closer mood.',
  'Move to a quieter room for the rest of the round.',
  'Set your phones aside and light a candle for the rest of tonight.',
];

const MOOD_SPICY = [
  'Turn off every light except one candle for the rest of the round.',
  'Set the mood however you like for the next three cards, no rules.',
  'Pick the lighting and the music for the rest of tonight.',
  'Move somewhere more private for the rest of this round.',
  'Light candles around the room for the rest of tonight.',
  'Choose the setting for what happens after this game.',
  'Turn the lights all the way down and stay close for the rest of the round.',
  'Set a slow playlist and let it run for the rest of tonight.',
  'Pick the room you want to finish this game in.',
  'Dim everything and describe the mood you are setting.',
];

const ROMANCE_SWEET = [
  'Plan a future date together, out loud, right now.',
  'Tell me a place you want to take me someday.',
  'Describe our dream weekend together.',
  'Tell me what you would order for me on our next date.',
  'Plan our next date night together, right now.',
  'Tell me a tradition you want us to start.',
  'Describe the perfect lazy Sunday with me.',
  'Tell me one place we have not been that you want to go together.',
  'Plan a surprise you would love to give me someday.',
  'Tell me what our next anniversary should look like.',
];

const ROMANCE_FLIRTY = [
  'Plan a date night that ends with just the two of us, alone.',
  'Tell me what you would wear on a date designed to impress me.',
  'Describe the date that would make me fall for you all over again.',
  'Tell me what you would whisper to me at the end of a perfect date.',
  'Plan a weekend getaway just for the two of us.',
  'Tell me the most romantic thing you want to try with me.',
  'Describe how you would want tonight to end.',
  'Tell me what you would plan for a night in, just us.',
  'Plan the date that leads straight back here.',
  'Tell me what you would do first if we had a whole weekend alone.',
];

const ROMANCE_SPICY = [
  'Plan the perfect night in that ends with just the two of us.',
  'Tell me exactly how you would want tonight to end.',
  'Describe the weekend getaway you would plan to be alone with me.',
  'Tell me what you would want waiting for you when you got home to me.',
  'Plan a whole evening built around being alone together.',
  'Tell me the most romantic thing you want us to try next.',
  'Describe how you would set up a night meant only for us.',
  'Tell me what you would want the moment the door closes behind us.',
  'Plan the date that skips dinner and goes straight to dessert.',
  'Tell me what you are hoping happens after this game ends.',
];

export const INTIMACY_DECKS: Record<CouplesLevel, Record<IntimacyCategory, string[]>> = {
  sweet: { kiss: KISS_SWEET, touch: TOUCH_SWEET, flirtyTalk: TALK_SWEET, mood: MOOD_SWEET, romance: ROMANCE_SWEET },
  flirty: { kiss: KISS_FLIRTY, touch: TOUCH_FLIRTY, flirtyTalk: TALK_FLIRTY, mood: MOOD_FLIRTY, romance: ROMANCE_FLIRTY },
  spicy: { kiss: KISS_SPICY, touch: TOUCH_SPICY, flirtyTalk: TALK_SPICY, mood: MOOD_SPICY, romance: ROMANCE_SPICY },
};

export function intimacyPool(level: CouplesLevel, category: IntimacyCategory): readonly string[] {
  return INTIMACY_DECKS[level][category];
}

/** Total number of built-in cards across every level and category. */
export function intimacyDeckSize(): number {
  let total = 0;
  for (const level of INTIMACY_LEVELS) for (const category of INTIMACY_CATEGORIES) total += intimacyPool(level, category).length;
  return total;
}
