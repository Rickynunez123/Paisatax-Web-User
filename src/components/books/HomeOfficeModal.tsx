'use client';

import { useState } from 'react';
import type { HomeOfficeEntry } from '@/lib/types';

const SIMPLIFIED_RATE = 5;
const MAX_SQFT = 300;

interface HomeOfficeModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (entry: HomeOfficeEntry) => void;
  existing?: HomeOfficeEntry | null;
}

export default function HomeOfficeModal({ open, onClose, onSave, existing }: HomeOfficeModalProps) {
  const [method, setMethod] = useState<'simplified' | 'regular'>(existing?.method ?? 'simplified');
  const [sqft, setSqft] = useState(existing?.squareFootage?.toString() ?? '');
  const [totalSqft, setTotalSqft] = useState(existing?.totalSquareFootage?.toString() ?? '');

  if (!open) return null;

  const sqftNum = parseFloat(sqft) || 0;
  const totalSqftNum = parseFloat(totalSqft) || 0;

  const simplifiedDeduction = Math.min(sqftNum, MAX_SQFT) * SIMPLIFIED_RATE;
  const businessPct = totalSqftNum > 0 ? ((sqftNum / totalSqftNum) * 100) : 0;

  const handleSave = () => {
    if (sqftNum <= 0) return;
    onSave({
      squareFootage: sqftNum,
      totalSquareFootage: method === 'regular' ? totalSqftNum : 0,
      method,
      year: new Date().getFullYear().toString(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-[var(--color-overlay)]" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] p-6 shadow-[var(--shadow-md)]">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Home Office Setup</h2>

        <div className="mt-5 space-y-4">
          {/* Method toggle */}
          <div>
            <label className="lux-field-label mb-1.5 block">Method</label>
            <div className="flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-background-alt)]/72">
              <button
                onClick={() => setMethod('simplified')}
                className={`flex-1 rounded-full px-4 py-2 text-xs font-medium tracking-[0.08em] transition-colors ${
                  method === 'simplified'
                    ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]'
                    : 'text-[var(--color-text-tertiary)]'
                }`}
              >
                Simplified
              </button>
              <button
                onClick={() => setMethod('regular')}
                className={`flex-1 rounded-full px-4 py-2 text-xs font-medium tracking-[0.08em] transition-colors ${
                  method === 'regular'
                    ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]'
                    : 'text-[var(--color-text-tertiary)]'
                }`}
              >
                Regular
              </button>
            </div>
          </div>

          {/* Business sqft */}
          <div>
            <label className="lux-field-label mb-1.5 block">Business-use square footage</label>
            <input
              type="number"
              min="0"
              value={sqft}
              onChange={(e) => setSqft(e.target.value)}
              placeholder="0"
              className="lux-input"
            />
          </div>

          {/* Total sqft — regular only */}
          {method === 'regular' && (
            <div>
              <label className="lux-field-label mb-1.5 block">Total home square footage</label>
              <input
                type="number"
                min="0"
                value={totalSqft}
                onChange={(e) => setTotalSqft(e.target.value)}
                placeholder="0"
                className="lux-input"
              />
            </div>
          )}

          {/* Preview */}
          {sqftNum > 0 && (
            <div className="rounded-[var(--radius-sm)] bg-[var(--color-success-soft)] px-4 py-3 text-sm font-medium text-[var(--color-success-text)]">
              {method === 'simplified' ? (
                <>Estimated deduction: ${simplifiedDeduction.toFixed(2)} (max $1,500)</>
              ) : (
                <>Business use: {businessPct.toFixed(1)}% — actual deduction calculated from your home expenses</>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button onClick={onClose} className="lux-button-secondary px-4 py-2 text-sm font-semibold">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={sqftNum <= 0}
            className="lux-button-primary px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
