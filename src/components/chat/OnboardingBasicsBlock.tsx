'use client';

import { useState } from 'react';
import { useOnboarding } from '@/hooks/useOnboarding';
import { FILING_STATUSES, TAX_YEARS } from '@/lib/onboarding-constants';

interface Props {
  isReturning: boolean;
  prefilled: { year: string; status: string; dependents: boolean | null };
}

export default function OnboardingBasicsBlock({ isReturning, prefilled }: Props) {
  const { handleBasicsComplete, step } = useOnboarding();
  const [year, setYear] = useState(prefilled.year || '2025');
  const [status, setStatus] = useState(prefilled.status || '');
  const [deps, setDeps] = useState<boolean | null>(prefilled.dependents);
  const [submitted, setSubmitted] = useState(false);

  const statusObj = FILING_STATUSES.find((s) => s.value === status);
  const canSubmit = Boolean(statusObj && deps !== null) && !submitted;

  if (step !== 'step_basics' && step !== 'loading') {
    // After submitting, show a compact summary instead of disappearing
    if (submitted && statusObj) {
      return (
        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[var(--color-brand-strong)]/15 bg-[var(--color-brand-soft)] px-4 py-1.5">
          <svg className="h-3.5 w-3.5 text-[var(--color-brand-strong)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          <span className="text-sm font-medium text-[var(--color-brand-strong)]">
            {year} · {statusObj.label}{deps ? ' · Dependents' : ''}
          </span>
        </div>
      );
    }
    return null;
  }

  const handleSubmit = () => {
    if (!canSubmit || !statusObj) return;
    setSubmitted(true);
    handleBasicsComplete(year, status, statusObj.label, deps!);
  };

  return (
    <div className="mt-3 space-y-4">
      {/* Tax Year — pill row */}
      <div>
        <div className="mb-2 text-xs font-medium text-[var(--color-text-tertiary)]">Tax Year</div>
        <div className="flex gap-2">
          {TAX_YEARS.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              disabled={submitted}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all disabled:opacity-50 ${
                year === y
                  ? 'bg-[var(--color-brand-strong)] text-white shadow-sm'
                  : 'border border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Filing Status — larger tappable cards */}
      <div>
        <div className="mb-2 text-xs font-medium text-[var(--color-text-tertiary)]">Filing Status</div>
        <div className="grid grid-cols-1 gap-1.5">
          {FILING_STATUSES.map((s) => {
            const active = status === s.value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatus(s.value)}
                disabled={submitted}
                className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm transition-all disabled:opacity-50 ${
                  active
                    ? 'bg-[var(--color-brand-soft)] font-semibold text-[var(--color-brand-strong)] ring-1 ring-[var(--color-brand-strong)]/20'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-soft)]'
                }`}
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  active ? 'border-[var(--color-brand-strong)] bg-[var(--color-brand-strong)]' : 'border-[var(--color-border-strong)]'
                }`}>
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dependents — simple toggle */}
      <div>
        <div className="mb-2 text-xs font-medium text-[var(--color-text-tertiary)]">Any dependents?</div>
        <div className="flex gap-2">
          {([true, false] as const).map((val) => (
            <button
              key={String(val)}
              type="button"
              onClick={() => setDeps(val)}
              disabled={submitted}
              className={`rounded-full px-5 py-1.5 text-sm font-medium transition-all disabled:opacity-50 ${
                deps === val
                  ? 'bg-[var(--color-brand-strong)] text-white shadow-sm'
                  : 'border border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              {val ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      {canSubmit && (
        <button
          type="button"
          onClick={handleSubmit}
          className="lux-button-primary mt-1 rounded-full px-6 py-2 text-sm font-semibold"
        >
          {isReturning ? 'Looks right →' : 'Continue →'}
        </button>
      )}
    </div>
  );
}
