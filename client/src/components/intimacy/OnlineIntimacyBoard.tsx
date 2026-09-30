import type { ClientState, IntimacyCategory, IntimacyView } from '@shared';
import { useState } from 'react';
import { intimacyAddCard, intimacyDone, intimacyDraw, intimacySetCategories, intimacySetLevel, intimacySetOnlyOurs } from '../../game/actions';
import { confirmAge, isAgeConfirmed } from '../../game/intimacy/storage';
import { useGameStore } from '../../store/gameStore';
import { toast } from '../../store/toastStore';
import { copyText } from '../../utils/clipboard';
import { OurDeckPanel } from '../shared/OurDeckPanel';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Sheet } from '../ui/Sheet';
import { SoundToggle } from '../ui/SoundToggle';
import { CategoryPicker } from './CategoryPicker';
import { IntensitySlider } from './IntensitySlider';
import { IntimacyCardFlip } from './IntimacyCardFlip';

const INTIMACY_SLOTS = [
  { value: 'kiss', label: 'Kiss' },
  { value: 'touch', label: 'Touch and massage' },
  { value: 'flirtyTalk', label: 'Flirty talk' },
  { value: 'mood', label: 'Mood and setting' },
  { value: 'romance', label: 'Romance and dates' },
];

export function OnlineIntimacyBoard({ state, onLeave }: { state: ClientState; onLeave: () => void }) {
  const party = state.party as IntimacyView;
  const busy = useGameStore((s) => s.busy);
  const [ageConfirmed, setAgeConfirmed] = useState(() => isAgeConfirmed());
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [deckOpen, setDeckOpen] = useState(false);

  const partner = state.room.players.find((p) => p.id !== state.selfId);
  const isMyTurn = party.currentPartnerId === state.selfId;
  const myLevel = party.levels[state.selfId] ?? 'sweet';

  if (!ageConfirmed) {
    return (
      <Modal open label="This game is for adults" className="max-w-sm text-center">
        <h2 className="font-couples text-2xl">This game is for adults.</h2>
        <p className="mt-2 text-muted">Both of you should be 18 or older.</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onLeave}>
            Back
          </Button>
          <Button
            onClick={() => {
              confirmAge();
              setAgeConfirmed(true);
            }}
          >
            We're both 18+
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden px-4 pb-[env(safe-area-inset-bottom)] pt-[max(0.5rem,env(safe-area-inset-top))]">
      <header className="flex shrink-0 items-center justify-between gap-2 py-1.5">
        <button
          type="button"
          onClick={async () => toast((await copyText(state.room.code)) ? 'Room code copied' : `Room code: ${state.room.code}`, 'good', '📋')}
          className="shrink-0 rounded-xl bg-veil/5 px-2.5 py-1.5 font-display text-xs tracking-[0.15em] ring-1 ring-line hover:bg-veil/10"
        >
          {state.room.code}
        </button>
        <IntensitySlider label="Your comfort level" value={myLevel} onChange={(level) => void intimacySetLevel(level)} />
        <div className="flex shrink-0 items-center gap-1">
          <SoundToggle />
          <button type="button" onClick={onLeave} className="h-10 rounded-xl px-2 text-sm font-bold text-muted hover:bg-card-red/15 hover:text-card-red">
            Leave
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 py-1">
        <IntimacyCardFlip card={party.card} />
        <p className="shrink-0 text-center text-sm font-semibold text-muted">
          {isMyTurn ? "It's your turn." : `Waiting for ${partner?.nickname ?? 'your partner'}…`}
        </p>
      </div>

      <div className="shrink-0 pb-2">
        {isMyTurn && (
          <>
            {!party.card ? (
              <Button size="lg" className="w-full" disabled={busy} onClick={() => void intimacyDraw()}>
                Draw a card
              </Button>
            ) : (
              <Button size="lg" className="w-full" disabled={busy} onClick={() => void intimacyDone()}>
                Done
              </Button>
            )}
          </>
        )}
        <div className="mt-2 flex justify-center gap-4">
          <button type="button" onClick={() => setCategoriesOpen(true)} className="text-sm font-semibold text-muted hover:text-ink">
            Categories ({party.categories.length})
          </button>
          <button type="button" onClick={() => setDeckOpen(true)} className="text-sm font-semibold text-muted hover:text-ink">
            Our deck
          </button>
        </div>
      </div>

      <Sheet open={categoriesOpen} onClose={() => setCategoriesOpen(false)} label="Categories">
        <CategoryPicker categories={party.categories} onChange={(categories) => void intimacySetCategories(categories)} disabled={busy} />
      </Sheet>

      <Sheet open={deckOpen} onClose={() => setDeckOpen(false)} label="Our deck">
        <OurDeckPanel
          game="intimacy"
          level={myLevel}
          slots={INTIMACY_SLOTS}
          busy={busy}
          onlyOurs={party.onlyOurs}
          onToggleOnlyOurs={(value) => void intimacySetOnlyOurs(value)}
          onUseInGame={async (entry) => {
            const res = await intimacyAddCard(entry.level, entry.slot as IntimacyCategory, entry.text, entry.photo);
            if (res.ok) toast('Added to this room', 'good');
          }}
        />
      </Sheet>
    </div>
  );
}
