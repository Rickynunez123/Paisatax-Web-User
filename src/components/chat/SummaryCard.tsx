'use client';

import type { AgentPhase } from '@/lib/types';

interface SummaryCardProps {
  refund: number | null;
  owed: number | null;
  progress: number;
  phase: AgentPhase;
  agi?: number | null;
  totalIncome?: number | null;
  totalTax?: number | null;
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '--';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export default function SummaryCard({
  refund,
  owed,
  progress: _progress,
  agi,
  totalIncome,
  totalTax,
}: SummaryCardProps) {
  const isRefund = refund !== null && refund > 0;
  const isOwed = owed !== null && owed > 0;
  const hasMeaningfulMetrics = [totalIncome, agi, totalTax].some(
    (value) => value !== null && value !== undefined && value !== 0,
  );

  if (!isRefund && !isOwed && !hasMeaningfulMetrics) {
    return null;
  }

  const metrics = [
    { label: 'Income', value: totalIncome },
    { label: 'AGI', value: agi },
    { label: 'Total tax', value: totalTax },
  ].filter(
    (metric) =>
      metric.value !== null &&
      metric.value !== undefined &&
      (hasMeaningfulMetrics || metric.value !== 0),
  );

  return (
    <div className="lux-panel px-5 py-5 sm:px-6">
      {(isRefund || isOwed) && (
        <div className="mb-5 text-center">
          {isRefund && (
            <>
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">Estimated refund</p>
              <p className="mt-2 text-4xl font-bold text-[var(--color-success)]">{formatCurrency(refund)}</p>
            </>
          )}
          {isOwed && (
            <>
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">Estimated amount owed</p>
              <p className="mt-2 text-4xl font-bold text-[var(--color-danger)]">{formatCurrency(owed)}</p>
            </>
          )}
        </div>
      )}

      {metrics.length > 0 && (
        <div
          className={`grid gap-3 text-center text-xs ${
            metrics.length === 1 ? 'grid-cols-1' : metrics.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
          } ${isRefund || isOwed ? 'border-t border-[var(--color-soft-border)] pt-4' : ''}`}
        >
          {metrics.map((metric) => (
            <div key={metric.label}>
              <p className="text-[var(--color-text-tertiary)]">{metric.label}</p>
              <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
                {formatCurrency(metric.value)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
