'use client';

import { useState } from 'react';
import { useOnboarding } from '@/hooks/useOnboarding';
import {
  IDENTITY_FIELDS,
  SPOUSE_FIELDS,
  DEPENDENT_FIELDS,
  RELATIONSHIP_OPTIONS,
} from '@/lib/onboarding-constants';

interface Props {
  isReturning: boolean;
  showSpouse: boolean;
  showDependents: boolean;
  prefilled: {
    primary: Record<string, string>;
    spouse: Record<string, string>;
    dependents: Array<Record<string, string>>;
  };
}

function FieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: { key: string; label: string; placeholder: string; type?: string };
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className={field.key === 'street' ? 'sm:col-span-2' : ''}>
      <label className="mb-1 block text-xs font-medium text-[var(--color-text-tertiary)]">
        {field.label}
      </label>
      <input
        type={(field as any).type ?? 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]/50 transition-colors focus:border-[var(--color-brand-strong)] focus:ring-1 focus:ring-[var(--color-brand-strong)]/20 focus:outline-none disabled:opacity-50"
      />
    </div>
  );
}

function ReadOnlySummary({
  fields,
  data,
  onEdit,
}: {
  fields: ReadonlyArray<{ key: string; label: string; placeholder: string }>;
  data: Record<string, string>;
  onEdit: () => void;
}) {
  const filled = fields.filter((f) => data[f.key]?.trim());
  if (filled.length === 0) return null;

  return (
    <div className="rounded-xl bg-[var(--color-surface-soft)] px-4 py-3">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
        {filled.map((f) => (
          <div key={f.key}>
            <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
              {f.label}
            </div>
            <div className="mt-0.5 text-sm text-[var(--color-text-primary)]">
              {f.key === 'ssn' ? '***-**-' + (data[f.key]?.slice(-4) ?? '****') : data[f.key]}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="mt-2 text-xs font-medium text-[var(--color-brand-strong)] hover:underline"
      >
        Edit
      </button>
    </div>
  );
}

const EMPTY_DEP: Record<string, string> = {
  firstName: '', lastName: '', ssn: '', birthday: '', relationship: '',
};

export default function OnboardingIdentityBlock({ isReturning, showSpouse, showDependents, prefilled }: Props) {
  const { handleIdentityComplete, skipOnboarding, step } = useOnboarding();

  const [primary, setPrimary] = useState<Record<string, string>>(prefilled.primary);
  const [spouse, setSpouse] = useState<Record<string, string>>(prefilled.spouse);
  const [dependents, setDependents] = useState<Array<Record<string, string>>>(
    prefilled.dependents.length > 0 ? prefilled.dependents : (showDependents ? [{ ...EMPTY_DEP }] : []),
  );
  const [submitted, setSubmitted] = useState(false);

  const primaryHasData = IDENTITY_FIELDS.some((f) => prefilled.primary[f.key]?.trim());
  const spouseHasData = SPOUSE_FIELDS.some((f) => prefilled.spouse[f.key]?.trim());

  const [editingPrimary, setEditingPrimary] = useState(!primaryHasData);
  const [editingSpouse, setEditingSpouse] = useState(!spouseHasData);

  if (step !== 'step_identity') {
    if (submitted) {
      const name = primary.firstName
        ? `${primary.firstName} ${primary.lastName ?? ''}`.trim()
        : 'Identity confirmed';
      return (
        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[var(--color-brand-strong)]/15 bg-[var(--color-brand-soft)] px-4 py-1.5">
          <svg className="h-3.5 w-3.5 text-[var(--color-brand-strong)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          <span className="text-sm font-medium text-[var(--color-brand-strong)]">{name}</span>
        </div>
      );
    }
    return null;
  }

  const updatePrimary = (key: string, value: string) => setPrimary((p) => ({ ...p, [key]: value }));
  const updateSpouse = (key: string, value: string) => setSpouse((p) => ({ ...p, [key]: value }));
  const updateDependent = (idx: number, key: string, value: string) => {
    setDependents((prev) => prev.map((d, i) => (i === idx ? { ...d, [key]: value } : d)));
  };
  const addDependent = () => setDependents((prev) => [...prev, { ...EMPTY_DEP }]);
  const removeDependent = (idx: number) => setDependents((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = () => {
    setSubmitted(true);
    handleIdentityComplete(primary, spouse, dependents.filter((d) => d.firstName?.trim()));
  };

  return (
    <div className="mt-3 space-y-5">
      {/* Primary taxpayer */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-[var(--color-text-tertiary)]">Primary Taxpayer</div>

        {!editingPrimary && primaryHasData ? (
          <ReadOnlySummary fields={IDENTITY_FIELDS} data={primary} onEdit={() => setEditingPrimary(true)} />
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {IDENTITY_FIELDS.map((field) => (
              <FieldInput
                key={field.key}
                field={field}
                value={primary[field.key] ?? ''}
                onChange={(v) => updatePrimary(field.key, v)}
                disabled={submitted}
              />
            ))}
          </div>
        )}
      </div>

      {/* Spouse */}
      {showSpouse && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-[var(--color-text-tertiary)]">Spouse</div>

          {!editingSpouse && spouseHasData ? (
            <ReadOnlySummary fields={SPOUSE_FIELDS} data={spouse} onEdit={() => setEditingSpouse(true)} />
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {SPOUSE_FIELDS.map((field) => (
                <FieldInput
                  key={`spouse_${field.key}`}
                  field={field}
                  value={spouse[field.key] ?? ''}
                  onChange={(v) => updateSpouse(field.key, v)}
                  disabled={submitted}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dependents */}
      {showDependents && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-[var(--color-text-tertiary)]">Dependents</div>
          <div className="space-y-3">
            {dependents.map((dep, idx) => (
              <div key={idx} className="rounded-xl bg-[var(--color-surface-soft)] p-3.5">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                    Dependent {idx + 1}
                  </span>
                  {dependents.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDependent(idx)}
                      disabled={submitted}
                      className="text-xs text-[var(--color-text-tertiary)] hover:text-red-500 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {DEPENDENT_FIELDS.map((field) => (
                    field.key === 'relationship' ? (
                      <div key={field.key}>
                        <label className="mb-1 block text-xs font-medium text-[var(--color-text-tertiary)]">
                          {field.label}
                        </label>
                        <select
                          value={dep[field.key] ?? ''}
                          onChange={(e) => updateDependent(idx, field.key, e.target.value)}
                          disabled={submitted}
                          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] transition-colors focus:border-[var(--color-brand-strong)] focus:ring-1 focus:ring-[var(--color-brand-strong)]/20 focus:outline-none disabled:opacity-50"
                        >
                          <option value="">Select...</option>
                          {RELATIONSHIP_OPTIONS.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <FieldInput
                        key={field.key}
                        field={field}
                        value={dep[field.key] ?? ''}
                        onChange={(v) => updateDependent(idx, field.key, v)}
                        disabled={submitted}
                      />
                    )
                  ))}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addDependent}
              disabled={submitted}
              className="text-xs font-medium text-[var(--color-brand-strong)] hover:underline disabled:opacity-50"
            >
              + Add another dependent
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-1">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitted}
          className="lux-button-primary rounded-full px-6 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-55"
        >
          {isReturning && primaryHasData ? 'Looks good — Start Filing →' : 'Confirm & Start Filing →'}
        </button>
        <button
          type="button"
          onClick={() => skipOnboarding()}
          disabled={submitted}
          className="text-xs font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] disabled:opacity-50"
        >
          Skip — I'll tell the assistant
        </button>
      </div>
    </div>
  );
}
