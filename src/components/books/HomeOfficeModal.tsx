'use client';

import { useState } from 'react';
import type { HomeOfficeEntry } from '@/lib/types';
import ModalPortal from '@/components/ui/ModalPortal';

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
    <ModalPortal>
      <div className="lux-modal-shell">
        <div className="lux-modal-backdrop" onClick={onClose} />

        <div className="lux-modal-card lux-modal-card-lg">
          <div className="lux-modal-header">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Home Office Setup</h2>
              <p className="lux-modal-subtitle">
                Choose a method and enter your workspace details for the year.
              </p>
            </div>
          </div>

          <div className="lux-modal-body">
            <div>
              <label className="lux-field-label mb-2 block">Method</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMethod('simplified')}
                  className={`rounded-[var(--radius-md)] border px-4 py-3 text-left text-sm font-medium transition-colors ${
                    method === 'simplified'
                      ? 'border-[var(--color-brand-strong)] bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-soft)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]'
                  }`}
                >
                  Simplified
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('regular')}
                  className={`rounded-[var(--radius-md)] border px-4 py-3 text-left text-sm font-medium transition-colors ${
                    method === 'regular'
                      ? 'border-[var(--color-brand-strong)] bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-soft)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]'
                  }`}
                >
                  Regular
                </button>
              </div>
            </div>

            <div className="lux-form-grid-2">
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
            </div>

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

          <div className="lux-modal-actions">
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
    </ModalPortal>
  );
}
