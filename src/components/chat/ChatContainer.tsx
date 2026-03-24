'use client';

import { useState } from 'react';
import { useAgent } from '@/context/AgentContext';
import { useUserProfile } from '@/context/UserProfileContext';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { OnboardingProvider, useOnboarding } from '@/hooks/useOnboarding';
import Header from '@/components/layout/Header';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import HowItWorksModal from './HowItWorksModal';
import SessionListPanel from './SessionListPanel';

function AssistantAvatar() {
  return (
    <div className="mt-2 hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-background-alt)] text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-brand-strong)] sm:flex">
      PT
    </div>
  );
}

function WelcomeScreen() {
  const { mode, setMode } = useUserProfile();
  const { startOnboarding } = useOnboarding();
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const uploadHint = mode === 'business'
    ? 'Upload forms and business documents in Files or during the conversation.'
    : 'Upload tax forms in Files or during the conversation.';

  return (
    <>
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

          {/* CTA — now triggers in-chat onboarding */}
          <button
            type="button"
            onClick={startOnboarding}
            className="lux-button-primary mt-8 px-8 py-3 text-sm font-semibold"
          >
            Start New Return
          </button>

          {/* Upload hint */}
          <p className="mt-5 text-xs text-[var(--color-text-tertiary)]">
            {uploadHint}
          </p>
          <button
            type="button"
            onClick={() => setShowHowItWorks(true)}
            className="mt-3 text-xs font-medium text-[var(--color-text-tertiary)] underline decoration-[var(--color-soft-border)] underline-offset-4 transition-colors hover:text-[var(--color-text-secondary)]"
          >
            How it works
          </button>

          <SessionListPanel className="mx-auto mt-8" title="Resume Saved Return" />
        </div>
      </div>

      <HowItWorksModal open={showHowItWorks} mode={mode} onClose={() => setShowHowItWorks(false)} />
    </>
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

function ChatContainerInner() {
  const { sessionKey, messages, isLoading, error, clearError, resetSession } = useAgent();
  const { isOnboarding, resetOnboarding } = useOnboarding();
  const scrollRef = useAutoScroll([messages.length, isLoading, sessionKey]);

  // Show welcome only when no session, no onboarding, and no messages
  const hasStarted = Boolean(sessionKey || isOnboarding || messages.length > 0 || isLoading);

  const handleNewReturn = () => {
    resetSession();
    resetOnboarding();
  };

  return (
    <div className="lux-shell flex min-h-screen flex-col">
      <Header />

      {error && <ErrorBanner error={error} onDismiss={clearError} />}

      {!hasStarted ? (
        <WelcomeScreen />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Back to welcome */}
          <div className="px-4 pt-4 sm:px-6">
            <button
              onClick={handleNewReturn}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              New Return
            </button>
          </div>
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

export default function ChatContainer() {
  return (
    <OnboardingProvider>
      <ChatContainerInner />
    </OnboardingProvider>
  );
}
