'use client';

import { useState, useCallback } from 'react';
import Header from '@/components/layout/Header';
import MileageEntryModal from '@/components/books/MileageEntryModal';
import HomeOfficeModal from '@/components/books/HomeOfficeModal';
import type { MileageEntry, HomeOfficeEntry } from '@/lib/types';

const IRS_MILEAGE_RATE = 0.70;

const EXPENSE_CATEGORIES = [
  'Advertising',
  'Car & Truck',
  'Commissions & Fees',
  'Contract Labor',
  'Insurance',
  'Legal & Professional',
  'Office',
  'Rent or Lease',
  'Repairs & Maintenance',
  'Supplies',
  'Taxes & Licenses',
  'Travel',
  'Meals (50%)',
  'Utilities',
  'Other',
] as const;

function getCurrentQuarter(): 1 | 2 | 3 | 4 {
  const month = new Date().getMonth();
  if (month < 3) return 1;
  if (month < 6) return 2;
  if (month < 9) return 3;
  return 4;
}

function DisabledButton({ label }: { label: string }) {
  return (
    <button
      disabled
      className="lux-button-secondary px-4 py-2 text-xs font-semibold opacity-50"
      title="Coming soon"
    >
      {label}
    </button>
  );
}

export default function BooksPage() {
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(getCurrentQuarter());
  const [mileageEntries, setMileageEntries] = useState<MileageEntry[]>([]);
  const [homeOffice, setHomeOffice] = useState<HomeOfficeEntry | null>(null);
  const [showMileage, setShowMileage] = useState(false);
  const [showHomeOffice, setShowHomeOffice] = useState(false);

  const quarterEntries = mileageEntries.filter((e) => e.quarter === quarter);
  const totalMiles = quarterEntries.reduce((sum, e) => sum + e.miles, 0);
  const totalMileageDeduction = totalMiles * IRS_MILEAGE_RATE;

  const handleAddMileage = useCallback((entry: MileageEntry) => {
    setMileageEntries((prev) => [...prev, entry]);
  }, []);

  const handleDeleteMileage = useCallback((id: string) => {
    setMileageEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return (
    <div className="lux-shell flex min-h-screen flex-col">
      <Header />

      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
          Books
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Quarterly bookkeeping for your Schedule C
        </p>

        {/* Quarter tabs */}
        <div className="mt-6 flex gap-2">
          {([1, 2, 3, 4] as const).map((q) => (
            <button
              key={q}
              onClick={() => setQuarter(q)}
              className={`rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] transition-colors ${
                quarter === q
                  ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)] border border-[var(--color-brand-strong)]'
                  : 'border border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              Q{q}
            </button>
          ))}
        </div>

        <div className="mt-8 space-y-6">
          {/* Income card */}
          <section className="lux-card-outline p-5">
            <div className="flex items-center justify-between">
              <h2 className="lux-field-label">Income</h2>
              <DisabledButton label="Add Income Entry" />
            </div>
            <div className="mt-4 space-y-3">
              {['Gross Receipts', 'Returns & Allowances', 'Gross Income'].map((label) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">{label}</span>
                  <span className="font-medium tabular-nums text-[var(--color-text-primary)]">$0.00</span>
                </div>
              ))}
            </div>
          </section>

          {/* Expenses card */}
          <section className="lux-card-outline p-5">
            <div className="flex items-center justify-between">
              <h2 className="lux-field-label">Expenses</h2>
              <DisabledButton label="Add Expense Entry" />
            </div>
            <div className="mt-4 space-y-3">
              {EXPENSE_CATEGORIES.map((cat) => (
                <div key={cat} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">{cat}</span>
                  <span className="font-medium tabular-nums text-[var(--color-text-primary)]">$0.00</span>
                </div>
              ))}
            </div>
          </section>

          {/* Mileage section */}
          <section className="lux-card-outline p-5">
            <div className="flex items-center justify-between">
              <h2 className="lux-field-label">Mileage</h2>
              <button
                onClick={() => setShowMileage(true)}
                className="lux-button-secondary px-4 py-2 text-xs font-semibold"
              >
                Log Mileage
              </button>
            </div>

            <div className="mt-4 flex gap-6">
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)]">Total miles this quarter</p>
                <p className="text-lg font-semibold tabular-nums text-[var(--color-text-primary)]">
                  {totalMiles.toLocaleString()} mi
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)]">Estimated deduction</p>
                <p className="text-lg font-semibold tabular-nums text-[var(--color-success-text)]">
                  ${totalMileageDeduction.toFixed(2)}
                </p>
              </div>
            </div>

            {quarterEntries.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--color-text-tertiary)]">
                No mileage logged for this quarter
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {quarterEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--color-surface-soft)] px-4 py-3"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-[var(--color-text-tertiary)]">{entry.date}</span>
                      <span className="text-sm text-[var(--color-text-primary)]">{entry.purpose}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm tabular-nums text-[var(--color-text-secondary)]">
                        {entry.miles} mi — ${(entry.miles * IRS_MILEAGE_RATE).toFixed(2)}
                      </span>
                      <button
                        onClick={() => handleDeleteMileage(entry.id)}
                        className="text-xs text-[var(--color-danger)] hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Home Office section */}
          <section className="lux-card-outline p-5">
            <div className="flex items-center justify-between">
              <h2 className="lux-field-label">Home Office</h2>
              <button
                onClick={() => setShowHomeOffice(true)}
                className="lux-button-secondary px-4 py-2 text-xs font-semibold"
              >
                {homeOffice ? 'Edit' : 'Configure'}
              </button>
            </div>

            {homeOffice ? (
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">Method</span>
                  <span className="font-medium capitalize text-[var(--color-text-primary)]">{homeOffice.method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">Business sq ft</span>
                  <span className="font-medium tabular-nums text-[var(--color-text-primary)]">{homeOffice.squareFootage}</span>
                </div>
                {homeOffice.method === 'simplified' && (
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">Estimated deduction</span>
                    <span className="font-medium tabular-nums text-[var(--color-success-text)]">
                      ${(Math.min(homeOffice.squareFootage, 300) * 5).toFixed(2)}
                    </span>
                  </div>
                )}
                {homeOffice.method === 'regular' && homeOffice.totalSquareFootage > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">Business use %</span>
                    <span className="font-medium tabular-nums text-[var(--color-text-primary)]">
                      {((homeOffice.squareFootage / homeOffice.totalSquareFootage) * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--color-text-tertiary)]">
                Home office not configured
              </p>
            )}
          </section>
        </div>

        {/* Quarter summary bar */}
        <div className="sticky bottom-0 mt-8 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]/92 px-5 py-4 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-6">
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)]">Net Profit</p>
                <p className="text-lg font-semibold tabular-nums text-[var(--color-text-primary)]">$0.00</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)]">Est. SE Tax</p>
                <p className="text-lg font-semibold tabular-nums text-[var(--color-text-primary)]">$0.00</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)]">Est. Quarterly Payment</p>
                <p className="text-lg font-semibold tabular-nums text-[var(--color-text-primary)]">$0.00</p>
              </div>
            </div>
            <button
              disabled
              className="lux-button-primary px-5 py-2.5 text-xs font-semibold opacity-50"
              title="Complete your quarter to generate a report"
            >
              Download Q Report
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <MileageEntryModal
        open={showMileage}
        onClose={() => setShowMileage(false)}
        onSave={handleAddMileage}
      />
      <HomeOfficeModal
        open={showHomeOffice}
        onClose={() => setShowHomeOffice(false)}
        onSave={setHomeOffice}
        existing={homeOffice}
      />
    </div>
  );
}
