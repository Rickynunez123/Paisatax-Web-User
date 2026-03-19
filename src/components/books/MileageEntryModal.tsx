'use client';

import { useState } from 'react';
import type { MileageEntry } from '@/lib/types';

const IRS_MILEAGE_RATE_2025 = 0.70;

function getQuarterFromDate(dateStr: string): 1 | 2 | 3 | 4 {
  const month = new Date(dateStr).getMonth(); // 0-11
  if (month < 3) return 1;
  if (month < 6) return 2;
  if (month < 9) return 3;
  return 4;
}

interface MileageEntryModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (entry: MileageEntry) => void;
}

export default function MileageEntryModal({ open, onClose, onSave }: MileageEntryModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [miles, setMiles] = useState('');
  const [purpose, setPurpose] = useState('');

  if (!open) return null;

  const milesNum = parseFloat(miles) || 0;
  const deduction = milesNum * IRS_MILEAGE_RATE_2025;
  const quarter = getQuarterFromDate(date);
  const year = date.slice(0, 4);

  const handleSave = () => {
    if (milesNum <= 0) return;
    onSave({
      id: `mil_${Date.now()}`,
      date,
      miles: milesNum,
      purpose: purpose.trim() || 'Business travel',
      quarter,
      year,
    });
    // Reset
    setDate(today);
    setMiles('');
    setPurpose('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-[var(--color-overlay)]" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] p-6 shadow-[var(--shadow-md)]">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Log Mileage</h2>

        <div className="mt-5 space-y-4">
          {/* Date */}
          <div>
            <label className="lux-field-label mb-1.5 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="lux-input"
            />
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
              This entry will be logged to Q{quarter} {year}.
            </p>
          </div>

          {/* Miles */}
          <div>
            <label className="lux-field-label mb-1.5 block">Miles driven</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={miles}
              onChange={(e) => setMiles(e.target.value)}
              placeholder="0"
              className="lux-input"
            />
          </div>

          {/* Purpose */}
          <div>
            <label className="lux-field-label mb-1.5 block">Purpose</label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Client meeting, supply run"
              className="lux-input"
            />
          </div>

          {/* Deduction preview */}
          {milesNum > 0 && (
            <div className="rounded-[var(--radius-sm)] bg-[var(--color-success-soft)] px-4 py-3 text-sm font-medium text-[var(--color-success-text)]">
              Estimated deduction: ${deduction.toFixed(2)}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="lux-button-secondary px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={milesNum <= 0}
            className="lux-button-primary px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save Entry
          </button>
        </div>
      </div>
    </div>
  );
}
