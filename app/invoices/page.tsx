'use client';

import Header from '@/components/layout/Header';
import StripeConnectBanner from '@/components/invoices/StripeConnectBanner';

function StatusBadge({ status }: { status: 'unpaid' | 'paid' | 'expired' }) {
  const styles = {
    unpaid: 'bg-[var(--color-warning-soft)] text-[var(--color-warning-text)]',
    paid: 'bg-[var(--color-success-soft)] text-[var(--color-success-text)]',
    expired: 'bg-[var(--color-surface-soft)] text-[var(--color-text-tertiary)]',
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${styles[status]}`}>
      {status}
    </span>
  );
}

export default function InvoicesPage() {
  const stripeConnected = false; // placeholder

  return (
    <div className="lux-shell flex min-h-screen flex-col">
      <Header />

      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
            Invoices
          </h1>
          <button
            disabled
            className="lux-button-primary px-5 py-2 text-xs font-semibold opacity-50"
            title="Coming soon"
          >
            New Invoice
          </button>
        </div>

        {/* Stripe Connect Banner */}
        <div className="mt-6">
          <StripeConnectBanner connected={stripeConnected} />
        </div>

        {/* AR Summary */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          {[
            { label: 'Invoiced', value: '$0.00' },
            { label: 'Received', value: '$0.00' },
            { label: 'Outstanding', value: '$0.00' },
          ].map((item) => (
            <div key={item.label} className="lux-card-outline p-4 text-center">
              <p className="text-xs text-[var(--color-text-tertiary)]">{item.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--color-text-primary)]">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {/* Invoice list — empty state */}
        <section className="mt-8">
          <p className="text-center text-sm text-[var(--color-text-tertiary)]">
            No invoices yet. Create your first invoice to start tracking payments.
          </p>
          <p className="mt-2 text-center text-xs text-[var(--color-text-tertiary)]">
            Each invoice shows: <StatusBadge status="unpaid" /> <StatusBadge status="paid" /> <StatusBadge status="expired" />
          </p>
        </section>

        {/* 1099-NEC Tracker */}
        <section className="mt-12">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Contractor Tracker
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Contractors you&apos;ve paid $600 or more in a year may need a 1099-NEC
          </p>

          <div className="mt-6 lux-card-outline p-5">
            <p className="text-center text-sm text-[var(--color-text-tertiary)]">
              No contractors added yet
            </p>
            <div className="mt-4 flex justify-center">
              <button
                disabled
                className="lux-button-secondary px-4 py-2 text-xs font-semibold opacity-50"
                title="Coming soon"
              >
                Add Contractor
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
