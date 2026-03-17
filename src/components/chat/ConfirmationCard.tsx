'use client';

import { useState } from 'react';
import { useAgent } from '@/context/AgentContext';

interface ConfirmationCardProps {
  content: string;
  fields: Array<{ label: string; value: string | number | boolean; nodeId: string }>;
}

export default function ConfirmationCard({ content, fields }: ConfirmationCardProps) {
  const { reviewFields, isLoading } = useAgent();
  const [checked, setChecked] = useState<Set<string>>(new Set(fields.map((f) => f.nodeId)));
  const [submitted, setSubmitted] = useState(false);

  const toggle = (nodeId: string) => {
    if (submitted) return;
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (submitted || isLoading) return;
    setSubmitted(true);
    const confirmed = fields
      .filter((f) => checked.has(f.nodeId))
      .map((f) => ({ nodeId: f.nodeId, value: f.value }));
    const rejected = fields.filter((f) => !checked.has(f.nodeId)).map((f) => f.nodeId);
    await reviewFields(confirmed, rejected);
  };

  const handleSelectAll = () => {
    if (submitted) return;
    setChecked(new Set(fields.map((f) => f.nodeId)));
  };

  const handleDeselectAll = () => {
    if (submitted) return;
    setChecked(new Set());
  };

  return (
    <div className="lux-panel-soft px-4 py-4 sm:px-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{content}</p>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
            Confirm the values you want applied to the return.
          </p>
        </div>
        <div className="rounded-full border border-[var(--color-border)] bg-[var(--color-background-alt)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
          {checked.size}/{fields.length}
        </div>
      </div>

      <div className="mt-4 flex gap-3 text-xs text-[var(--color-text-secondary)]">
        <button onClick={handleSelectAll} disabled={submitted} className="font-semibold hover:underline">
          Select all
        </button>
        <span className="text-[var(--color-text-tertiary)]">|</span>
        <button onClick={handleDeselectAll} disabled={submitted} className="font-semibold hover:underline">
          Deselect all
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {fields.map((field) => (
          <label
            key={field.nodeId}
            className={`flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background-alt)] px-3 py-3 text-sm ${
              submitted ? 'opacity-70' : 'cursor-pointer hover:border-[var(--color-border-strong)] hover:bg-[var(--color-brand-soft)]'
            }`}
          >
            <input
              type="checkbox"
              checked={checked.has(field.nodeId)}
              onChange={() => toggle(field.nodeId)}
              disabled={submitted}
              className="h-4 w-4 rounded accent-[var(--color-brand-strong)]"
            />
            <span className="flex-1 text-[var(--color-text-secondary)]">{field.label}</span>
            <span className="font-semibold text-[var(--color-text-primary)]">{String(field.value)}</span>
          </label>
        ))}
      </div>

      {!submitted && (
        <button
          onClick={handleConfirm}
          disabled={isLoading || checked.size === 0}
          className="lux-button-primary mt-4 w-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          Confirm {checked.size} of {fields.length} values
        </button>
      )}

      {submitted && (
        <p className="mt-4 rounded-2xl border border-[var(--color-success-border)] bg-[var(--color-success-soft)] px-4 py-3 text-center text-xs font-semibold text-[var(--color-success-text)]">
          Values confirmed
        </p>
      )}
    </div>
  );
}
