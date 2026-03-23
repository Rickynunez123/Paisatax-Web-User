'use client';

import { useMemo, useState } from 'react';
import Header from '@/components/layout/Header';
import BooksSectionNav from '@/components/books/BooksSectionNav';
import HomeOfficeModal from '@/components/books/HomeOfficeModal';
import MileageEntryModal from '@/components/books/MileageEntryModal';
import ModalPortal from '@/components/ui/ModalPortal';
import { useAuth } from '@/context/AuthContext';
import { useBooksData } from '@/hooks/useBooksData';
import { getQuarterlyReportUrl } from '@/lib/files-api';
import {
  BOOK_QUARTERS,
  getBooksYearOptions,
  parseManualEntryPeriod,
  type QuarterNumber,
} from '@/lib/books-view';
import type { BookkeepingNodeAssignment, HomeOfficeEntry } from '@/lib/types';

function getCurrentQuarter(): QuarterNumber {
  const month = new Date().getMonth();
  if (month < 3) return 1;
  if (month < 6) return 2;
  if (month < 9) return 3;
  return 4;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function BooksOverviewSkeleton() {
  return (
    <div className="mt-8 space-y-6">
      {Array.from({ length: 3 }).map((_, index) => (
        <section key={index} className="lux-card-outline p-5">
          <div className="flex items-center justify-between">
            <div className="h-3 w-20 lux-skeleton" />
            <div className="h-9 w-28 rounded-full lux-skeleton" />
          </div>
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-3 w-28 lux-skeleton" />
              <div className="h-4 w-20 lux-skeleton" />
            </div>
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 lux-skeleton" />
              <div className="h-4 w-16 lux-skeleton" />
            </div>
            <div className="border-t border-[var(--color-soft-border)] pt-3">
              <div className="flex items-center justify-between">
                <div className="h-3 w-24 lux-skeleton" />
                <div className="h-4 w-20 lux-skeleton" />
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

const INCOME_CATEGORIES = [
  {
    nodeSuffix: 'line1_grossReceipts',
    label: 'Gross Receipts / Sales',
    description: 'Money your business brought in from normal sales or services before refunds, discounts, or returns.',
  },
  {
    nodeSuffix: 'line2_returnsAllowances',
    label: 'Returns & Allowances',
    description: 'Money you gave back to customers because of refunds, returned items, credits, or price adjustments.',
  },
  {
    nodeSuffix: 'line6_otherIncome',
    label: 'Other Business Income',
    description: 'Business-related income that is not your normal sale of goods or services, such as small reimbursements or miscellaneous operating income.',
  },
] as const;

const EXPENSE_CATEGORIES = [
  { nodeSuffix: 'line8_advertising', label: 'Advertising', description: 'Marketing, ads, promotions, business cards, sponsored posts, and similar efforts to attract customers.' },
  { nodeSuffix: 'line10_commissionsFees', label: 'Commissions & Fees', description: 'Commissions, referral fees, platform fees, or other transaction-based charges you pay to earn business.' },
  { nodeSuffix: 'line11_contractLabor', label: 'Contract Labor', description: 'Payments to freelancers or independent contractors who work for your business.' },
  { nodeSuffix: 'line15_insurance', label: 'Insurance', description: 'Business insurance such as liability, errors and omissions, or other coverage tied to the business.' },
  { nodeSuffix: 'line17_legalProfessional', label: 'Legal & Professional', description: 'Accounting, bookkeeping, legal, tax prep, consulting, or other professional service fees.' },
  { nodeSuffix: 'line18_officeExpense', label: 'Office Expense', description: 'Routine office costs like software, postage, small tools, printer costs, and admin-related purchases.' },
  { nodeSuffix: 'line20b_rentLeaseOther', label: 'Rent / Lease', description: 'Rent or lease payments for office space, equipment, or other property used in the business.' },
  { nodeSuffix: 'line21_repairs', label: 'Repairs & Maintenance', description: 'Costs to fix and maintain business property or equipment without materially improving it.' },
  { nodeSuffix: 'line22_supplies', label: 'Supplies', description: 'Consumable items you use in the business, such as materials, packaging, or office supplies.' },
  { nodeSuffix: 'line23_taxesLicenses', label: 'Taxes & Licenses', description: 'Business licenses, permits, regulatory fees, and deductible business taxes other than federal income tax.' },
  { nodeSuffix: 'line24a_travel', label: 'Travel', description: 'Business travel such as airfare, hotels, rides, and other travel costs for business trips.' },
  { nodeSuffix: 'line24b_mealsWithoutLimit', label: 'Meals (50%)', description: 'Business meals. In many cases only part of the cost is deductible, so use this category for business meal spending.' },
  { nodeSuffix: 'line25_utilities', label: 'Utilities', description: 'Business utilities such as internet, phone, electricity, or similar recurring service costs used for the business.' },
  { nodeSuffix: 'line26_wages', label: 'Wages', description: 'Wages paid to employees. Do not use this for contractors.' },
  { nodeSuffix: 'line27a_otherExpenses', label: 'Other Expenses', description: 'Business expenses that do not fit the listed categories. Use this only when another category is clearly not a match.' },
] as const;

function InlineHelp({ explanation }: { explanation: string }) {
  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        aria-label="More information"
        className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[10px] font-semibold text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)] focus:text-[var(--color-text-primary)] focus:outline-none"
      >
        ?
      </button>
      <div className="pointer-events-none absolute right-0 top-7 z-20 hidden w-64 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-xs leading-5 text-[var(--color-text-secondary)] shadow-[var(--shadow-md)] group-hover:block group-focus-within:block">
        {explanation}
      </div>
    </div>
  );
}

interface ManualEntryModalProps {
  open: boolean;
  type: 'income' | 'expense';
  quarter: QuarterNumber;
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
  const [showHelp, setShowHelp] = useState(false);

  if (!open) return null;

  const amountNum = parseFloat(amount) || 0;
  const selectedCat = categories.find((item) => item.nodeSuffix === category);
  const modalHelpCopy = type === 'income'
    ? 'Income is money coming into the business. Gross receipts or sales is your normal business revenue before refunds. Returns and allowances is money given back to customers. Other business income is business-related income that does not come from your main sale of goods or services.'
    : 'Most business expenses are deductions if they are ordinary and necessary for the business. Choose the category that best matches what you paid for. Mileage and home office are also deductions, but they are tracked separately because they have special rules.';

  const handleSave = () => {
    if (amountNum <= 0) return;
    onSave({
      rawDescription: description.trim() || selectedCat?.label || 'Manual entry',
      extractedAmount: amountNum,
      extractedDate: date,
      assignedNodeId: `bk.${year}.q${quarter}.schedC.${category}`,
      assignedCategory: selectedCat?.label || category,
      isIncome: type === 'income',
      confidence: 1,
      needsReview: false,
    });
    setAmount('');
    setDescription('');
    setDate(new Date().toISOString().slice(0, 10));
    onClose();
  };

  return (
    <ModalPortal>
      <div className="lux-modal-shell">
        <div className="lux-modal-backdrop" onClick={onClose} />
        <div className="lux-modal-card lux-modal-card-lg">
          <div className="lux-modal-header">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Add {type === 'income' ? 'Income' : 'Expense'} Entry
              </h2>
              <p className="lux-modal-subtitle">
                Add a manual {type === 'income' ? 'income' : 'expense'} entry for Q{quarter} {year}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowHelp((value) => !value)}
              className="lux-icon-button"
              aria-label="Explain categories"
              aria-expanded={showHelp}
            >
              ?
            </button>
          </div>

          <div className="lux-modal-body">
            {showHelp && (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-4 py-4">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {type === 'income' ? 'How income categories work' : 'How expense categories work'}
                </p>
                <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">
                  {modalHelpCopy}
                </p>
                <div className="mt-3 space-y-2">
                  {categories.map((item) => (
                    <div key={item.nodeSuffix} className="rounded-[var(--radius-sm)] border border-[var(--color-soft-border)] bg-[var(--color-background-alt)]/72 px-3 py-2.5">
                      <p className="text-xs font-semibold text-[var(--color-text-primary)]">{item.label}</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <label className="lux-field-label block">Category</label>
                <InlineHelp explanation={type === 'income'
                  ? 'Pick the income category that best describes where the money came from. Gross receipts is normal revenue, returns and allowances is money refunded to customers, and other business income is business-related income outside your main sales.'
                  : 'Pick the expense category that best matches what you paid for. Most ordinary and necessary business expenses are deductions. Mileage and home office are tracked separately because they use special rules.'}
                />
              </div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="lux-input"
              >
                {categories.map((item) => (
                  <option key={item.nodeSuffix} value={item.nodeSuffix}>{item.label}</option>
                ))}
              </select>
              {selectedCat?.description && (
                <p className="mt-2 text-xs leading-5 text-[var(--color-text-tertiary)]">
                  {selectedCat.description}
                </p>
              )}
            </div>

            <div className="lux-form-grid-2">
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

          <div className="lux-modal-actions">
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

export default function BooksPage() {
  const { user } = useAuth();
  const userId = user?.userId ?? 'dev-user-local';
  const currentYear = new Date().getFullYear();
  const currentYearString = String(currentYear);

  const [year, setYear] = useState(currentYearString);
  const [quarter, setQuarter] = useState<QuarterNumber>(getCurrentQuarter());
  const [showMileage, setShowMileage] = useState(false);
  const [showHomeOffice, setShowHomeOffice] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState<'income' | 'expense' | null>(null);

  const {
    quarterSummaries,
    loading,
    error,
    allMileage,
    homeOffice,
    allManualEntries,
    handleAddMileage,
    handleDeleteMileage,
    handleSaveHomeOffice,
    handleAddManualEntry,
    handleDeleteManualEntry,
  } = useBooksData(userId, year);

  const summary = quarterSummaries[quarter];
  const quarterMileage = allMileage.filter((entry) => entry.quarter === quarter && entry.year === year);
  const quarterManual = allManualEntries.filter((entry) => {
    const period = parseManualEntryPeriod(entry.assignedNodeId);
    return period.year === year && period.quarter === quarter;
  });
  const quarterManualIncome = quarterManual.filter((entry) => entry.isIncome);
  const quarterManualExpenses = quarterManual.filter((entry) => !entry.isIncome);
  const selectedHomeOffice = homeOffice?.year === year ? homeOffice : null;
  const mileageRate = summary?.mileage?.ratePerMile ?? 0.70;
  const yearOptions = useMemo(() => getBooksYearOptions(currentYear, [
    ...allMileage.map((entry) => entry.year),
    ...allManualEntries.map((entry) => parseManualEntryPeriod(entry.assignedNodeId).year),
    homeOffice?.year,
  ]), [allManualEntries, allMileage, currentYear, homeOffice?.year]);

  const hasData = Boolean(summary) && (
    summary.income.grossReceipts > 0 ||
    summary.income.otherIncome > 0 ||
    summary.totalExpenses > 0 ||
    quarterMileage.length > 0 ||
    selectedHomeOffice !== null
  );
  const canDownloadReport = hasData && year === currentYearString;

  const handleDownloadReport = () => {
    const url = getQuarterlyReportUrl(userId, quarter);
    window.open(url, '_blank');
  };

  return (
    <div className="lux-shell flex min-h-screen flex-col">
      <Header />

      <div className="lux-page pb-44 sm:pb-48">
        <h1 className="sr-only">Books</h1>

        <BooksSectionNav />

        <section className="lux-toolbar mt-4">
          <div className="lux-toolbar-row">
            <div className="lux-segmented-control">
              {BOOK_QUARTERS.map((item) => (
                <button
                  key={item}
                  onClick={() => setQuarter(item)}
                  className={`lux-segmented-pill ${quarter === item ? 'is-active' : ''}`}
                >
                  Q{item}
                </button>
              ))}
            </div>

            <div className="lux-inline-group">
              <select
                aria-label="Select books year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="lux-select-compact"
              >
                {yearOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {loading && (
          <BooksOverviewSkeleton />
        )}

        {error && (
          <div className="mt-8 rounded-[var(--radius-sm)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="mt-8 space-y-6">
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
                        {fmt(summary.income.grossReceipts)}
                      </span>
                    </div>
                  )}
                  {(summary?.income.returnsAllowances ?? 0) > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--color-text-secondary)]">Returns & Allowances</span>
                      <span className="font-medium tabular-nums text-[var(--color-danger)]">
                        -{fmt(summary.income.returnsAllowances)}
                      </span>
                    </div>
                  )}
                  {(summary?.income.otherIncome ?? 0) > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--color-text-secondary)]">Other Business Income</span>
                      <span className="font-medium tabular-nums text-[var(--color-success-text)]">
                        {fmt(summary.income.otherIncome)}
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

                  {quarterManualIncome.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-medium text-[var(--color-text-tertiary)]">Manual entries</p>
                      {quarterManualIncome.map((entry, index) => {
                        const globalIndex = allManualEntries.indexOf(entry);
                        return (
                          <div key={index} className="flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--color-surface-soft)] px-3 py-2 text-xs">
                            <span className="text-[var(--color-text-secondary)]">
                              {entry.extractedDate} — {entry.rawDescription}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium tabular-nums text-[var(--color-success-text)]">
                                {fmt(entry.extractedAmount ?? 0)}
                              </span>
                              <button
                                onClick={() => handleDeleteManualEntry(globalIndex)}
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
                  No income recorded for Q{quarter} {year}. Upload invoices or add entries manually.
                </p>
              )}
            </section>

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
                  {summary?.expenses.map((expense) => (
                    <div key={expense.lineId} className="flex items-center justify-between text-sm">
                      <span className="text-[var(--color-text-secondary)]">{expense.label}</span>
                      <span className="font-medium tabular-nums text-[var(--color-text-primary)]">
                        {fmt(expense.amount)}
                      </span>
                    </div>
                  ))}

                  {(summary?.totalExpenses ?? 0) > 0 && (
                    <div className="border-t border-[var(--color-border)] pt-2">
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <span className="text-[var(--color-text-primary)]">Total Expenses</span>
                        <span className="tabular-nums text-[var(--color-text-primary)]">
                          {fmt(summary.totalExpenses)}
                        </span>
                      </div>
                    </div>
                  )}

                  {quarterManualExpenses.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-medium text-[var(--color-text-tertiary)]">Manual entries</p>
                      {quarterManualExpenses.map((entry, index) => {
                        const globalIndex = allManualEntries.indexOf(entry);
                        return (
                          <div key={index} className="flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--color-surface-soft)] px-3 py-2 text-xs">
                            <span className="text-[var(--color-text-secondary)]">
                              {entry.extractedDate} — {entry.rawDescription}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium tabular-nums text-[var(--color-text-primary)]">
                                {fmt(entry.extractedAmount ?? 0)}
                              </span>
                              <button
                                onClick={() => handleDeleteManualEntry(globalIndex)}
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
                  No expenses recorded for Q{quarter} {year}. Upload receipts or add entries manually.
                </p>
              )}
            </section>

            {quarterMileage.length > 0 && (
              <section className="lux-card-outline p-5">
                <div className="flex items-center justify-between">
                  <h2 className="lux-field-label">Mileage Log — Q{quarter}</h2>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="tabular-nums text-[var(--color-text-secondary)]">
                      {quarterMileage.reduce((sum, entry) => sum + entry.miles, 0).toLocaleString()} mi
                    </span>
                    <span className="font-medium tabular-nums text-[var(--color-success-text)]">
                      {fmt(quarterMileage.reduce((sum, entry) => sum + entry.miles, 0) * mileageRate)}
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

            {selectedHomeOffice && (
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
                <div className="mt-3 flex flex-col gap-4 text-sm sm:flex-row sm:gap-6">
                  <div>
                    <p className="text-xs text-[var(--color-text-tertiary)]">Method</p>
                    <p className="font-medium capitalize text-[var(--color-text-primary)]">{selectedHomeOffice.method}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-text-tertiary)]">Business sq ft</p>
                    <p className="font-medium tabular-nums text-[var(--color-text-primary)]">{selectedHomeOffice.squareFootage}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-text-tertiary)]">Deduction</p>
                    <p className="font-medium tabular-nums text-[var(--color-success-text)]">
                      {selectedHomeOffice.method === 'simplified'
                        ? fmt(Math.min(selectedHomeOffice.squareFootage, 300) * 5)
                        : selectedHomeOffice.totalSquareFootage > 0
                          ? `${((selectedHomeOffice.squareFootage / selectedHomeOffice.totalSquareFootage) * 100).toFixed(1)}% of home expenses`
                          : '$0.00'}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {!hasData && (
              <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-soft)] px-6 py-12 text-center">
                <p className="text-lg font-medium text-[var(--color-text-primary)]">
                  No bookkeeping data for Q{quarter} {year}
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
                    {fmt(quarterMileage.reduce((sum, entry) => sum + entry.miles, 0) * mileageRate)}
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
                {selectedHomeOffice && (
                  <span className="rounded-full bg-[var(--color-brand-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-brand-strong)]">
                    {selectedHomeOffice.method === 'simplified'
                      ? fmt(Math.min(selectedHomeOffice.squareFootage, 300) * 5)
                      : `${((selectedHomeOffice.squareFootage / (selectedHomeOffice.totalSquareFootage || 1)) * 100).toFixed(0)}%`}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 z-30 mt-8 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]/92 px-5 py-4 backdrop-blur-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid grid-cols-2 gap-4 sm:flex sm:gap-6">
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)]">Business Profit Before Personal Taxes</p>
                <p className={`text-lg font-semibold tabular-nums ${
                  (summary?.netProfit ?? 0) >= 0 ? 'text-[var(--color-success-text)]' : 'text-[var(--color-danger)]'
                }`}>
                  {fmt(summary?.netProfit ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)]">Estimated SE Tax on Business Profit</p>
                <p className="text-lg font-semibold tabular-nums text-[var(--color-text-primary)]">
                  {fmt(summary?.seTax ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)]">Suggested IRS Tax Reserve</p>
                <p className="text-lg font-semibold tabular-nums text-[var(--color-text-primary)]">
                  {fmt(summary?.paymentOwed ?? 0)}
                </p>
              </div>
            </div>
            <button
              onClick={handleDownloadReport}
              disabled={!canDownloadReport}
              className={`lux-button-primary px-5 py-2.5 text-xs font-semibold ${
                !canDownloadReport ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title={
                canDownloadReport
                  ? `Download Q${quarter} ${year} report`
                  : year !== currentYearString
                    ? 'PDF export is currently available for the current year only.'
                    : 'Add data to generate a report'
              }
            >
              Download Q{quarter} Report
            </button>
          </div>
        </div>
      </div>

      <MileageEntryModal
        open={showMileage}
        onClose={() => setShowMileage(false)}
        onSave={handleAddMileage}
      />
      <HomeOfficeModal
        open={showHomeOffice}
        onClose={() => setShowHomeOffice(false)}
        onSave={handleSaveHomeOffice}
        existing={selectedHomeOffice}
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
