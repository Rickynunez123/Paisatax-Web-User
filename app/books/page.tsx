'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/layout/Header';
import MileageEntryModal from '@/components/books/MileageEntryModal';
import HomeOfficeModal from '@/components/books/HomeOfficeModal';
import ModalPortal from '@/components/ui/ModalPortal';
import { useAuth } from '@/context/AuthContext';
import type { MileageEntry, HomeOfficeEntry, BookkeepingNodeAssignment } from '@/lib/types';
import {
  getBooksSummary,
  saveMileageEntries,
  getMileageEntries,
  saveHomeOffice,
  getHomeOffice,
  saveManualEntries,
  getManualEntries,
  getQuarterlyReportUrl,
  type BooksSummary,
} from '@/lib/files-api';

function getCurrentQuarter(): 1 | 2 | 3 | 4 {
  const month = new Date().getMonth();
  if (month < 3) return 1;
  if (month < 6) return 2;
  if (month < 9) return 3;
  return 4;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// ─── Income/Expense categories for manual entry modal ────────────────────────

const INCOME_CATEGORIES = [
  { nodeSuffix: 'line1_grossReceipts', label: 'Gross Receipts / Sales' },
  { nodeSuffix: 'line2_returnsAllowances', label: 'Returns & Allowances' },
  { nodeSuffix: 'line6_otherIncome', label: 'Other Business Income' },
] as const;

const EXPENSE_CATEGORIES = [
  { nodeSuffix: 'line8_advertising', label: 'Advertising' },
  { nodeSuffix: 'line10_commissionsFees', label: 'Commissions & Fees' },
  { nodeSuffix: 'line11_contractLabor', label: 'Contract Labor' },
  { nodeSuffix: 'line15_insurance', label: 'Insurance' },
  { nodeSuffix: 'line17_legalProfessional', label: 'Legal & Professional' },
  { nodeSuffix: 'line18_officeExpense', label: 'Office Expense' },
  { nodeSuffix: 'line20b_rentLeaseOther', label: 'Rent / Lease' },
  { nodeSuffix: 'line21_repairs', label: 'Repairs & Maintenance' },
  { nodeSuffix: 'line22_supplies', label: 'Supplies' },
  { nodeSuffix: 'line23_taxesLicenses', label: 'Taxes & Licenses' },
  { nodeSuffix: 'line24a_travel', label: 'Travel' },
  { nodeSuffix: 'line24b_mealsWithoutLimit', label: 'Meals (50%)' },
  { nodeSuffix: 'line25_utilities', label: 'Utilities' },
  { nodeSuffix: 'line26_wages', label: 'Wages' },
  { nodeSuffix: 'line27a_otherExpenses', label: 'Other Expenses' },
] as const;

// ─── Manual Entry Modal ──────────────────────────────────────────────────────

interface ManualEntryModalProps {
  open: boolean;
  type: 'income' | 'expense';
  quarter: 1 | 2 | 3 | 4;
  year: string;
  onClose: () => void;
  onSave: (entry: BookkeepingNodeAssignment) => void;
}

function ManualEntryModal({ open, type, quarter, year, onClose, onSave }: ManualEntryModalProps) {
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const [category, setCategory] = useState<string>(categories[0].nodeSuffix);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  if (!open) return null;

  const amountNum = parseFloat(amount) || 0;
  const selectedCat = categories.find(c => c.nodeSuffix === category);

  const handleSave = () => {
    if (amountNum <= 0) return;
    const nodeId = `bk.${year}.q${quarter}.schedC.${category}`;
    onSave({
      rawDescription: description.trim() || selectedCat?.label || 'Manual entry',
      extractedAmount: amountNum,
      extractedDate: date,
      assignedNodeId: nodeId,
      assignedCategory: selectedCat?.label || category,
      isIncome: type === 'income',
      confidence: 1.0,
      needsReview: false,
    });
    setAmount('');
    setDescription('');
    setDate(new Date().toISOString().slice(0, 10));
    onClose();
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className="lux-panel relative z-10 w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto p-6 sm:-translate-y-4 sm:p-7">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Add {type === 'income' ? 'Income' : 'Expense'} Entry
        </h2>

        <div className="mt-5 space-y-4">
          <div>
            <label className="lux-field-label mb-1.5 block">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="lux-input"
            >
              {categories.map(c => (
                <option key={c.nodeSuffix} value={c.nodeSuffix}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="lux-field-label mb-1.5 block">Amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="lux-input"
            />
          </div>

          <div>
            <label className="lux-field-label mb-1.5 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="lux-input"
            />
          </div>

          <div>
            <label className="lux-field-label mb-1.5 block">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Office supplies from Staples"
              className="lux-input"
            />
          </div>

          {amountNum > 0 && (
            <div className={`rounded-[var(--radius-sm)] px-4 py-3 text-sm font-medium ${
              type === 'income'
                ? 'bg-[var(--color-success-soft)] text-[var(--color-success-text)]'
                : 'bg-[var(--color-surface-soft)] text-[var(--color-text-secondary)]'
            }`}>
              {fmt(amountNum)} — {selectedCat?.label} (Q{quarter})
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button onClick={onClose} className="lux-button-secondary px-4 py-2 text-sm font-semibold">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={amountNum <= 0}
            className="lux-button-primary px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save Entry
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

// ─── Main Books Page ─────────────────────────────────────────────────────────

export default function BooksPage() {
  const { user } = useAuth();
  const userId = user?.userId ?? 'dev-user-local';
  const year = new Date().getFullYear().toString();

  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(getCurrentQuarter());
  const [summary, setSummary] = useState<BooksSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // All mileage entries (all quarters)
  const [allMileage, setAllMileage] = useState<MileageEntry[]>([]);
  const [homeOffice, setHomeOffice] = useState<HomeOfficeEntry | null>(null);
  const [allManualEntries, setAllManualEntries] = useState<BookkeepingNodeAssignment[]>([]);

  // Modals
  const [showMileage, setShowMileage] = useState(false);
  const [showHomeOffice, setShowHomeOffice] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState<'income' | 'expense' | null>(null);

  // ─── Load data ────────────────────────────────────────────────────────────

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBooksSummary(userId, quarter, year);
      setSummary(data);
    } catch (err) {
      console.error('[books] Failed to load summary:', err);
      setError('Failed to load bookkeeping data');
    } finally {
      setLoading(false);
    }
  }, [userId, quarter, year]);

  const loadPersistedData = useCallback(async () => {
    try {
      const [mileage, ho, manual] = await Promise.all([
        getMileageEntries(userId),
        getHomeOffice(userId),
        getManualEntries(userId),
      ]);
      setAllMileage(mileage);
      setHomeOffice(ho);
      setAllManualEntries(manual);
    } catch (err) {
      console.error('[books] Failed to load persisted data:', err);
    }
  }, [userId]);

  useEffect(() => {
    loadPersistedData();
  }, [loadPersistedData]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // ─── Mileage handlers ────────────────────────────────────────────────────

  const handleAddMileage = useCallback(async (entry: MileageEntry) => {
    const updated = [...allMileage, entry];
    setAllMileage(updated);
    await saveMileageEntries(userId, updated);
    loadSummary();
  }, [allMileage, userId, loadSummary]);

  const handleDeleteMileage = useCallback(async (id: string) => {
    const updated = allMileage.filter(e => e.id !== id);
    setAllMileage(updated);
    await saveMileageEntries(userId, updated);
    loadSummary();
  }, [allMileage, userId, loadSummary]);

  // ─── Home office handler ─────────────────────────────────────────────────

  const handleSaveHomeOffice = useCallback(async (entry: HomeOfficeEntry) => {
    setHomeOffice(entry);
    await saveHomeOffice(userId, entry);
    loadSummary();
  }, [userId, loadSummary]);

  // ─── Manual entry handlers ───────────────────────────────────────────────

  const handleAddManualEntry = useCallback(async (entry: BookkeepingNodeAssignment) => {
    const updated = [...allManualEntries, entry];
    setAllManualEntries(updated);
    await saveManualEntries(userId, updated);
    loadSummary();
  }, [allManualEntries, userId, loadSummary]);

  const handleDeleteManualEntry = useCallback(async (index: number) => {
    const updated = allManualEntries.filter((_, i) => i !== index);
    setAllManualEntries(updated);
    await saveManualEntries(userId, updated);
    loadSummary();
  }, [allManualEntries, userId, loadSummary]);

  // ─── Derived data ────────────────────────────────────────────────────────

  const quarterMileage = allMileage.filter(e => e.quarter === quarter && e.year === year);
  const quarterManual = allManualEntries.filter(e => e.assignedNodeId.includes(`.q${quarter}.`));
  const quarterManualIncome = quarterManual.filter(e => e.isIncome);
  const quarterManualExpenses = quarterManual.filter(e => !e.isIncome);

  const hasData = summary && (
    summary.income.grossReceipts > 0 ||
    summary.income.otherIncome > 0 ||
    summary.totalExpenses > 0 ||
    (summary.mileage?.totalMiles ?? 0) > 0 ||
    summary.homeOffice !== null
  );

  const mileageRate = summary?.mileage?.ratePerMile ?? 0.70;

  // ─── Download handler ─────────────────────────────────────────────────────

  const handleDownloadReport = () => {
    const url = getQuarterlyReportUrl(userId, quarter);
    window.open(url, '_blank');
  };

  return (
    <div className="lux-shell flex min-h-screen flex-col">
      <Header />

      <div className="mx-auto w-full max-w-4xl flex-1 px-4 pt-8 pb-44 sm:px-6 sm:pb-48">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
          Books
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Quarterly bookkeeping for your Schedule C
        </p>

        {/* Quarter tabs */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
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

        {/* Loading / Error */}
        {loading && (
          <div className="mt-12 flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-brand-strong)] border-t-transparent" />
            <span className="ml-3 text-sm text-[var(--color-text-tertiary)]">Loading books...</span>
          </div>
        )}

        {error && (
          <div className="mt-8 rounded-[var(--radius-sm)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="mt-8 space-y-6">

            {/* Income card */}
            <section className="lux-card-outline p-5">
              <div className="flex items-center justify-between">
                <h2 className="lux-field-label">Income</h2>
                <button
                  onClick={() => setShowManualEntry('income')}
                  className="lux-button-secondary px-4 py-2 text-xs font-semibold"
                >
                  Add Income
                </button>
              </div>

              {(summary?.income.grossReceipts ?? 0) > 0 || (summary?.income.otherIncome ?? 0) > 0 || quarterManualIncome.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {(summary?.income.grossReceipts ?? 0) > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--color-text-secondary)]">Gross Receipts</span>
                      <span className="font-medium tabular-nums text-[var(--color-success-text)]">
                        {fmt(summary!.income.grossReceipts)}
                      </span>
                    </div>
                  )}
                  {(summary?.income.returnsAllowances ?? 0) > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--color-text-secondary)]">Returns & Allowances</span>
                      <span className="font-medium tabular-nums text-[var(--color-danger)]">
                        -{fmt(summary!.income.returnsAllowances)}
                      </span>
                    </div>
                  )}
                  {(summary?.income.otherIncome ?? 0) > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--color-text-secondary)]">Other Business Income</span>
                      <span className="font-medium tabular-nums text-[var(--color-success-text)]">
                        {fmt(summary!.income.otherIncome)}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-[var(--color-border)] pt-2">
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span className="text-[var(--color-text-primary)]">Gross Income</span>
                      <span className="tabular-nums text-[var(--color-text-primary)]">
                        {fmt(summary?.income.grossIncome ?? 0)}
                      </span>
                    </div>
                  </div>

                  {/* Manual income entries */}
                  {quarterManualIncome.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-medium text-[var(--color-text-tertiary)]">Manual entries</p>
                      {quarterManualIncome.map((e, i) => {
                        const globalIdx = allManualEntries.indexOf(e);
                        return (
                          <div key={i} className="flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--color-surface-soft)] px-3 py-2 text-xs">
                            <span className="text-[var(--color-text-secondary)]">
                              {e.extractedDate} — {e.rawDescription}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium tabular-nums text-[var(--color-success-text)]">
                                {fmt(e.extractedAmount ?? 0)}
                              </span>
                              <button
                                onClick={() => handleDeleteManualEntry(globalIdx)}
                                className="text-[var(--color-danger)] hover:underline"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm text-[var(--color-text-tertiary)]">
                  No income recorded for Q{quarter}. Upload invoices or add entries manually.
                </p>
              )}
            </section>

            {/* Expenses card */}
            <section className="lux-card-outline p-5">
              <div className="flex items-center justify-between">
                <h2 className="lux-field-label">Expenses</h2>
                <button
                  onClick={() => setShowManualEntry('expense')}
                  className="lux-button-secondary px-4 py-2 text-xs font-semibold"
                >
                  Add Expense
                </button>
              </div>

              {(summary?.expenses?.length ?? 0) > 0 || quarterManualExpenses.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {summary?.expenses.map((exp) => (
                    <div key={exp.lineId} className="flex items-center justify-between text-sm">
                      <span className="text-[var(--color-text-secondary)]">{exp.label}</span>
                      <span className="font-medium tabular-nums text-[var(--color-text-primary)]">
                        {fmt(exp.amount)}
                      </span>
                    </div>
                  ))}

                  {(summary?.totalExpenses ?? 0) > 0 && (
                    <div className="border-t border-[var(--color-border)] pt-2">
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <span className="text-[var(--color-text-primary)]">Total Expenses</span>
                        <span className="tabular-nums text-[var(--color-text-primary)]">
                          {fmt(summary!.totalExpenses)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Manual expense entries */}
                  {quarterManualExpenses.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-medium text-[var(--color-text-tertiary)]">Manual entries</p>
                      {quarterManualExpenses.map((e, i) => {
                        const globalIdx = allManualEntries.indexOf(e);
                        return (
                          <div key={i} className="flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--color-surface-soft)] px-3 py-2 text-xs">
                            <span className="text-[var(--color-text-secondary)]">
                              {e.extractedDate} — {e.rawDescription}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium tabular-nums text-[var(--color-text-primary)]">
                                {fmt(e.extractedAmount ?? 0)}
                              </span>
                              <button
                                onClick={() => handleDeleteManualEntry(globalIdx)}
                                className="text-[var(--color-danger)] hover:underline"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm text-[var(--color-text-tertiary)]">
                  No expenses recorded for Q{quarter}. Upload receipts or add entries manually.
                </p>
              )}
            </section>

            {/* Mileage detail (only if entries exist) */}
            {quarterMileage.length > 0 && (
              <section className="lux-card-outline p-5">
                <div className="flex items-center justify-between">
                  <h2 className="lux-field-label">Mileage Log — Q{quarter}</h2>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="tabular-nums text-[var(--color-text-secondary)]">
                      {quarterMileage.reduce((s, e) => s + e.miles, 0).toLocaleString()} mi
                    </span>
                    <span className="font-medium tabular-nums text-[var(--color-success-text)]">
                      {fmt(quarterMileage.reduce((s, e) => s + e.miles, 0) * mileageRate)}
                    </span>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  {quarterMileage.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--color-surface-soft)] px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[var(--color-text-tertiary)]">{entry.date}</span>
                        <span className="text-[var(--color-text-primary)]">{entry.purpose}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="tabular-nums text-[var(--color-text-secondary)]">
                          {entry.miles} mi — {fmt(entry.miles * mileageRate)}
                        </span>
                        <button
                          onClick={() => handleDeleteMileage(entry.id)}
                          className="text-[var(--color-danger)] hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Home office detail (only if configured) */}
            {homeOffice && (
              <section className="lux-card-outline p-5">
                <div className="flex items-center justify-between">
                  <h2 className="lux-field-label">Home Office</h2>
                  <button
                    onClick={() => setShowHomeOffice(true)}
                    className="text-xs font-medium text-[var(--color-brand-strong)] hover:underline"
                  >
                    Edit
                  </button>
                </div>
                <div className="mt-3 flex gap-6 text-sm">
                  <div>
                    <p className="text-xs text-[var(--color-text-tertiary)]">Method</p>
                    <p className="font-medium capitalize text-[var(--color-text-primary)]">{homeOffice.method}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-text-tertiary)]">Business sq ft</p>
                    <p className="font-medium tabular-nums text-[var(--color-text-primary)]">{homeOffice.squareFootage}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-text-tertiary)]">Deduction</p>
                    <p className="font-medium tabular-nums text-[var(--color-success-text)]">
                      {homeOffice.method === 'simplified'
                        ? fmt(Math.min(homeOffice.squareFootage, 300) * 5)
                        : homeOffice.totalSquareFootage > 0
                          ? `${((homeOffice.squareFootage / homeOffice.totalSquareFootage) * 100).toFixed(1)}% of home expenses`
                          : '$0.00'}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Empty state */}
            {!hasData && (
              <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-soft)] px-6 py-12 text-center">
                <p className="text-lg font-medium text-[var(--color-text-primary)]">
                  No bookkeeping data for Q{quarter}
                </p>
                <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">
                  Upload receipts or invoices in the Files tab, or add entries manually above.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40">
          <div className="mx-auto flex w-full max-w-4xl justify-end px-4 sm:px-6">
            <div className="pointer-events-auto flex w-full max-w-md flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]/92 p-2 shadow-[var(--shadow-md)] backdrop-blur-xl sm:w-auto sm:flex-row">
              <button
                onClick={() => setShowMileage(true)}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-brand-strong)] hover:text-[var(--color-brand-strong)]"
              >
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Log Mileage
                </span>
                {quarterMileage.length > 0 && (
                  <span className="rounded-full bg-[var(--color-brand-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-brand-strong)]">
                    {fmt(quarterMileage.reduce((s, e) => s + e.miles, 0) * mileageRate)}
                  </span>
                )}
              </button>

              <button
                onClick={() => setShowHomeOffice(true)}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-brand-strong)] hover:text-[var(--color-brand-strong)]"
              >
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Home Office Setup
                </span>
                {homeOffice && (
                  <span className="rounded-full bg-[var(--color-brand-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-brand-strong)]">
                    {homeOffice.method === 'simplified'
                      ? fmt(Math.min(homeOffice.squareFootage, 300) * 5)
                      : `${((homeOffice.squareFootage / (homeOffice.totalSquareFootage || 1)) * 100).toFixed(0)}%`}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Sticky summary bar */}
        <div className="sticky bottom-0 z-30 mt-8 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]/92 px-5 py-4 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-6">
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)]">Net Profit</p>
                <p className={`text-lg font-semibold tabular-nums ${
                  (summary?.netProfit ?? 0) >= 0 ? 'text-[var(--color-success-text)]' : 'text-[var(--color-danger)]'
                }`}>
                  {fmt(summary?.netProfit ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)]">Est. SE Tax</p>
                <p className="text-lg font-semibold tabular-nums text-[var(--color-text-primary)]">
                  {fmt(summary?.seTax ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)]">Est. Quarterly Payment</p>
                <p className="text-lg font-semibold tabular-nums text-[var(--color-text-primary)]">
                  {fmt(summary?.paymentOwed ?? 0)}
                </p>
              </div>
            </div>
            <button
              onClick={handleDownloadReport}
              disabled={!hasData}
              className={`lux-button-primary px-5 py-2.5 text-xs font-semibold ${
                !hasData ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title={hasData ? `Download Q${quarter} Report` : 'Add data to generate a report'}
            >
              Download Q{quarter} Report
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
        onSave={handleSaveHomeOffice}
        existing={homeOffice}
      />
      <ManualEntryModal
        open={showManualEntry !== null}
        type={showManualEntry ?? 'expense'}
        quarter={quarter}
        year={year}
        onClose={() => setShowManualEntry(null)}
        onSave={handleAddManualEntry}
      />
    </div>
  );
}
