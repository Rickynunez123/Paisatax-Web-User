'use client';

export default function PaymentCard({ content }: { content: string }) {
  return (
    <div className="lux-panel-soft px-5 py-5 text-center">
      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{content}</p>
      <button
        disabled
        className="mt-4 inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-6 py-2.5 text-sm font-semibold text-[var(--color-text-tertiary)] opacity-80"
      >
        E-file Coming Soon
      </button>
      <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">
        For now, download your return and mail it in.
      </p>
    </div>
  );
}
