'use client';

import { useState } from 'react';
import { useOnboarding } from '@/hooks/useOnboarding';

interface FileEntry {
  fileId: string;
  displayName: string;
  formId: string | null;
}

interface Props {
  files: FileEntry[];
}

/** Friendly label from a formId like "w2" → "W-2", "1099_nec" → "1099-NEC" */
function formLabel(formId: string | null): string | null {
  if (!formId) return null;
  const map: Record<string, string> = {
    w2: 'W-2',
    '1099_nec': '1099-NEC',
    '1099_int': '1099-INT',
    '1099_div': '1099-DIV',
    '1099_misc': '1099-MISC',
    '1099_k': '1099-K',
    '1099_r': '1099-R',
    '1099_g': '1099-G',
    '1098': '1098',
    '1098_t': '1098-T',
    '1098_e': '1098-E',
  };
  return map[formId.toLowerCase()] ?? formId.toUpperCase().replace(/_/g, '-');
}

/** Icon color for different document types */
function formColor(formId: string | null): string {
  if (!formId) return 'var(--color-text-tertiary)';
  const lower = formId.toLowerCase();
  if (lower.startsWith('w2')) return '#3b82f6';       // blue
  if (lower.includes('1099')) return '#8b5cf6';        // purple
  if (lower.includes('1098')) return '#06b6d4';        // cyan
  if (lower.includes('receipt')) return '#f59e0b';     // amber
  return 'var(--color-brand-strong)';
}

export default function OnboardingFilesBlock({ files }: Props) {
  const { handleFilesComplete, step } = useOnboarding();
  const [selected, setSelected] = useState<Set<string>>(new Set(files.map((f) => f.fileId)));
  const [submitted, setSubmitted] = useState(false);

  if (step !== 'step_files') {
    if (submitted) {
      const count = selected.size;
      return (
        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[var(--color-brand-strong)]/15 bg-[var(--color-brand-soft)] px-4 py-1.5">
          <svg className="h-3.5 w-3.5 text-[var(--color-brand-strong)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          <span className="text-sm font-medium text-[var(--color-brand-strong)]">
            {count} document{count === 1 ? '' : 's'} selected
          </span>
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

  const selectAll = () => setSelected(new Set(files.map((f) => f.fileId)));
  const selectNone = () => setSelected(new Set());

  const handleSubmit = () => {
    setSubmitted(true);
    handleFilesComplete(selected);
  };

  return (
    <div className="mt-3 space-y-3">
      {/* Select all / none */}
      <div className="flex items-center gap-3 text-xs text-[var(--color-text-tertiary)]">
        <button type="button" onClick={selectAll} disabled={submitted} className="font-medium hover:text-[var(--color-text-secondary)] disabled:opacity-50">
          Select all
        </button>
        <span>·</span>
        <button type="button" onClick={selectNone} disabled={submitted} className="font-medium hover:text-[var(--color-text-secondary)] disabled:opacity-50">
          None
        </button>
      </div>

      {/* File list */}
      <div className="space-y-1">
        {files.map((file) => {
          const isSelected = selected.has(file.fileId);
          const label = formLabel(file.formId);
          const color = formColor(file.formId);
          return (
            <button
              key={file.fileId}
              type="button"
              onClick={() => toggle(file.fileId)}
              disabled={submitted}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-all disabled:opacity-60 ${
                isSelected
                  ? 'bg-[var(--color-brand-soft)] ring-1 ring-[var(--color-brand-strong)]/15'
                  : 'hover:bg-[var(--color-surface-soft)]'
              }`}
            >
              {/* Checkbox */}
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

              {/* File icon */}
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}15` }}>
                <svg className="h-4 w-4" style={{ color }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </span>

              {/* File info */}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                  {file.displayName}
                </div>
                {label && (
                  <div className="text-xs text-[var(--color-text-tertiary)]">{label}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 pt-1">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitted}
          className="lux-button-primary rounded-full px-6 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-55"
        >
          {selected.size > 0 ? `Use ${selected.size} document${selected.size === 1 ? '' : 's'} →` : 'Skip documents →'}
        </button>
      </div>
    </div>
  );
}
