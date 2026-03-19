'use client';

import { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';

type ReturnStatus =
  | 'In Progress'
  | 'Under Review'
  | 'Ready to Submit'
  | 'Submitted'
  | 'Accepted'
  | 'Rejected'
  | 'Requires Action';

const STATUS_COLORS: Record<ReturnStatus, string> = {
  'In Progress': 'bg-[var(--color-info-soft)] text-[var(--color-info-text)]',
  'Under Review': 'bg-[var(--color-warning-soft)] text-[var(--color-warning-text)]',
  'Ready to Submit': 'bg-[var(--color-success-soft)] text-[var(--color-success-text)]',
  'Submitted': 'bg-[var(--color-success-soft)] text-[var(--color-success-text)]',
  'Accepted': 'bg-[var(--color-success-soft)] text-[var(--color-success-text)] font-bold',
  'Rejected': 'bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]',
  'Requires Action': 'bg-[var(--color-warning-soft)] text-[var(--color-warning-text)]',
};

function StatusBadge({ status }: { status: ReturnStatus }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${STATUS_COLORS[status]}`}>
      {status}
    </span>
  );
}

export default function ReturnsPage() {
  const [tab, setTab] = useState<'federal' | 'state'>('federal');

  return (
    <div className="lux-shell flex min-h-screen flex-col">
      <Header />

      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
          Returns
        </h1>

        {/* Tabs */}
        <div className="mt-6 flex gap-2">
          <button
            onClick={() => setTab('federal')}
            className={`rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] transition-colors ${
              tab === 'federal'
                ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)] border border-[var(--color-brand-strong)]'
                : 'border border-[var(--color-border)] text-[var(--color-text-tertiary)]'
            }`}
          >
            Federal
          </button>
          <button
            onClick={() => setTab('state')}
            className={`rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] transition-colors ${
              tab === 'state'
                ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)] border border-[var(--color-brand-strong)]'
                : 'border border-[var(--color-border)] text-[var(--color-text-tertiary)]'
            }`}
          >
            State
          </button>
        </div>

        <div className="mt-8">
          {tab === 'federal' ? (
            <div className="lux-card-outline p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                    2025 Federal Return
                  </h3>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Form 1040</p>
                </div>
                <div className="flex items-center gap-4">
                  <StatusBadge status="In Progress" />
                  <Link
                    href="/home"
                    className="lux-button-primary px-4 py-2 text-xs font-semibold"
                  >
                    Continue
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm text-[var(--color-text-tertiary)]">
                State filing coming soon. Available once federal e-file certification is complete.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
