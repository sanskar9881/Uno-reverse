import { ROOM_CODE_REGEX, nicknameProblem } from '@shared';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { OnlineBottleBoard } from '../components/bottle/OnlineBottleBoard';
import { OnlineCouplesBoard } from '../components/couples/OnlineCouplesBoard';
import { GameBoard } from '../components/game/GameBoard';
import { Lobby } from '../components/lobby/Lobby';
import { ProfileFields } from '../components/lobby/ProfileFields';
import { Button } from '../components/ui/Button';
import { ConnectionBadge } from '../components/ui/ConnectionBadge';
import { Logo } from '../components/ui/Logo';
import { Modal } from '../components/ui/Modal';
import { leaveRoom } from '../game/actions';
import { playSound } from '../game/sounds';
import { joinRoom, rejoin } from '../socket/lifecycle';
import { useGameStore } from '../store/gameStore';
import { clearSession, loadSession } from '../utils/storage';

function Panel({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-full place-items-center p-4">
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-[28px] bg-night-2/80 p-6 text-center ring-1 ring-line backdrop-blur sm:p-8">
        <Logo size="sm" animate={false} />
        {children}
      </div>
    </main>
  );
}

export function RoomPage() {
  const params = useParams();
  const code = (params.code ?? '').toUpperCase();
  const navigate = useNavigate();
  const state = useGameStore((s) => s.state);
  const bound = useGameStore((s) => s.bound);
  const connection = useGameStore((s) => s.connection);
  const ended = useGameStore((s) => s.ended);
  const profile = useGameStore((s) => s.profile);

  const validCode = ROOM_CODE_REGEX.test(code);
  const hasSession = loadSession()?.roomCode === code;
  const [missing, setMissing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [joining, setJoining] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const inRoom = validCode && !ended && state?.room.code === code && (bound || hasSession);

  // Refreshed the page or lost the connection? Reclaim the seat with the token saved in this tab.
  useEffect(() => {
    if (!validCode || ended || bound || connection !== 'connected') return;
    const session = loadSession();
    if (session?.roomCode !== code) return;
    let cancelled = false;
    void rejoin(session).then((res) => {
      if (cancelled || res.ok) return;
      if (res.error.code === 'NETWORK' || res.error.code === 'RATE_LIMITED') {
        setTimeout(() => !cancelled && setRetry((n) => n + 1), 1500);
        return;
      }
      useGameStore.getState().reset();
      if (res.error.code === 'ROOM_NOT_FOUND') setMissing(true);
      else setNotice('Your seat in this room has expired. Join again to play.');
    });
    return () => {
      cancelled = true;
    };
  }, [validCode, ended, bound, connection, code, retry]);

  const myTurn =
    inRoom && state?.room.status === 'playing' && state.game?.currentPlayerId === state.selfId && !state.game.finished;
  useEffect(() => {
    document.title = myTurn ? '(Your turn) UNO Party' : inRoom ? `Room ${code} - UNO Party` : 'UNO Party';
  }, [myTurn, inRoom, code]);
  useEffect(() => () => void (document.title = 'UNO Party'), []);

  const doLeave = async () => {
    setConfirmLeave(false);
    await leaveRoom();
    navigate('/uno');
  };
  const onLeave = () => (state?.room.status === 'playing' ? setConfirmLeave(true) : void doLeave());

  const onJoin = async () => {
    setShowErrors(true);
    if (nicknameProblem(profile.nickname) || joining) {
      playSound('error');
      return;
    }
    setJoining(true);
    setNotice(null);
    const res = await joinRoom(code, profile);
    setJoining(false);
    if (!res.ok) {
      playSound('error');
      if (res.error.code === 'ROOM_NOT_FOUND') setMissing(true);
      else setNotice(res.error.message);
    }
  };

  const goHome = () => {
    clearSession();
    useGameStore.getState().reset();
    navigate('/uno');
  };

  if (!validCode) {
    return (
      <Panel>
        <h1 className="font-display text-2xl">That room code doesn't look right</h1>
        <p className="text-muted">Room codes are 6 letters and numbers, like X7K92P. Check the link your friend sent.</p>
        <Button onClick={goHome}>Go to the start</Button>
      </Panel>
    );
  }

  if (ended) {
    const title =
      ended.reason === 'kicked'
        ? 'The host removed you from the room'
        : ended.reason === 'replaced'
          ? 'This game is open in another tab'
          : 'This room was closed';
    return (
      <Panel>
        <h1 className="font-display text-2xl">{title}</h1>
        <p className="text-muted">
          {ended.reason === 'replaced' ? 'Only one tab can hold your seat. You can move it back here.' : ended.message}
        </p>
        <div className="flex w-full flex-col gap-2">
          {ended.reason === 'replaced' && (
            <Button size="lg" onClick={() => useGameStore.getState().setEnded(null)}>
              Play here instead
            </Button>
          )}
          <Button variant={ended.reason === 'replaced' ? 'secondary' : 'primary'} size="lg" onClick={goHome}>
            Back to the start
          </Button>
        </div>
      </Panel>
    );
  }

  if (missing) {
    return (
      <Panel>
        <h1 className="font-display text-2xl">Room {code} isn't open</h1>
        <p className="text-muted">It may have closed after everyone left. Ask your friend for a new code, or start your own game.</p>
        <Button size="lg" onClick={goHome}>
          Start a new game
        </Button>
      </Panel>
    );
  }

  if (inRoom && state) {
    return (
      <>
        {state.room.status === 'lobby' ? (
          <Lobby state={state} onLeave={onLeave} />
        ) : state.room.gameType === 'bottle' ? (
          <OnlineBottleBoard state={state} onLeave={onLeave} />
        ) : state.room.gameType === 'couples' ? (
          <OnlineCouplesBoard state={state} onLeave={onLeave} />
        ) : (
          <GameBoard state={state} onLeave={onLeave} />
        )}
        {!bound && (
          <div className="fixed inset-0 z-modal grid place-items-center bg-night/60 backdrop-blur-[2px]">
            <ConnectionBadge />
            {connection === 'connected' && (
              <p className="rounded-full bg-night-2 px-4 py-2 text-sm font-semibold text-muted ring-1 ring-line">
                Getting your seat back…
              </p>
            )}
          </div>
        )}
        <Modal open={confirmLeave} onClose={() => setConfirmLeave(false)} label="Leave the game?" className="max-w-sm text-center">
          <h2 className="font-display text-2xl">Leave the game?</h2>
          <p className="mt-2 text-muted">You'll give up your seat, and your cards go back into the deck.</p>
          <div className="mt-6 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setConfirmLeave(false)} autoFocus>
              Stay
            </Button>
            <Button variant="danger" onClick={() => void doLeave()}>
              Leave game
            </Button>
          </div>
        </Modal>
      </>
    );
  }

  if (hasSession) {
    return (
      <Panel>
        <h1 className="font-display text-2xl">Getting your seat back…</h1>
        <p className="text-muted">Reconnecting you to room {code}.</p>
        <ConnectionBadge />
      </Panel>
    );
  }

  return (
    <Panel>
      <div>
        <h1 className="font-display text-2xl">You're invited to room {code}</h1>
        <p className="mt-1 text-muted">Pick a nickname and grab a seat.</p>
      </div>
      <div className="w-full text-left">
        <ProfileFields showErrors={showErrors} onEnter={onJoin} />
      </div>
      <Button size="lg" className="w-full" onClick={() => void onJoin()} disabled={joining}>
        {joining ? 'Joining…' : 'Join Game'}
      </Button>
      {notice && (
        <p className="text-sm text-card-red" role="alert">
          {notice}
        </p>
      )}
      <ConnectionBadge />
      <Link to="/uno" className="text-sm font-semibold text-muted hover:text-ink">
        Back to the start
      </Link>
    </Panel>
  );
}
