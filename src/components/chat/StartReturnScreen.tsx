'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import { useAgent } from '@/context/AgentContext';

const FILING_STATUSES = [
  { value: 'single', label: 'Single' },
  { value: 'married_filing_jointly', label: 'Married Filing Jointly' },
  { value: 'married_filing_separately', label: 'Married Filing Separately' },
  { value: 'head_of_household', label: 'Head of Household' },
  { value: 'qualifying_surviving_spouse', label: 'Qualifying Surviving Spouse' },
] as const;

const TAX_YEARS = ['2025', '2024', '2023'];

export default function StartReturnScreen() {
  const router = useRouter();
  const { startSession, sessionKey, isLoading } = useAgent();
  const [taxYear, setTaxYear] = useState('2025');
  const [filingStatus, setFilingStatus] = useState('');
  const [hasDependents, setHasDependents] = useState<boolean | null>(null);

  const selectedFilingStatus = useMemo(
    () => FILING_STATUSES.find((option) => option.value === filingStatus),
    [filingStatus],
  );
  const canContinue = Boolean(selectedFilingStatus && hasDependents !== null && !isLoading);

  useEffect(() => {
    if (sessionKey) {
      router.replace('/home');
    }
  }, [router, sessionKey]);

  const handleStartSession = async () => {
    if (!selectedFilingStatus || hasDependents === null) return;
    await startSession(selectedFilingStatus.value, selectedFilingStatus.label, taxYear, hasDependents);
  };

  return (
    <div className="lux-shell flex min-h-screen flex-col">
      <Header />

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md text-center">
          <div className="mb-6 text-left">
            <Link
              href="/home"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Back to home
            </Link>
          </div>

          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
              Start Tax Return
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              Select your year, filing status, and dependents.
            </p>
          </div>

          <div className="mx-auto mt-8 w-full max-w-sm space-y-6">
            <div className="relative mx-auto w-full max-w-[18rem]">
              <select
                value={taxYear}
                onChange={(e) => setTaxYear(e.target.value)}
                className="lux-select-compact w-full appearance-none border-b-[1.5px] border-[var(--color-border-strong)] px-8 text-center"
                aria-label="Tax year"
              >
                {TAX_YEARS.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-1 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-primary)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>

            <div className="relative mx-auto w-full max-w-[18rem]">
              <select
                value={filingStatus}
                onChange={(e) => setFilingStatus(e.target.value)}
                className="lux-select-compact w-full appearance-none border-b-[1.5px] border-[var(--color-border-strong)] px-8 text-center"
                aria-label="Filing status"
              >
                <option value="">Filing status</option>
                {FILING_STATUSES.map((statusOption) => (
                  <option key={statusOption.value} value={statusOption.value}>
                    {statusOption.label}
                  </option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-1 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-primary)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>

            <div>
              <label className="lux-field-label mb-2 block text-center">Dependents</label>
              <div className="flex items-center justify-center gap-6">
                <button
                  type="button"
                  onClick={() => setHasDependents(true)}
                  className={`border-b pb-1 text-xs font-medium uppercase tracking-[0.12em] transition-colors ${
                    hasDependents === true
                      ? 'border-[var(--color-brand-strong)] text-[var(--color-text-primary)]'
                      : 'border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setHasDependents(false)}
                  className={`border-b pb-1 text-xs font-medium uppercase tracking-[0.12em] transition-colors ${
                    hasDependents === false
                      ? 'border-[var(--color-brand-strong)] text-[var(--color-text-primary)]'
                      : 'border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                  }`}
                >
                  No
                </button>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={handleStartSession}
                disabled={!canContinue}
                className="lux-button-primary px-8 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isLoading ? 'Setting up your return...' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
