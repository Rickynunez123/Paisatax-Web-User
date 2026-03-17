'use client';

import { useState } from 'react';
import type { QuickReplyOption } from '@/lib/types';
import { useAgent } from '@/context/AgentContext';

interface QuickReplyProps {
  content: string;
  options: QuickReplyOption[];
  /** If true, selecting an option sends it immediately (standalone mode). */
  standalone?: boolean;
  /** Callback for batched mode — parent collects answers. */
  onSelect?: (question: string, option: QuickReplyOption) => void;
}

export default function QuickReply({
  content,
  options,
  standalone = true,
  onSelect,
}: QuickReplyProps) {
  const { selectOption, isLoading } = useAgent();
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = async (option: QuickReplyOption) => {
    if (selected !== null && standalone) return;
    if (isLoading) return;

    setSelected(option.value);

    if (standalone && !onSelect) {
      await selectOption(option);
    } else if (onSelect) {
      onSelect(content, option);
    }
  };

  return (
    <div className="lux-panel-soft px-4 py-4 sm:px-5">
      {content && (
        <p className="mb-3 text-sm font-medium leading-6 text-[var(--color-text-primary)]">
          {content}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => handleSelect(option)}
            disabled={(standalone && selected !== null) || isLoading}
            className={`rounded-full border px-4 py-2.5 text-sm font-medium transition-all ${
              selected === option.value
                ? 'border-[var(--color-brand-strong)] bg-[var(--color-brand-strong)] text-white shadow-[var(--shadow-brand)]'
                : selected !== null && standalone
                  ? 'cursor-default border-[var(--color-border)] bg-[var(--color-surface-soft)] text-[var(--color-text-tertiary)] opacity-55'
                  : 'border-[var(--color-border)] bg-[var(--color-background-alt)] text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-brand-soft)]'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
