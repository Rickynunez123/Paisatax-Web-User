'use client';

import { useAgent } from '@/context/AgentContext';
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

function FilingStatusPicker() {
  const { startSession, isLoading } = useAgent();

  return (
    <div className="flex justify-start gap-3">
      <div className="lux-panel w-full max-w-2xl px-5 py-5 sm:px-6 sm:py-6">
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)] sm:text-3xl">
          Choose your filing status.
        </h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          You can upload documents right after.
        </p>

        <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
          {FILING_STATUSES.map((fs) => (
            <button
              key={fs.value}
              onClick={() => startSession(fs.value, fs.label)}
              disabled={isLoading}
              className="lux-button-secondary min-h-[56px] justify-center px-4 py-3 text-center text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {fs.label}
            </button>
          ))}
        </div>

        {isLoading && (
          <p className="mt-4 text-sm font-medium text-[var(--color-text-secondary)]">
            Setting up your filing session...
          </p>
        )}
      </div>
    </div>
  );
}

function EmptyStateFooter() {
  return <div className="px-4 pb-6 sm:px-6" />;
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

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-10">
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            {!hasStarted && <FilingStatusPicker />}
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isLoading && <LoadingIndicator />}
            <div ref={scrollRef} />
          </div>
        </div>

        {sessionKey ? <ChatInput /> : <EmptyStateFooter />}
      </div>
    </div>
  );
}
