'use client';

interface StripeConnectBannerProps {
  connected: boolean;
}

export default function StripeConnectBanner({ connected }: StripeConnectBannerProps) {
  if (connected) {
    return (
      <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-success-border)] bg-[var(--color-success-soft)] px-4 py-3">
        <div className="h-2 w-2 rounded-full bg-[var(--color-success)]" />
        <span className="text-sm font-medium text-[var(--color-success-text)]">
          Bank connected · Payouts enabled
        </span>
        <a
          href="https://dashboard.stripe.com"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs font-medium text-[var(--color-success-text)] hover:underline"
        >
          Manage
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Connect your bank to receive payments
          </h3>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            PaisaTax uses Stripe to send invoices and deposit payments directly to your account.
          </p>
          <button
            disabled
            className="lux-button-primary mt-4 px-5 py-2 text-xs font-semibold opacity-50"
            title="Coming soon"
          >
            Connect Bank Account
          </button>
        </div>
      </div>
    </div>
  );
}
