import { APP_NAME, ROOM_CODE_LENGTH, ROOM_CODE_REGEX } from '@shared';
import { motion } from 'motion/react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { BottleIllustration, CouplesIllustration, UnoIllustration, WheelIllustration } from '../components/hub/illustrations';
import { GameTile } from '../components/hub/GameTile';
import { ProfileButton } from '../components/hub/ProfileButton';
import { Button } from '../components/ui/Button';
import { SoundToggle } from '../components/ui/SoundToggle';
import { playSound } from '../game/sounds';

const GAMES = [
  {
    to: '/uno',
    title: 'UNO',
    description: 'The classic card game, online with friends.',
    badge: '2–8 players, online',
    accent: '#3d8bff',
    illustration: <UnoIllustration />,
  },
  {
    to: '/bottle',
    title: 'Spin the Bottle',
    description: 'Spin it, see who it lands on, and go.',
    badge: '2–12 players, one phone or online',
    accent: '#f4a340',
    illustration: <BottleIllustration />,
  },
  {
    to: '/wheel',
    title: 'Name Wheel',
    description: 'Put in any names, spin, get a winner.',
    badge: 'Any names, one screen',
    accent: '#f7c948',
    illustration: <WheelIllustration />,
  },
  {
    to: '/couples',
    title: 'Couples Truth or Dare',
    description: 'A private game for two, warm and playful.',
    badge: '2 players, 18+',
    accent: '#ff6f91',
    illustration: <CouplesIllustration />,
  },
];

export function HubPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onGo = () => {
    const clean = code.trim().toUpperCase();
    if (!ROOM_CODE_REGEX.test(clean)) {
      setError(`Room codes are ${ROOM_CODE_LENGTH} letters and numbers, like X7K92P.`);
      playSound('error');
      return;
    }
    navigate(`/room/${clean}`);
  };

  return (
    <main className="hub-background relative min-h-full overflow-hidden">
      <div className="hub-glow" aria-hidden />
      <div className="relative mx-auto flex min-h-full max-w-5xl flex-col px-4 pb-12 pt-4 sm:px-6">
        <header className="flex items-center justify-between">
          <span className="font-display text-2xl tracking-wide">{APP_NAME}</span>
          <div className="flex items-center gap-1">
            <SoundToggle />
            <ProfileButton />
          </div>
        </header>

        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 text-center text-lg font-semibold text-muted sm:text-left"
        >
          Pick a game to start the party.
        </motion.p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {GAMES.map((game, i) => (
            <GameTile key={game.to} index={i} {...game} />
          ))}
        </div>

        <section className="mt-8 rounded-[28px] bg-night-2/70 p-5 ring-1 ring-line">
          <label htmlFor="hub-code" className="mb-2 block text-sm font-semibold text-muted">
            Have a code?
          </label>
          <div className="flex gap-3">
            <input
              id="hub-code"
              value={code}
              onChange={(e) => {
                setError(null);
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH));
              }}
              onKeyDown={(e) => e.key === 'Enter' && onGo()}
              placeholder="X7K92P"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              className="h-14 min-w-0 flex-1 rounded-2xl bg-night px-4 text-center font-display text-2xl tracking-[0.3em] text-ink ring-1 ring-line placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-card-yellow"
            />
            <Button size="lg" onClick={onGo} disabled={code.length !== ROOM_CODE_LENGTH}>
              Go
            </Button>
          </div>
          <p className={error ? 'mt-2 text-sm text-card-red' : 'mt-2 text-sm text-muted/70'} role={error ? 'alert' : undefined}>
            {error ?? 'Enter a room code to jump straight to a game.'}
          </p>
        </section>
      </div>
    </main>
  );
}
