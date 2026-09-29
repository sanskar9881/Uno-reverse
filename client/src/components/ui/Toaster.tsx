import { AnimatePresence, motion } from 'motion/react';
import { useToastStore, type ToastTone } from '../../store/toastStore';
import { cn } from '../../utils/cn';

const TONES: Record<ToastTone, string> = {
  info: 'bg-night-2/95 text-ink ring-1 ring-line',
  good: 'bg-toast-good/95 text-ink ring-1 ring-card-green/40',
  bad: 'bg-toast-bad/95 text-ink ring-1 ring-card-red/40',
  uno: 'bg-card-yellow text-night font-display text-lg ring-2 ring-white/60',
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-20 z-toast flex flex-col-reverse items-center gap-2 px-3 sm:inset-x-auto sm:top-16 sm:bottom-auto sm:right-4 sm:flex-col sm:w-[380px] sm:items-end sm:px-0"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            type="button"
            onClick={() => dismiss(t.id)}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
            className={cn(
              'pointer-events-auto flex max-w-md items-center gap-2 rounded-2xl px-4 py-2 text-left text-[15px] font-semibold shadow-[0_10px_30px_rgb(8_4_24/0.5)] backdrop-blur',
              TONES[t.tone],
            )}
          >
            {t.icon && <span aria-hidden>{t.icon}</span>}
            <span>{t.message}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
