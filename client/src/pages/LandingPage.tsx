import { ROOM_CODE_LENGTH, ROOM_CODE_REGEX, nicknameProblem } from '@shared';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ProfileFields } from '../components/lobby/ProfileFields';
import { Button } from '../components/ui/Button';
import { ConnectionBadge } from '../components/ui/ConnectionBadge';
import { Logo } from '../components/ui/Logo';
import { SoundToggle } from '../components/ui/SoundToggle';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { playSound } from '../game/sounds';
import { createRoom, joinRoom } from '../socket/lifecycle';
import { SERVER_URL } from '../socket/socket';
import { useGameStore } from '../store/gameStore';
import { toast } from '../store/toastStore';
import { loadSession } from '../utils/storage';
import { plural } from '../utils/format';

interface Stats {
  gamesPlayed: number;
  wins: number;
  points: number;
}

interface LeaderboardEntry extends Stats {
  nickname: string;
}

function useStats(profileId: string, connected: boolean) {
  const [mine, setMine] = useState<Stats | null>(null);
  const [top, setTop] = useState<LeaderboardEntry[]>([]);
  useEffect(() => {
    if (!connected) return;
    const ctrl = new AbortController();
    fetch(`${SERVER_URL}/api/stats/${profileId}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: Stats | null) => s && setMine(s))
      .catch(() => {});
    fetch(`${SERVER_URL}/api/leaderboard`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { entries: LeaderboardEntry[] } | null) => d && setTop(d.entries.slice(0, 5)))
      .catch(() => {});
    return () => ctrl.abort();
  }, [profileId, connected]);
  return { mine, top };
}

export function LandingPage() {
  const navigate = useNavigate();
  const profile = useGameStore((s) => s.profile);
  const connection = useGameStore((s) => s.connection);
  const [mode, setMode] = useState<'choose' | 'join'>('choose');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const session = loadSession();
  const { mine, top } = useStats(profile.profileId, connection === 'connected');

  const profileOk = () => {
    setShowErrors(true);
    if (nicknameProblem(profile.nickname)) {
      playSound('error');
      return false;
    }
    return true;
  };

  const onCreate = async () => {
    if (!profileOk() || busy) return;
    setBusy('create');
    const res = await createRoom(profile);
    setBusy(null);
    if (res.ok) navigate(`/room/${res.roomCode}`);
    else toast(res.error.message, 'bad');
  };

  const onJoin = async () => {
    if (!profileOk() || busy) return;
    const clean = code.trim().toUpperCase();
    if (!ROOM_CODE_REGEX.test(clean)) {
      setJoinError(`Room codes are ${ROOM_CODE_LENGTH} letters and numbers, like X7K92P.`);
      playSound('error');
      return;
    }
    setBusy('join');
    setJoinError(null);
    const res = await joinRoom(clean, profile);
    setBusy(null);
    if (res.ok) navigate(`/room/${res.roomCode}`);
    else {
      setJoinError(res.error.message);
      playSound('error');
    }
  };

  return (
    <main className="relative flex min-h-full flex-col items-center px-4 pb-10 pt-6 sm:pt-10">
      <Link
        to="/"
        aria-label="Back to the hub"
        className="absolute left-3 top-3 grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-veil/10 hover:text-ink"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </Link>
      <div className="absolute right-3 top-3">
        <SoundToggle />
          <ThemeToggle />
      </div>

      {session && (
        <Link
          to={`/room/${session.roomCode}`}
          className="mb-4 flex items-center gap-3 rounded-2xl bg-card-green/15 px-4 py-2 text-sm font-semibold ring-1 ring-card-green/40 hover:bg-card-green/25"
        >
          You're still seated in room {session.roomCode}. <span className="underline">Return to game</span>
        </Link>
      )}

      <header className="flex flex-col items-center gap-4 pt-4 text-center">
        <Logo />
        <p className="text-lg font-semibold text-muted sm:text-xl">Play UNO with your friends.</p>
      </header>

      <section className="mt-8 w-full max-w-[520px] rounded-[28px] bg-night-2/80 p-5 ring-1 ring-line backdrop-blur sm:p-7">
        <ProfileFields showErrors={showErrors} onEnter={mode === 'choose' ? onCreate : undefined} />

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button size="lg" onClick={onCreate} disabled={busy !== null}>
            {busy === 'create' ? 'Creating…' : 'Create Game'}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => {
              setMode(mode === 'join' ? 'choose' : 'join');
              setJoinError(null);
            }}
            aria-expanded={mode === 'join'}
          >
            Join Game
          </Button>
        </div>

        <AnimatePresence initial={false}>
          {mode === 'join' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <form
                className="mt-5 flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void onJoin();
                }}
              >
                <label htmlFor="room-code" className="text-sm font-semibold text-muted">
                  Room code from your friend
                </label>
                <div className="flex gap-3">
                  <input
                    id="room-code"
                    autoFocus
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH))}
                    placeholder="X7K92P"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    inputMode="text"
                    className="h-14 min-w-0 flex-1 rounded-2xl bg-night px-4 text-center font-display text-2xl tracking-[0.3em] text-ink ring-1 ring-line placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-card-yellow"
                  />
                  <Button type="submit" size="lg" disabled={busy !== null || code.length !== ROOM_CODE_LENGTH}>
                    {busy === 'join' ? 'Joining…' : 'Join'}
                  </Button>
                </div>
                <p className={joinError ? 'text-sm text-card-red' : 'text-sm text-muted/70'} role={joinError ? 'alert' : undefined}>
                  {joinError ?? 'Ask the host for the 6-character code on their screen.'}
                </p>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-5 text-center text-sm text-muted/80">For 2 to 8 players. No sign-up needed.</p>
      </section>

      <ConnectionBadge className="mt-5" />

      {(mine?.gamesPlayed || top.length > 0) && (
        <section className="mt-8 grid w-full max-w-[520px] gap-4 sm:grid-cols-2">
          {mine && mine.gamesPlayed > 0 && (
            <div className="rounded-3xl bg-veil/5 p-5 ring-1 ring-line">
              <h2 className="font-display text-lg">Your record</h2>
              <p className="mt-2 text-muted">
                {plural(mine.gamesPlayed, 'game')} played, {plural(mine.wins, 'win')}, {plural(mine.points, 'point')}.
              </p>
            </div>
          )}
          {top.length > 0 && (
            <div className="rounded-3xl bg-veil/5 p-5 ring-1 ring-line">
              <h2 className="font-display text-lg">Most wins</h2>
              <ol className="mt-2 space-y-1">
                {top.map((entry, i) => (
                  <li key={`${entry.nickname}-${i}`} className="flex justify-between gap-3 text-muted">
                    <span className="truncate text-ink">{entry.nickname}</span>
                    <span className="shrink-0">{plural(entry.wins, 'win')}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
