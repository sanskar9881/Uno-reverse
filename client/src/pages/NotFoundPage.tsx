import { Link } from 'react-router';
import { Logo } from '../components/ui/Logo';

export function NotFoundPage() {
  return (
    <main className="grid min-h-full place-items-center p-6 text-center">
      <div className="flex flex-col items-center gap-6">
        <Logo size="sm" animate={false} />
        <h1 className="font-display text-3xl">This page isn't in the deck</h1>
        <Link to="/" className="rounded-2xl bg-card-yellow px-5 py-3 font-bold text-night">
          Go to the start
        </Link>
      </div>
    </main>
  );
}
