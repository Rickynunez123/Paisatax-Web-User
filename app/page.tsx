'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserProfile } from '@/context/UserProfileContext';

const STORAGE_KEY = 'paisatax-mode';

export default function LandingPage() {
  const router = useRouter();
  const { setMode } = useUserProfile();

  // If mode already set, skip selector
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'personal' || stored === 'business') {
        router.replace('/home');
      }
    }
  }, [router]);

  const handleSelect = (mode: 'personal' | 'business') => {
    setMode(mode);
    router.push('/home');
  };

  return (
    <main className="lux-shell flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <section className="w-full max-w-[600px]">
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.42em] text-[var(--color-text-tertiary)]">
          PaisaTax
        </p>

        <h1
          className="text-center text-4xl leading-[0.96] tracking-tight text-[var(--color-text-primary)] sm:text-5xl"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          How do you primarily
          <br />
          earn income?
        </h1>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {/* W-2 Employee */}
          <button
            onClick={() => handleSelect('personal')}
            className="group flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-6 py-8 text-center transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-brand-soft)]"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="3" width="16" height="18" rx="2" />
                <path d="M8 7h8M8 11h8M8 15h4" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-[var(--color-text-primary)]">W-2 Employee</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                You receive a W-2 from your employer
              </p>
            </div>
          </button>

          {/* Self-Employed */}
          <button
            onClick={() => handleSelect('business')}
            className="group flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-6 py-8 text-center transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-brand-soft)]"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-[var(--color-text-primary)]">Self-Employed / Business Owner</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                You receive 1099-NEC, run a business, or freelance
              </p>
            </div>
          </button>
        </div>
      </section>
    </main>
  );
}
