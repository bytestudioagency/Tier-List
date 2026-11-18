import clsx from "clsx";

function Block({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse bg-ink-800", className)} />;
}

const GRID_BACKDROP =
  "pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]";

const TIER_COLORS = [
  "var(--tier-s)",
  "var(--tier-a)",
  "var(--tier-b)",
  "var(--tier-c)",
  "var(--tier-d)",
];

function LoadingLabel({ label }: { label: string }) {
  return (
    <output className="sr-only" aria-live="polite">
      {label}
    </output>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950">
      <div className={GRID_BACKDROP} />
      <main className="relative mx-auto w-full max-w-6xl px-6 py-10">
        <LoadingLabel label="Loading your tier lists" />
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-ink-700 pb-4">
            <Block className="h-9 w-56" />
            <Block className="h-10 w-36 bg-accent/30" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
                key={index}
                className="border border-ink-700 bg-ink-900 p-4"
              >
                <Block className="h-6 w-3/4" />
                <Block className="mt-2 h-3 w-1/3" />
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Block className="h-9" />
                  <Block className="h-9" />
                  <Block className="h-9" />
                  <Block className="h-9" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function TierRowsSkeleton({ withPool }: { withPool: boolean }) {
  return (
    <>
      <div className="space-y-3">
        {TIER_COLORS.map((color, index) => (
          <div
            key={color}
            className="grid grid-cols-[90px_1fr] overflow-hidden border border-ink-700 bg-ink-950"
          >
            <div
              className="h-22 animate-pulse border-r border-ink-700 opacity-40"
              style={{ backgroundColor: color }}
            />
            <div className="flex gap-0">
              {Array.from({ length: Math.max(0, 4 - index) }, (_, item) => (
                <Block
                  // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
                  key={item}
                  className="h-22 w-22 border border-ink-700"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {withPool && (
        <div className="mt-6 border border-ink-700 bg-ink-900 p-3">
          <Block className="mb-2 h-3 w-24" />
          <div className="flex flex-wrap gap-2 p-1">
            {Array.from({ length: 5 }, (_, item) => (
              <Block
                // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
                key={item}
                className="h-22 w-22"
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export function EditorSkeleton() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950">
      <div className={GRID_BACKDROP} />
      <main className="relative mx-auto w-full max-w-6xl px-6 py-8">
        <LoadingLabel label="Loading tier list" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <Block className="h-4 w-40" />
          <div className="flex items-center gap-2">
            <Block className="h-4 w-28" />
            <Block className="h-8 w-16 bg-accent/30" />
            <Block className="h-8 w-24" />
          </div>
        </div>
        <div className="space-y-4 border border-ink-700 bg-ink-950 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Block className="h-12 min-w-[260px] flex-1" />
            <Block className="h-11 w-28 bg-accent/30" />
          </div>
          <TierRowsSkeleton withPool />
        </div>
      </main>
    </div>
  );
}

export function ShareSkeleton() {
  return (
    <main className="min-h-screen bg-ink-950 p-6">
      <LoadingLabel label="Loading tier list" />
      <div className="mx-auto w-full max-w-6xl">
        <Block className="mb-6 h-10 w-72" />
        <TierRowsSkeleton withPool={false} />
      </div>
    </main>
  );
}
