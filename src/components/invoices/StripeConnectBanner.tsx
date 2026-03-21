'use client';

import type { StripeConnectStatus } from '@/lib/types';

interface StripeConnectBannerProps {
  status: StripeConnectStatus | null;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onDashboard?: () => void;
  onRefresh?: () => void;
  loading?: boolean;
  error?: string | null;
}

export default function StripeConnectBanner({ status, onConnect, onDisconnect, onDashboard, onRefresh, loading, error }: StripeConnectBannerProps) {
  // Fully connected and onboarded
  if (status?.connected && status.detailsSubmitted) {
    return (
      <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-success-border)] bg-[var(--color-success-soft)] px-4 py-3">
        <div className="h-2 w-2 rounded-full bg-[var(--color-success)]" />
        <span className="text-sm font-medium text-[var(--color-success-text)]">
          Bank connected
          {status.payoutsEnabled ? ' · Payouts enabled' : ' · Payouts pending'}
        </span>
        {onDashboard && (
          <button
            onClick={onDashboard}
            className="ml-auto text-xs font-medium text-[var(--color-success-text)] hover:underline"
          >
            Stripe Dashboard
          </button>
        )}
        {onDisconnect && (
          <button
            onClick={onDisconnect}
            className="text-[var(--color-success-text)]/60 hover:text-[var(--color-success-text)] transition-colors"
            title="Disconnect"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  // Account created but onboarding not finished
  if (status?.connected && !status.detailsSubmitted) {
    return (
      <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-amber-400/40 bg-amber-50/30 px-4 py-3 dark:bg-amber-900/10">
        <div className="h-2 w-2 rounded-full bg-amber-500" />
        <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
          Stripe onboarding incomplete
        </span>
        <button
          onClick={onConnect}
          disabled={loading}
          className="ml-auto lux-button-primary px-3 py-1 text-xs font-semibold"
        >
          {loading ? 'Opening...' : 'Continue Setup'}
        </button>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-amber-600/60 hover:text-amber-700 transition-colors"
            title="Refresh status"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  // Not connected
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
          {error && (
            <p className="mt-2 text-xs text-[var(--color-error-text)]">{error}</p>
          )}
          <button
            onClick={onConnect}
            disabled={loading}
            className="lux-button-primary mt-4 px-5 py-2 text-xs font-semibold"
          >
            {loading ? 'Setting up...' : 'Connect Bank Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
