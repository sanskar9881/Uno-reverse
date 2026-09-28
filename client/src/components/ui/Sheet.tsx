import { AnimatePresence, motion } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { useIsCompact } from '../../hooks/useMediaQuery';
import { cn } from '../../utils/cn';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  className?: string;
}

/** A bottom sheet on phones, a centered dialog on desktop. */
export function Sheet({ open, onClose, children, label, className }: SheetProps) {
  const compact = useIsCompact();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={cn('fixed inset-0 z-40 bg-[#0c0818]/70 backdrop-blur-sm', compact ? 'flex items-end' : 'grid place-items-center p-4')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className={cn(
              'w-full bg-night-2 shadow-[0_-20px_60px_rgb(0_0_0/0.6)] ring-1 ring-line',
              compact ? 'rounded-t-[28px] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]' : 'max-w-md rounded-[28px] p-6 shadow-[0_30px_80px_rgb(0_0_0/0.6)]',
              className,
            )}
            initial={compact ? { y: '100%' } : { scale: 0.92, y: 20, opacity: 0 }}
            animate={compact ? { y: 0 } : { scale: 1, y: 0, opacity: 1 }}
            exit={compact ? { y: '100%' } : { scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            {compact && <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-white/15" aria-hidden />}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
