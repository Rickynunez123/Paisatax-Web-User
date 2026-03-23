import type { BooksSummary } from './files-api';

export const BOOK_QUARTERS = [1, 2, 3, 4] as const;

export type QuarterNumber = (typeof BOOK_QUARTERS)[number];
export type BooksPeriod = 'quarter' | 'ytd' | 'full_year';

export function createEmptyBooksSummary(year: string, quarter: QuarterNumber): BooksSummary {
  return {
    quarter,
    year,
    income: {
      grossReceipts: 0,
      returnsAllowances: 0,
      otherIncome: 0,
      grossProfit: 0,
      grossIncome: 0,
    },
    expenses: [],
    totalExpenses: 0,
    netProfit: 0,
    seTax: 0,
    paymentOwed: 0,
    mileage: {
      entries: [],
      totalMiles: 0,
      deduction: 0,
      ratePerMile: 0.7,
    },
    homeOffice: null,
    documentCount: 0,
    assignmentCount: 0,
  };
}

export function createQuarterSummaryRecord(year: string): Record<QuarterNumber, BooksSummary> {
  return BOOK_QUARTERS.reduce((record, quarter) => {
    record[quarter] = createEmptyBooksSummary(year, quarter);
    return record;
  }, {} as Record<QuarterNumber, BooksSummary>);
}

export function aggregateSummaries(
  summaries: BooksSummary[],
  year: string,
  quarter: QuarterNumber,
): BooksSummary {
  const aggregated = createEmptyBooksSummary(year, quarter);
  const expenseMap = new Map<string, { lineId: string; label: string; amount: number }>();

  summaries.forEach((summary) => {
    aggregated.income.grossReceipts += summary.income.grossReceipts;
    aggregated.income.returnsAllowances += summary.income.returnsAllowances;
    aggregated.income.otherIncome += summary.income.otherIncome;
    aggregated.income.grossProfit += summary.income.grossProfit;
    aggregated.income.grossIncome += summary.income.grossIncome;
    aggregated.totalExpenses += summary.totalExpenses;
    aggregated.netProfit += summary.netProfit;
    aggregated.seTax += summary.seTax;
    aggregated.paymentOwed += summary.paymentOwed;
    aggregated.mileage.entries.push(...summary.mileage.entries);
    aggregated.mileage.totalMiles += summary.mileage.totalMiles;
    aggregated.mileage.deduction += summary.mileage.deduction;
    aggregated.mileage.ratePerMile = summary.mileage.ratePerMile || aggregated.mileage.ratePerMile;
    aggregated.documentCount += summary.documentCount;
    aggregated.assignmentCount += summary.assignmentCount;

    if (summary.homeOffice) {
      aggregated.homeOffice = summary.homeOffice;
    }

    summary.expenses.forEach((expense) => {
      const existing = expenseMap.get(expense.lineId);
      if (existing) {
        existing.amount += expense.amount;
      } else {
        expenseMap.set(expense.lineId, { ...expense });
      }
    });
  });

  aggregated.expenses = [...expenseMap.values()].sort((a, b) => b.amount - a.amount);
  return aggregated;
}

export function parseManualEntryPeriod(
  nodeId: string,
): { year: string | null; quarter: QuarterNumber | null } {
  const match = nodeId.match(/bk\.(\d{4})\.q([1-4])\./);
  if (!match) return { year: null, quarter: null };
  return {
    year: match[1],
    quarter: Number(match[2]) as QuarterNumber,
  };
}

export function formatPeriodLabel(period: BooksPeriod, quarter: QuarterNumber, year: string): string {
  if (period === 'quarter') return `Q${quarter} ${year}`;
  if (period === 'ytd') return `YTD through Q${quarter} ${year}`;
  return `Full Year ${year}`;
}

export function formatPeriodContext(period: BooksPeriod, quarter: QuarterNumber, year: string): string {
  if (period === 'quarter') return `Viewing Q${quarter} ${year}.`;
  if (period === 'ytd') return `YTD combines Q1 through Q${quarter} in ${year}.`;
  return `Full year combines Q1 through Q4 in ${year}.`;
}

export function getVisibleQuarters(period: BooksPeriod, quarter: QuarterNumber): QuarterNumber[] {
  if (period === 'quarter') return [quarter];
  if (period === 'ytd') return BOOK_QUARTERS.filter((item) => item <= quarter);
  return [...BOOK_QUARTERS];
}

export function getComparisonQuarters(period: BooksPeriod, quarter: QuarterNumber): QuarterNumber[] {
  if (period === 'quarter') return BOOK_QUARTERS.filter((item) => item === quarter - 1);
  if (period === 'ytd') return BOOK_QUARTERS.filter((item) => item < quarter);
  return [];
}

export function getBooksYearOptions(
  currentYear: number,
  years: Array<string | null | undefined>,
): string[] {
  return [...new Set([
    ...Array.from({ length: 5 }, (_, index) => String(currentYear - index)),
    ...years.filter((year): year is string => Boolean(year)),
  ])].sort((a, b) => Number(b) - Number(a));
}
