'use client';

import { useState } from 'react';
import { useAgent } from '@/context/AgentContext';
import { useUserProfile } from '@/context/UserProfileContext';
import { useTheme } from '@/context/ThemeContext';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import Header from '@/components/layout/Header';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';


const FILING_STATUSES = [
  { value: 'single', label: 'Single' },
  { value: 'married_filing_jointly', label: 'Married Filing Jointly' },
  { value: 'married_filing_separately', label: 'Married Filing Separately' },
  { value: 'head_of_household', label: 'Head of Household' },
  { value: 'qualifying_surviving_spouse', label: 'Qualifying Surviving Spouse' },
];

function AssistantAvatar() {
  return (
    <div className="mt-2 hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-background-alt)] text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-brand-strong)] sm:flex">
      PT
    </div>
  );
}

const TAX_YEARS = ['2025', '2024', '2023'];

function WelcomeScreen() {
  const { startSession, isLoading } = useAgent();
  const { theme } = useTheme();
  const { mode, setMode } = useUserProfile();
  const [step, setStep] = useState<'welcome' | 'filing'>('welcome');
  const [taxYear, setTaxYear] = useState('2025');
  const [hasDependents, setHasDependents] = useState<boolean | null>(null);

  const logoSrc = theme === 'dark'
    ? '/paisatax_logo2.png'
    : '/paisatax_logo_light.png';

  const handleStartSession = (filingStatusValue: string, filingStatusLabel: string) => {
    const dependentsNote = hasDependents ? ' I have dependents.' : '';
    startSession(filingStatusValue, filingStatusLabel, taxYear, hasDependents ?? false);
  };

  if (step === 'filing') {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-lg text-center">
          <button
            onClick={() => setStep('welcome')}
            className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </button>

          <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)] sm:text-3xl">
            Choose your filing status
          </h2>

          {/* Tax Year selector */}
          <div className="mt-5 flex justify-center">
            <div className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-1">
              {TAX_YEARS.map((year) => (
                <button
                  key={year}
                  onClick={() => setTaxYear(year)}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium tracking-[0.08em] transition-all ${
                    taxYear === year
                      ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)] shadow-sm'
                      : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Filing for tax year {taxYear}
          </p>

          {/* Filing status grid */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {FILING_STATUSES.map((fs) => (
              <button
                key={fs.value}
                onClick={() => handleStartSession(fs.value, fs.label)}
                disabled={isLoading}
                className="group rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-5 py-4 text-center text-sm font-semibold text-[var(--color-text-primary)] transition-all hover:border-[var(--color-border-strong)] hover:bg-[var(--color-brand-soft)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {fs.label}
              </button>
            ))}
          </div>

          {/* Dependents question */}
          <div className="mt-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)] mb-3">
              Do you have dependents?
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setHasDependents(true)}
                className={`rounded-full px-6 py-2 text-xs font-medium transition-all ${
                  hasDependents === true
                    ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)] border border-[var(--color-brand-strong)]'
                    : 'border border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                }`}
              >
                Yes
              </button>
              <button
                onClick={() => setHasDependents(false)}
                className={`rounded-full px-6 py-2 text-xs font-medium transition-all ${
                  hasDependents === false
                    ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)] border border-[var(--color-brand-strong)]'
                    : 'border border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                }`}
              >
                No
              </button>
            </div>
          </div>

          {isLoading && (
            <p className="mt-6 text-sm font-medium text-[var(--color-text-secondary)]">
              Setting up your filing session...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-md text-center">

        {/* Headline */}
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
          File smarter.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
          AI-guided tax filing with document extraction,
          <br className="hidden sm:block" />
          real-time calculations, and e-file.
        </p>

        {/* Mode toggle */}
        <div className="mt-8 flex justify-center">
          <div className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-1">
            <button
              onClick={() => setMode('personal')}
              className={`rounded-full px-5 py-2 text-xs font-medium tracking-[0.08em] transition-all ${
                mode === 'personal'
                  ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)] shadow-sm'
                  : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              Personal
            </button>
            <button
              onClick={() => setMode('business')}
              className={`rounded-full px-5 py-2 text-xs font-medium tracking-[0.08em] transition-all ${
                mode === 'business'
                  ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)] shadow-sm'
                  : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              Business
            </button>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => setStep('filing')}
          className="lux-button-primary mt-8 px-8 py-3 text-sm font-semibold"
        >
          Start Tax Return
        </button>

        {/* Upload hint */}
        <p className="mt-5 text-xs text-[var(--color-text-tertiary)]">
          Have documents ready? You can upload W-2s, 1099s, and more.
        </p>
      </div>
    </div>
  );
}

function ErrorBanner({ error, onDismiss }: { error: string; onDismiss: () => void }) {
  return (
    <div className="px-4 pt-4 sm:px-6">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 rounded-2xl border border-[var(--color-danger)]/20 bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger-text)]">
        <span>{error}</span>
        <button onClick={onDismiss} className="font-semibold hover:underline">
          Dismiss
        </button>
      </div>
    </div>
  );
}

function LoadingIndicator() {
  return (
    <div className="flex justify-start gap-3">
      <AssistantAvatar />
      <div className="rounded-[22px] border border-[var(--color-soft-border)] bg-[var(--color-surface)]/92 px-4 py-3 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
        <div className="flex gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-text-tertiary)]" style={{ animationDelay: '0ms' }} />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-text-tertiary)]" style={{ animationDelay: '150ms' }} />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-text-tertiary)]" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

export default function ChatContainer() {
  const { sessionKey, messages, isLoading, error, clearError } = useAgent();
  const scrollRef = useAutoScroll([messages.length, isLoading, sessionKey]);
  const hasStarted = Boolean(sessionKey || messages.length > 0 || isLoading);

  return (
    <div className="lux-shell flex min-h-screen flex-col">
      <Header />

      {error && <ErrorBanner error={error} onDismiss={clearError} />}

      {!hasStarted ? (
        <WelcomeScreen />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-10">
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isLoading && <LoadingIndicator />}
              <div ref={scrollRef} />
            </div>
          </div>

          <ChatInput />
        </div>
      )}
    </div>
  );
}
