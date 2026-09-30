import type { CouplesKind, GroupCardType } from '../../types';
import { drawFromPool, timerSecondsFor, type PoolEntry } from '../common';

export type { CouplesKind, GroupCardType };
export { drawFromPool, timerSecondsFor, type PoolEntry };

export const GROUP_CARD_TYPES = ['normal', 'spicy', 'revealing'] as const satisfies readonly GroupCardType[];

export const GROUP_CARD_TYPE_LABEL: Record<GroupCardType, string> = {
  normal: 'Normal',
  spicy: 'Spicy (18+)',
  revealing: 'Revealing',
};

export const GROUP_CARD_TYPE_HINT: Record<GroupCardType, string> = {
  normal: 'Fun and safe for anyone.',
  spicy: 'Flirty and bold, 18+ only.',
  revealing: 'Secrets, confessions and phone reveals.',
};

interface RawDare {
  text: string;
  /** Involves touching another player. Hidden entirely when No-touch mode is on. */
  touch?: boolean;
  /** Involves a drink. Hidden entirely when Drinks is off (the default). */
  drink?: boolean;
}

const NORMAL_TRUTHS = [
  "What's the most useless talent you have?",
  'What was your most embarrassing haircut?',
  "What's a food combination you love that grosses other people out?",
  "What's the weirdest thing you've ever eaten?",
  "What's your most-used emoji, and why that one?",
  "What's a movie everyone loves that you secretly think is bad?",
  "What's the last lie you told, and was it a good one?",
  "What's a habit you have that you know is a little annoying?",
  "What's the most childish thing you still do?",
  "What's your go-to karaoke song?",
  "What's the worst gift you've ever received?",
  "What's a rumor about yourself you wish were true?",
  "What's your most irrational fear?",
  "What's the last thing you searched on your phone?",
  "What's a nickname you had growing up that you hated?",
  "What's the pettiest thing you've ever argued about?",
  "What's a trend you were embarrassingly late to?",
  "What's the last show you binge-watched in one sitting?",
  "What's your worst subject in school?",
  "What's a food you refuse to share?",
  "What's the most trouble you got into as a kid?",
  "What's your go-to excuse to leave a party early?",
  "What's a chore you secretly enjoy?",
  "What's the weirdest dream you remember having?",
  "What's your comfort show you've rewatched the most?",
  "What's the last thing you Googled about yourself?",
  "What's a skill you wish you'd learned as a kid?",
  "What's your most-used phrase or catchphrase?",
  "What's a food you pretend to like but don't?",
  "What's the silliest thing that's ever made you cry?",
  "What's your go-to dance move?",
  "What's a app you spend way too much time on?",
  "What's the last thing you bought that you regret?",
  "What's your most embarrassing autocorrect fail?",
  "What's a smell that instantly takes you back to childhood?",
  "What's the weirdest compliment you've ever received?",
  "What's your go-to order at a fast food place?",
  "What's a song you know every word to but never admit it?",
  "What's the last thing that made you laugh way too hard?",
  "What's a household task you're surprisingly bad at?",
] satisfies string[];

