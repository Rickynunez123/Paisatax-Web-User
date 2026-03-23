'use client';

import { useMemo, useState } from 'react';
import Header from '@/components/layout/Header';
import BooksSectionNav from '@/components/books/BooksSectionNav';
import { useAuth } from '@/context/AuthContext';
import { useBooksData } from '@/hooks/useBooksData';
import {
  BOOK_QUARTERS,
  aggregateSummaries,
  createEmptyBooksSummary,
  formatPeriodContext,
  formatPeriodLabel,
  getBooksYearOptions,
  getVisibleQuarters,
  parseManualEntryPeriod,
  type BooksPeriod,
  type QuarterNumber,
} from '@/lib/books-view';

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

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function MetricHelp({ explanation }: { explanation: string }) {
  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        aria-label="Why this metric matters"
        className="flex h-6 w-6 items-center justify-center rounded-full bg-transparent text-[11px] font-semibold text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text-primary)] focus:bg-[var(--color-surface-soft)] focus:text-[var(--color-text-primary)] focus:outline-none"
      >
        ?
      </button>
      <div className="pointer-events-none absolute right-0 top-8 z-20 hidden w-64 rounded-[var(--radius-sm)] border border-[var(--color-soft-border)] bg-[var(--color-surface)] px-3 py-2 text-xs leading-5 text-[var(--color-text-secondary)] shadow-[var(--shadow-md)] group-hover:block group-focus-within:block">
        {explanation}
      </div>
    </div>
  );
}

