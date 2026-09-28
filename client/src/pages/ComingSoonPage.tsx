import { PageHeader } from '../components/ui/PageHeader';

/** Placeholder for a hub game whose phase hasn't landed yet. */
export function ComingSoonPage({ title }: { title: string }) {
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col px-4 pb-10 pt-4">
      <PageHeader title={title} />
      <div className="mt-16 flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <h1 className="font-display text-3xl">Coming soon</h1>
        <p className="text-muted">{title} is on its way. Check back soon.</p>
      </div>
    </main>
  );
}
