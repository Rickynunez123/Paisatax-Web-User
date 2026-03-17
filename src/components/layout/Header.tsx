'use client';

import { useAgent } from '@/context/AgentContext';
import { useTheme } from '@/context/ThemeContext';

const PHASE_LABELS: Record<string, string> = {
  intake: 'Getting Started',
  documents: 'Documents',
  qa: 'Questions',
  review: 'Review',
};

export default function Header() {
  const { phase, progress, sessionKey, messages } = useAgent();
  const { theme, toggleTheme } = useTheme();
  const hasSessionActivity = Boolean(sessionKey || messages.length > 0);

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--color-soft-border)] bg-[var(--color-surface)]/92 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-[var(--color-text-primary)]">
            PaisaTax
          </p>

          {hasSessionActivity && (
            <div className="hidden items-center gap-3 rounded-full border border-[var(--color-border)] bg-[var(--color-background-alt)]/72 px-3 py-2 sm:flex">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                {PHASE_LABELS[phase] ?? phase}
              </span>
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--color-overlay)]">
                <div
                  className="h-full rounded-full bg-[var(--color-brand-strong)] transition-all duration-500"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {hasSessionActivity && (
            <span className="hidden text-xs font-medium text-[var(--color-text-tertiary)] sm:inline">
              {Math.round(progress)}%
            </span>
          )}

          <button
            onClick={toggleTheme}
            className="lux-icon-button"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2.2M12 19.8V22M4.93 4.93l1.56 1.56M17.51 17.51l1.56 1.56M2 12h2.2M19.8 12H22M4.93 19.07l1.56-1.56M17.51 6.49l1.56-1.56" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