function BooksAnalyticsSkeleton() {
  return (
    <div className="mt-8 space-y-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="lux-card-outline p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="h-4 w-28 lux-skeleton" />
              <div className="mt-2 h-3 w-56 max-w-full lux-skeleton" />
            </div>
            <div className="h-6 w-6 rounded-full lux-skeleton" />
          </div>
          <div className="lux-stat-strip mt-4">
            {Array.from({ length: 3 }).map((__, statIndex) => (
              <div key={statIndex} className="lux-stat-cell">
                <div className="h-3 w-24 lux-skeleton" />
                <div className="mt-3 h-7 w-24 lux-skeleton" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function BooksAnalyticsPage() {
  const { user } = useAuth();
  const userId = user?.userId ?? 'dev-user-local';
  const currentYear = new Date().getFullYear();
  const currentYearString = String(currentYear);

  const [year, setYear] = useState(currentYearString);
  const [period, setPeriod] = useState<BooksPeriod>('ytd');

  const {
    quarterSummaries,
    loading,
    error,
    allMileage,
    homeOffice,
    allManualEntries,
  } = useBooksData(userId, year);

  const manualEntriesWithPeriod = useMemo(() => allManualEntries.map((entry) => ({
    entry,
    ...parseManualEntryPeriod(entry.assignedNodeId),
  })), [allManualEntries]);

  const focusQuarter = useMemo(() => {
    const activeQuarters = new Set<QuarterNumber>();

    BOOK_QUARTERS.forEach((item) => {
      const summary = quarterSummaries[item] ?? createEmptyBooksSummary(year, item);
      if (
        summary.income.grossReceipts > 0 ||
        summary.income.otherIncome > 0 ||
        summary.totalExpenses > 0 ||
        summary.documentCount > 0 ||
        summary.assignmentCount > 0 ||
        summary.mileage.totalMiles > 0 ||
        summary.homeOffice !== null
      ) {
        activeQuarters.add(item);
      }
    });

    manualEntriesWithPeriod.forEach(({ year: entryYear, quarter: entryQuarter }) => {
      if (entryYear === year && entryQuarter !== null) {
        activeQuarters.add(entryQuarter);
      }
    });

    allMileage.forEach((entry) => {
      if (entry.year === year) {
        activeQuarters.add(entry.quarter);
      }
    });

    const orderedQuarters = [...activeQuarters].sort((a, b) => a - b);
    if (orderedQuarters.length > 0) {
      return orderedQuarters[orderedQuarters.length - 1];
    }

    return year === currentYearString ? getCurrentQuarter() : 4;
  }, [allMileage, currentYearString, manualEntriesWithPeriod, quarterSummaries, year]);

  const visibleQuarters = useMemo(() => getVisibleQuarters(period, focusQuarter), [focusQuarter, period]);

  const selectedSummary = useMemo(() => (
    aggregateSummaries(
      visibleQuarters.map((item) => quarterSummaries[item] ?? createEmptyBooksSummary(year, item)),
      year,
      focusQuarter,
    )
  ), [focusQuarter, quarterSummaries, visibleQuarters, year]);

  const selectedManualEntries = useMemo(() => manualEntriesWithPeriod
    .filter(({ year: entryYear, quarter: entryQuarter }) => (
      entryYear === year && entryQuarter !== null && visibleQuarters.includes(entryQuarter)
    ))
    .map(({ entry }) => entry), [manualEntriesWithPeriod, visibleQuarters, year]);

  const selectedMileage = useMemo(() => allMileage.filter((entry) => (
    entry.year === year && visibleQuarters.includes(entry.quarter)
  )), [allMileage, visibleQuarters, year]);

  const selectedHomeOffice = homeOffice?.year === year ? homeOffice : null;
  const selectedPeriodLabel = formatPeriodLabel(period, focusQuarter, year);
  const filterContext = period === 'full_year'
    ? formatPeriodContext(period, focusQuarter, year)
    : `YTD runs through Q${focusQuarter} ${year}.`;
  const mileageRate = selectedSummary.mileage.ratePerMile || 0.7;
  const totalMiles = selectedMileage.reduce((sum, entry) => sum + entry.miles, 0);
  const mileageDeduction = selectedMileage.reduce((sum, entry) => sum + entry.miles * mileageRate, 0);
  const homeOfficeDeduction = selectedHomeOffice
    ? selectedHomeOffice.method === 'simplified'
      ? Math.min(selectedHomeOffice.squareFootage, 300) * 5
      : selectedSummary.homeOffice?.deduction ?? 0
    : 0;
  const margin = selectedSummary.income.grossIncome > 0
    ? (selectedSummary.netProfit / selectedSummary.income.grossIncome) * 100
    : 0;
  const expenseBreakdown = [...selectedSummary.expenses]
    .filter((expense) => expense.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const expenseTotal = expenseBreakdown.reduce((sum, expense) => sum + expense.amount, 0);
  const ringSegments = expenseBreakdown.length > 5
    ? [
        ...expenseBreakdown.slice(0, 4),
        {
          lineId: 'other',
          label: 'Other',
          amount: expenseBreakdown.slice(4).reduce((sum, expense) => sum + expense.amount, 0),
        },
      ]
    : expenseBreakdown;
  const ringColors = ['#0f766e', '#d97706', '#2563eb', '#f97316', '#64748b'];
  let ringOffset = 0;
  const expenseRing = ringSegments.length > 0 && expenseTotal > 0
    ? `conic-gradient(${ringSegments.map((segment, index) => {
        const start = ringOffset;
        const slice = (segment.amount / expenseTotal) * 100;
        ringOffset += slice;
        return `${ringColors[index % ringColors.length]} ${start}% ${ringOffset}%`;
      }).join(', ')})`
    : 'conic-gradient(#e5e7eb 0% 100%)';
  const afterSetAside = selectedSummary.netProfit - selectedSummary.paymentOwed;
  const hasData = (
    selectedSummary.income.grossReceipts > 0 ||
    selectedSummary.income.otherIncome > 0 ||
    selectedSummary.totalExpenses > 0 ||
    selectedMileage.length > 0 ||
    selectedManualEntries.length > 0 ||
    selectedHomeOffice !== null
  );
  const yearOptions = getBooksYearOptions(currentYear, [
    ...allMileage.map((entry) => entry.year),
    ...manualEntriesWithPeriod.map(({ year: entryYear }) => entryYear).filter((entryYear): entryYear is string => Boolean(entryYear)),
    ...(homeOffice?.year ? [homeOffice.year] : []),
  ]);

  return (
    <div className="lux-shell flex min-h-screen flex-col">
      <Header />

      <div className="lux-page sm:pb-40">
        <h1 className="sr-only">Books Analytics</h1>

        <BooksSectionNav />

        <section className="lux-toolbar mt-4">
          <div className="lux-toolbar-row">
            <div className="lux-segmented-control">
              {[
                { value: 'ytd', label: 'YTD' },
                { value: 'full_year', label: 'Full Year' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setPeriod(option.value as BooksPeriod)}
                  className={`lux-segmented-pill ${period === option.value ? 'is-active' : ''}`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="lux-inline-group">
              <select
                aria-label="Select analytics year"
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

          <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">
            {filterContext}
          </p>
        </section>

        {loading && (
          <BooksAnalyticsSkeleton />
        )}

        {error && (
          <div className="mt-8 rounded-[var(--radius-sm)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="mt-8 space-y-4">
            <div className="lux-card-outline p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">Profit & Loss</p>
                  <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                    Income, expenses, and business profit for {selectedPeriodLabel}.
                  </p>
                </div>
                <MetricHelp explanation="This shows whether your revenue is turning into real profit after expenses, which is the clearest signal of business performance." />
              </div>
              <div className="lux-stat-strip mt-4">
                <div className="lux-stat-cell">
                  <p className="lux-label">Income</p>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-[var(--color-text-primary)]">
                    {fmt(selectedSummary.income.grossIncome)}
                  </p>
                </div>
                <div className="lux-stat-cell">
                  <p className="lux-label">Expenses</p>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-[var(--color-text-primary)]">
                    {fmt(selectedSummary.totalExpenses)}
                  </p>
                </div>
                <div className="lux-stat-cell">
                  <p className="lux-label">Business Profit Before Personal Taxes</p>
                  <p className={`mt-2 text-xl font-semibold tabular-nums ${
                    selectedSummary.netProfit >= 0 ? 'text-[var(--color-success-text)]' : 'text-[var(--color-danger)]'
                  }`}>
                    {fmt(selectedSummary.netProfit)}
                  </p>
                </div>
                <div className="lux-stat-cell">
                  <p className="lux-label">Margin</p>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-[var(--color-text-primary)]">
                    {pct(margin)}
                  </p>
                </div>
              </div>
            </div>

            <div className="lux-card-outline p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">Tax Planning</p>
                  <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                    Business-only tax planning for {selectedPeriodLabel}. This does not include W-2s, other personal tax forms, withholding, credits, or spouse income.
                  </p>
                </div>
                <MetricHelp explanation="These numbers are based only on the business activity in your books. Self-employment tax is the Social Security and Medicare tax on that business profit. The IRS reserve is a planning amount to set aside for federal taxes, not a final bill." />
              </div>
              <div className="lux-stat-strip mt-4">
                <div className="lux-stat-cell">
                  <p className="lux-label">Estimated SE Tax on Business Profit</p>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-[var(--color-text-primary)]">
                    {fmt(selectedSummary.seTax)}
                  </p>
                </div>
                <div className="lux-stat-cell">
                  <p className="lux-label">Suggested IRS Tax Reserve</p>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-[var(--color-text-primary)]">
                    {fmt(selectedSummary.paymentOwed)}
                  </p>
                </div>
                <div className="lux-stat-cell">
                  <p className="lux-label">Business Profit After Tax Reserve</p>
                  <p className={`mt-2 text-xl font-semibold tabular-nums ${
                    afterSetAside >= 0 ? 'text-[var(--color-success-text)]' : 'text-[var(--color-danger)]'
                  }`}>
                    {fmt(afterSetAside)}
                  </p>
                </div>
              </div>
              <p className="mt-4 border-t border-[var(--color-soft-border)] pt-3 text-xs text-[var(--color-text-tertiary)]">
                Self-employment tax is one part of your total taxes. The IRS reserve is a suggested amount to set aside from this business profit for federal taxes. Business profit after tax reserve is what would remain after setting that amount aside.
              </p>
            </div>

            <div className="lux-card-outline p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">Expense Allocation</p>
                  <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                    See which categories are taking the biggest share of spending.
                  </p>
                </div>
                <MetricHelp explanation="This helps you spot where money is going so you can control the categories that are putting the most pressure on profit." />
              </div>
              {expenseTotal > 0 ? (
                <div className="mt-4 grid gap-5 lg:grid-cols-[220px_1fr] lg:items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className="relative h-44 w-44 rounded-full"
                      style={{ background: expenseRing }}
                    />
                    <div className="mt-3 text-center">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                        Total Expenses
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--color-text-primary)]">
                        {fmt(expenseTotal)}
                      </p>
                    </div>
                  </div>
                  <div className="lux-stat-list min-w-0">
                    {ringSegments.map((segment, index) => (
                      <div key={segment.lineId} className="lux-stat-row">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2 text-sm">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: ringColors[index % ringColors.length] }}
                              />
                              <span className="truncate text-[var(--color-text-secondary)]">{segment.label}</span>
                            </div>
                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-soft)]">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${(segment.amount / expenseTotal) * 100}%`,
                                  backgroundColor: ringColors[index % ringColors.length],
                                }}
                              />
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-medium tabular-nums text-[var(--color-text-primary)]">
                              {fmt(segment.amount)}
                            </p>
                            <p className="mt-1 text-[11px] font-semibold tabular-nums text-[var(--color-text-tertiary)]">
                              {pct((segment.amount / expenseTotal) * 100)} of spend
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-[var(--color-text-tertiary)]">
                  No expense categories yet for {selectedPeriodLabel}.
                </p>
              )}
            </div>

            <div className="lux-card-outline p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">Special Deductions</p>
                  <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                    Mileage and home office are tracked separately because they use their own deduction rules.
                  </p>
                </div>
                <MetricHelp explanation="Most business expenses are already deducted through your expense categories. This section is only for special deductions like mileage and home office, which have separate calculation rules." />
              </div>
              <div className="lux-stat-strip mt-4">
                <div className="lux-stat-cell">
                  <p className="lux-label">Mileage</p>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-[var(--color-success-text)]">
                    {fmt(mileageDeduction)}
                  </p>
                  <p className="lux-stat-note">{totalMiles.toLocaleString()} mi</p>
                </div>
                <div className="lux-stat-cell">
                  <p className="lux-label">Home Office</p>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-[var(--color-success-text)]">
                    {fmt(homeOfficeDeduction)}
                  </p>
                  <p className="lux-stat-note">
                    {selectedHomeOffice ? selectedHomeOffice.method : 'Not set'}
                  </p>
                </div>
                <div className="lux-stat-cell">
                  <p className="lux-label">Tracked Share</p>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-[var(--color-text-primary)]">
                    {selectedSummary.totalExpenses > 0 ? pct(((mileageDeduction + homeOfficeDeduction) / selectedSummary.totalExpenses) * 100) : '0.0%'}
                  </p>
                  <p className="lux-stat-note">of total expenses</p>
                </div>
              </div>
            </div>

            {!hasData && (
              <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-soft)] px-6 py-12 text-center">
                <p className="text-lg font-medium text-[var(--color-text-primary)]">
                  No analytics available for {selectedPeriodLabel}
                </p>
                <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">
                  Add bookkeeping activity in Overview to generate reports and trends here.
                </p>
              </div>
            )}
          </div>
        )}

        {!loading && !error && (
          <div className="sticky bottom-0 z-30 mt-8 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]/92 px-5 py-4 backdrop-blur-xl">
            <div className="grid grid-cols-2 gap-4 sm:flex sm:gap-6">
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)]">Business Profit Before Personal Taxes</p>
                <p className={`text-lg font-semibold tabular-nums ${
                  selectedSummary.netProfit >= 0 ? 'text-[var(--color-success-text)]' : 'text-[var(--color-danger)]'
                }`}>
                  {fmt(selectedSummary.netProfit)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)]">Estimated SE Tax on Business Profit</p>
                <p className="text-lg font-semibold tabular-nums text-[var(--color-text-primary)]">
                  {fmt(selectedSummary.seTax)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)]">Suggested IRS Tax Reserve</p>
                <p className="text-lg font-semibold tabular-nums text-[var(--color-text-primary)]">
                  {fmt(selectedSummary.paymentOwed)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