const NORMAL_DARES: RawDare[] = [
  { text: 'Dance the hook step of an item song for 30 seconds.' },
  { text: 'Do your best impression of someone else in the group.' },
  { text: 'Talk in an accent of the group\'s choosing until your next turn.' },
  { text: 'Let the group pick an emoji for you to use as your reaction to everything for 5 minutes.' },
  { text: 'Do 10 jumping jacks right now.' },
  { text: 'Sing your next sentence instead of saying it.' },
  { text: 'Let {left} draw a tiny doodle on your hand.' },
  { text: 'Do your best runway walk across the room.' },
  { text: 'Speak only in questions until your next turn.' },
  { text: 'Do an impression of a news anchor reporting on this game.' },
  { text: "Let the group choose your profile picture for the next hour (with your OK)." },
  { text: 'Hold a plank for 20 seconds.' },
  { text: 'Do your best animal impression, and make the group guess it.' },
  { text: 'Freestyle rap about the room for 15 seconds.' },
  { text: 'Attempt to lick your elbow.' },
  { text: 'Do a dramatic slow-motion walk to the nearest door and back.' },
  { text: 'Balance a spoon on your nose for 15 seconds.' },
  { text: 'Do your best superhero pose and hold it for 10 seconds.' },
  { text: 'Let {right} pick your next line of dialogue, in character.' },
  { text: 'Do the chicken dance for 20 seconds.' },
  { text: 'Try to say the alphabet backwards.' },
  { text: 'Do 10 squats while narrating like a sports commentator.' },
  { text: 'Act out your job (or school) in charades for the group to guess.' },
  { text: 'Do your best red carpet pose for an imaginary camera.' },
  { text: 'Speak in a whisper until your next turn.' },
  { text: 'Do an over-the-top movie villain laugh.' },
  { text: 'Try to juggle two random objects for 10 seconds.' },
  { text: 'Do your best impression of a game show host introducing this game.' },
  { text: 'Take a shot or down a glass of water, your choice.', drink: true },
  { text: 'Pour yourself a drink and toast the group in a funny voice.', drink: true },
  { text: 'Take a sip of your drink without using your hands.', drink: true },
  { text: 'Let the group pick your drink for the next round (non-alcoholic option always allowed).', drink: true },
  { text: 'Give {left} a genuine compliment, out loud, right now.' },
  { text: 'Give {right} a high five and a nickname on the spot.' },
  { text: "Trade seats with {left} for the rest of the round." },
  { text: 'Let {right} style your hair for 15 seconds, if they agree.', touch: true },
  { text: "Hold hands with {left} for the next 30 seconds, if they agree.", touch: true },
  { text: "Give {right} a high-five combo you make up on the spot.", touch: true },
  { text: 'Do a pinky-promise with {left} about something silly.', touch: true },
  { text: 'Pole dance with a broom for 20 seconds.' },
  { text: 'Make a silly face at {left} and have them guess your mood.' },
  { text: 'Do a dramatic 20-second read of a cheesy love letter to {right}.' },
  { text: 'Let {left} pick a song and you have to hum it for 15 seconds.' },
  { text: 'Give the group a 10-second stand-up set about your own day.' },
  { text: 'Pretend to be {right} for 20 seconds and explain your best life advice.' },
];

const SPICY_TRUTHS = [
  "What's the first thing you noticed about someone in this room?",
  "Who here would you want to be stuck in an elevator with?",
  "What's the boldest pickup line you've ever used or heard?",
  "What's a compliment you've wanted to give someone here but haven't?",
  "Who in this room has the best smile?",
  "What's your idea of the perfect first date?",
  "What's the most attractive quality someone can have?",
  "Have you ever had a crush on someone in this room? (You don't have to say who.)",
  "What's a flirty text you'd be too nervous to send?",
  "What's the most confident you've ever felt walking into a room?",
  "What's your go-to flirting move?",
  "Who here do you think has the best dance moves?",
  "What's the boldest thing you've ever said to impress someone?",
  "What's a song that always puts you in a romantic mood?",
  "What's your idea of a perfect slow dance?",
  "What's the most romantic thing anyone's ever done for you?",
  "What's your favorite compliment to receive?",
  "Who here would you trust to plan your dream date?",
  "What's a movie kiss you wish happened to you?",
  "What's the most nervous you've ever been before a date?",
  "What's your type, described without naming anyone?",
  "What's the boldest outfit you've ever worn to impress someone?",
  "Have you ever sent a text and immediately regretted how forward it was?",
  "What's your favorite way to be flirted with?",
  "Who here do you think gives the best hugs?",
  "What's the most charming thing a stranger has ever done?",
  "What's a compliment about your looks you've never told anyone you loved hearing?",
  "What's your idea of a perfect slow-burn romance?",
  "What's the boldest thing you'd do to get someone's attention?",
  "What's a flirty nickname you've been called that you secretly liked?",
  "Who here has the most magnetic energy tonight?",
  "What's the most attractive thing someone can wear?",
  "What's your favorite spot to be kissed?",
  "What's a slow dance you'll never forget?",
  "What's the boldest DM you've ever sent?",
  "Who here would you want to slow dance with right now?",
  "What's the last thing that made your heart race?",
  "What's your favorite compliment about your personality?",
  "What's the most flirtatious thing you've ever done in public?",
  "What's your idea of the perfect romantic evening?",
] satisfies string[];

