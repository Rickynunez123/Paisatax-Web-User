'use client';

import { useState } from 'react';
import { useOnboarding } from '@/hooks/useOnboarding';
import { PROFILES } from '@/lib/onboarding-constants';

interface Props {
  isReturning: boolean;
  preselected: string[];
}

export default function OnboardingProfilesBlock({ isReturning, preselected }: Props) {
  const { handleProfilesComplete, skipOnboarding, step } = useOnboarding();
  const [selected, setSelected] = useState<Set<string>>(new Set(preselected));
  const [submitted, setSubmitted] = useState(false);

  if (step !== 'step_profiles') {
    if (submitted) {
      const labels = PROFILES.filter((p) => selected.has(p.id)).map((p) => p.label);
      return (
        <div className="mt-2 inline-flex flex-wrap items-center gap-1.5">
          <svg className="h-3.5 w-3.5 text-[var(--color-brand-strong)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          {labels.map((l) => (
            <span key={l} className="rounded-full border border-[var(--color-brand-strong)]/15 bg-[var(--color-brand-soft)] px-3 py-1 text-xs font-medium text-[var(--color-brand-strong)]">
              {l}
            </span>
          ))}
        </div>
      );
    }
    return null;
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = () => {
    setSubmitted(true);
    handleProfilesComplete(Array.from(selected));
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {PROFILES.map((profile) => {
          const isSelected = selected.has(profile.id);
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => toggle(profile.id)}
              disabled={submitted}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-all disabled:opacity-60 ${
                isSelected
                  ? 'bg-[var(--color-brand-soft)] ring-1 ring-[var(--color-brand-strong)]/15'
                  : 'hover:bg-[var(--color-surface-soft)]'
              }`}
            >
              <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
                isSelected
                  ? 'border-[var(--color-brand-strong)] bg-[var(--color-brand-strong)]'
                  : 'border-[var(--color-border-strong)]'
              }`}>
                {isSelected && (
                  <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--color-text-primary)]">{profile.label}</div>
                <div className="text-[11px] leading-relaxed text-[var(--color-text-tertiary)]">{profile.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 pt-1">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitted}
          className="lux-button-primary rounded-full px-6 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-55"
        >
          Continue{selected.size > 0 ? ` (${selected.size})` : ''} →
        </button>
        <button
          type="button"
          onClick={() => skipOnboarding()}
          disabled={submitted}
          className="text-xs font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] disabled:opacity-50"
        >
          Skip setup
        </button>
      </div>
    </div>
  );
}
