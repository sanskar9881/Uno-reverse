import { useState } from 'react';
import { ProfileFields } from '../lobby/ProfileFields';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { useGameStore } from '../../store/gameStore';

/** The nickname and avatar, tucked behind a small button in the hub's top bar. */
export function ProfileButton() {
  const profile = useGameStore((s) => s.profile);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Edit profile, currently ${profile.nickname}`}
        className="grid h-11 w-11 place-items-center rounded-2xl hover:bg-white/10"
      >
        <Avatar index={profile.avatar} size={32} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="Your profile">
        <h2 className="mb-4 font-display text-xl">Your profile</h2>
        <ProfileFields showErrors={false} />
        <Button className="mt-5 w-full" onClick={() => setOpen(false)}>
          Done
        </Button>
      </Sheet>
    </>
  );
}