const SPICY_DARES: RawDare[] = [
  { text: 'Kiss {left} on the cheek, if they agree.', touch: true },
  { text: 'Give {right} your best wink and a flirty line.' },
  { text: "Sit on {left}'s lap for one round, if they agree.", touch: true },
  { text: 'Whisper the smoothest line you can think of to {right}.' },
  { text: "Give {left} a dramatic filmy slap in the air with no contact, then kiss their hand, if they agree.", touch: true },
  { text: 'Do a slow, sultry dance for 15 seconds, just for the group.' },
  { text: 'Give {right} a lingering compliment while holding eye contact for 10 seconds.' },
  { text: 'Let {left} pick a flirty nickname for you for the rest of the game.' },
  { text: 'Give the group your best smoldering movie-poster pose.' },
  { text: 'Slow dance with {right} for 15 seconds, if they agree.', touch: true },
  { text: 'Whisper a compliment in {left}\'s ear, if they agree.', touch: true },
  { text: 'Give {right} a playful wink every time they speak for the next minute.' },
  { text: 'Do your best "walk in slow motion toward the camera" moment.' },
  { text: 'Let {left} choose your flirtiest photo pose, right now.' },
  { text: 'Give {right} a hand kiss goodbye, if they agree.', touch: true },
  { text: 'Give the group your most dramatic love-song lip sync for 15 seconds.' },
  { text: 'Tell {left} the nicest thing about their smile.' },
  { text: 'Give {right} a slow, playful once-over and describe what you notice, kindly.' },
  { text: 'Take a shot or a sip of your drink and blow a kiss to the group.', drink: true },
  { text: 'Let {left} hold your hand for the next round, if they agree.', touch: true },
  { text: 'Do a dramatic romance-novel-cover pose with {right}, if they agree.', touch: true },
  { text: 'Give the group your best "love at first sight" reaction face.' },
  { text: 'Whisper your celebrity crush to {left} only.' },
  { text: 'Give {right} a slow clap and a wink for their last answer.' },
  { text: 'Tell {left} one thing you find charming about them.' },
  { text: 'Give the group your best slow-motion hair flip.' },
  { text: 'Give {right} a playful dance-off challenge, right now.' },
  { text: 'Pole dance with a broom for 20 seconds, flirty style.' },
  { text: 'Let {left} pick your pose for an imaginary magazine cover.' },
  { text: 'Give {right} a lingering hand-hold for 20 seconds, if they agree.', touch: true },
  { text: 'Whisper your best compliment to {left}, then wink.' },
  { text: 'Give the group a dramatic slow reveal of your "best angle."' },
  { text: 'Take a sip of your drink while holding eye contact with {right}.', drink: true },
  { text: 'Let {left} give you a flirty new nickname for the night.' },
  { text: 'Give {right} your best "across a crowded room" look for 5 seconds.' },
  { text: 'Do a slow twirl and strike a pose for the group.' },
  { text: 'Give {left} a playful head-on-shoulder moment for 10 seconds, if they agree.', touch: true },
  { text: 'Tell the group your smoothest opening line, performed live.' },
  { text: 'Give {right} a dramatic "hand over heart" compliment.' },
  { text: 'Give the group your best slow-motion catwalk toward the snacks.' },
];

const REVEALING_TRUTHS = [
  "What's a secret talent nobody here knows about?",
  "What's the most embarrassing thing in your search history?",
  "What's a lie you told your parents that you got away with?",
  "What's the last thing you deleted from your phone before someone could see it?",
  "What's a secret you've kept from your closest friend?",
  "What's the most embarrassing thing you've ever posted online?",
  "What's a confession you've never said out loud?",
  "What's the weirdest thing you've Googled about a person in this room?",
  "What's a white lie you tell often?",
  "What's the most embarrassing voicemail you've ever left?",
  "What's a secret nickname someone calls you that you haven't told anyone here?",
  "What's the last thing you screenshotted and why?",
  "What's a rumor you started that got out of hand?",
  "What's the most embarrassing thing your search suggestions reveal?",
  "What's a secret you've kept from this exact group?",
  "What's the last text you almost sent to the wrong person?",
  "What's a confession about your childhood you've never shared?",
  "What's the most awkward thing you've ever said to a crush?",
  "What's a habit you hide from everyone except close friends?",
  "What's the truth behind your most-liked photo?",
  "What's a secret playlist you have that nobody's heard?",
  "What's the most embarrassing thing you've done for attention?",
  "What's a confession about a time you were jealous of someone here?",
  "What's the weirdest DM you've ever received?",
  "What's a secret about your love life you've never told this group?",
  "What's the most embarrassing thing you've said in your sleep, that you know of?",
  "What's a confession about a competitive streak you hide?",
  "What's the last thing you lied about to look cooler?",
  "What's a secret fear about how others see you?",
  "What's the most embarrassing autocorrect you've ever sent?",
  "What's a confession about something you regret not saying to someone here?",
  "What's the weirdest thing you've done when you thought no one was watching?",
  "What's a secret about your browser history you'd never show anyone?",
  "What's the most embarrassing thing a family member has revealed about you?",
  "What's a confession about a time you pretended to like a gift?",
  "What's the truth about the last time you cried and didn't tell anyone why?",
  "What's a secret talent you're too shy to show off?",
  "What's the most embarrassing thing you've overheard about yourself?",
  "What's a confession about something you're secretly proud of?",
  "What's the last thing you Googled that you'd be mortified to explain?",
] satisfies string[];

