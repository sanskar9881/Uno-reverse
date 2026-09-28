import type { ClientState } from '@shared';
import { cn } from '../../utils/cn';
import { Avatar } from '../ui/Avatar';

export function Scoreboard({ state, showRound = false }: { state: ClientState; showRound?: boolean }) {
  const { room } = state;
  const last = room.lastRound;
  const players = [...room.players].sort((a, b) => b.score - a.score);
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-muted">
        <tr>
          <th className="pb-2 font-semibold">Player</th>
          {showRound && <th className="pb-2 text-right font-semibold">Cards left</th>}
          {showRound && <th className="pb-2 text-right font-semibold">Card points</th>}
          <th className="pb-2 text-right font-semibold">Total</th>
        </tr>
      </thead>
      <tbody>
        {players.map((p) => (
          <tr key={p.id} className={cn('border-t border-line', p.id === state.selfId && 'text-card-yellow')}>
            <td className="py-2">
              <span className="flex items-center gap-2">
                <Avatar index={p.avatar} size={28} dim={!p.connected} />
                <span className="truncate font-bold">
                  {p.nickname}
                  {p.id === state.selfId && ' (you)'}
                </span>
              </span>
            </td>
            {showRound && <td className="py-2 text-right tabular-nums">{last?.cardsLeft[p.id] ?? '–'}</td>}
            {showRound && (
              <td className="py-2 text-right tabular-nums">
                {last?.winnerId === p.id ? '–' : (last?.pointsByPlayer[p.id] ?? '–')}
              </td>
            )}
            <td className="py-2 text-right text-base font-extrabold tabular-nums">{p.score}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
