export default function Loading() {
  return (
    <div className="lux-shell">
      <div className="lux-app-loading">
        <div className="lux-loading-panel">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="lux-label">PaisaTax</div>
              <div className="mt-3 h-7 w-44 lux-skeleton" />
            </div>
            <div className="h-10 w-10 rounded-full border border-[var(--color-border)] bg-[var(--color-brand-soft)]" />
          </div>

          <div className="mt-6 lux-loading-bar" />

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="lux-summary-card">
              <div className="h-3 w-20 lux-skeleton" />
              <div className="mt-4 h-8 w-24 lux-skeleton" />
            </div>
            <div className="lux-summary-card">
              <div className="h-3 w-20 lux-skeleton" />
              <div className="mt-4 h-8 w-28 lux-skeleton" />
            </div>
            <div className="lux-summary-card">
              <div className="h-3 w-16 lux-skeleton" />
              <div className="mt-4 h-8 w-20 lux-skeleton" />
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="h-20 rounded-[var(--radius-md)] lux-skeleton" />
            <div className="h-20 rounded-[var(--radius-md)] lux-skeleton" />
            <div className="h-20 rounded-[var(--radius-md)] lux-skeleton" />
          </div>
        </div>
      </div>
    </div>
  );
}