const REVEALING_DARES: RawDare[] = [
  { text: 'Open your screenshots and show the group the latest one.' },
  { text: 'Read your last sent message out loud.' },
  { text: 'Show the group your camera roll from exactly one year ago today.' },
  { text: 'Read the last text you received out loud (skip anything private if you need to).' },
  { text: "Show the group your phone's home screen wallpaper." },
  { text: 'Read your most recent search out loud.' },
  { text: 'Show the group your most-used app by screen time.' },
  { text: 'Play the last song you listened to for 10 seconds.' },
  { text: 'Show the group the last photo you took, whatever it is.' },
  { text: 'Read the last note saved in your notes app out loud.' },
  { text: 'Show the group your lock screen background.' },
  { text: 'Read your last voice memo out loud, if you have one.' },
  { text: 'Show the group how many unread messages you have right now.' },
  { text: 'Read the oldest text still saved in your phone.' },
  { text: 'Show the group your last five emoji reactions sent.' },
  { text: 'Read your last email subject line out loud.' },
  { text: 'Show the group a photo from your camera roll that still makes you laugh.' },
  { text: 'Read the last thing you typed and deleted before sending.' },
  { text: "Show the group your phone's battery percentage and confess the last time you charged it." },
  { text: 'Read your most recent calendar entry out loud.' },
  { text: 'Show the group your weather app and confess if you checked it today.' },
  { text: 'Read the last thing you starred or saved online.' },
  { text: 'Show the group a screenshot from your favorite meme folder.' },
  { text: 'Read your last search on a shopping app out loud.' },
  { text: 'Show the group your most recent voice assistant question.' },
  { text: 'Read the last comment you left on a post.' },
  { text: 'Show the group how many tabs you currently have open.' },
  { text: 'Read your last "draft" message that never got sent.' },
  { text: 'Show the group your alarm clock time for tomorrow.' },
  { text: 'Read the title of the last video you watched.' },
  { text: 'Show the group your most recent podcast or playlist.' },
  { text: 'Read your last review left for a restaurant or app.' },
  { text: 'Show the group the oldest photo in your camera roll still saved.' },
  { text: 'Read the last thing you typed into a search bar and deleted.' },
  { text: 'Show the group your fitness or step count app for today.' },
  { text: 'Read a compliment someone once texted you, if you can find one.' },
  { text: 'Show the group your most recent "on this day" memory photo.' },
  { text: 'Read the last group chat message you sent out loud.' },
  { text: 'Show the group a folder or album name from your camera roll.' },
  { text: 'Read the last thing you saved to your favorites or bookmarks.' },
];

const GROUP_DECKS: Record<GroupCardType, { truth: string[]; dare: RawDare[] }> = {
  normal: { truth: NORMAL_TRUTHS, dare: NORMAL_DARES },
  spicy: { truth: SPICY_TRUTHS, dare: SPICY_DARES },
  revealing: { truth: REVEALING_TRUTHS, dare: REVEALING_DARES },
};

export interface GroupPoolOptions {
  noTouch: boolean;
  drinks: boolean;
}

export function groupPool(cardType: GroupCardType, kind: CouplesKind, opts: GroupPoolOptions): readonly string[] {
  const deck = GROUP_DECKS[cardType];
  if (kind === 'truth') return deck.truth;
  return deck.dare.filter((d) => !(opts.noTouch && d.touch) && !(!opts.drinks && d.drink)).map((d) => d.text);
}

/** Total number of built-in cards across every type and kind, ignoring no-touch/drinks filters. */
export function groupDeckSize(): number {
  let total = 0;
  for (const type of GROUP_CARD_TYPES) {
    total += GROUP_DECKS[type].truth.length + GROUP_DECKS[type].dare.length;
  }
  return total;
}

/** Replaces {left} and {right} with the real neighbor names of whoever is up. */
export function fillPlaceholders(text: string, leftName: string, rightName: string): string {
  return text.replace(/\{left\}/g, leftName).replace(/\{right\}/g, rightName);
}

/** The players seated to the left and right of `playerId`, wrapping around the table. */
export function neighborsOf(order: readonly string[], playerId: string): { leftId: string; rightId: string } {
  const i = order.indexOf(playerId);
  const n = order.length;
  if (i === -1 || n === 0) return { leftId: playerId, rightId: playerId };
  return { leftId: order[(i - 1 + n) % n], rightId: order[(i + 1) % n] };
}
