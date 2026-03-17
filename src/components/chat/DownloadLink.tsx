'use client';

import { useState } from 'react';
import { useAgent } from '@/context/AgentContext';

interface DownloadLinkProps {
  content: string;
  refund?: number | null;
  amountOwed?: number | null;
  primaryName?: string;
  filingStatus?: string;
  forms?: string[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatFilingStatus(status: string): string {
  const map: Record<string, string> = {
    single: 'Single',
    married_filing_jointly: 'Married Filing Jointly',
    married_filing_separately: 'Married Filing Separately',
    head_of_household: 'Head of Household',
    qualifying_surviving_spouse: 'Qualifying Surviving Spouse',
  };
  return map[status] ?? status;
}

export default function DownloadLink({
  content,
  refund,
  amountOwed,
  primaryName,
  filingStatus,
  forms,
}: DownloadLinkProps) {
  const { downloadPdf } = useAgent();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadPdf();
    } finally {
      setDownloading(false);
    }
  };

  const hasRefund = refund !== null && refund !== undefined && refund > 0;
  const owes = amountOwed !== null && amountOwed !== undefined && amountOwed > 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* Header */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-background-alt)] px-5 py-4">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{content}</p>
        {primaryName && (
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            {primaryName} {filingStatus ? `\u2022 ${formatFilingStatus(filingStatus)}` : ''} {'\u2022'} Tax Year 2025
          </p>
        )}
      </div>

      {/* Refund / Owed */}
      {(hasRefund || owes) && (
        <div className={`px-5 py-4 text-center ${hasRefund ? 'bg-[var(--color-success-soft)]' : 'bg-[var(--color-error-soft)]'}`}>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
            {hasRefund ? 'Estimated Refund' : 'Amount Owed'}
          </p>
          <p className={`mt-1 text-2xl font-bold ${hasRefund ? 'text-[var(--color-success-text)]' : 'text-[var(--color-error-text)]'}`}>
            {formatCurrency(hasRefund ? refund! : amountOwed!)}
          </p>
        </div>
      )}

      {/* Forms included */}
      {forms && forms.length > 0 && (
        <div className="border-t border-[var(--color-border)] px-5 py-3">
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">
            Forms included: {forms.join(', ')} ({forms.length} {forms.length === 1 ? 'form' : 'forms'})
          </p>
        </div>
      )}

      {/* Download button */}
      <div className="border-t border-[var(--color-border)] px-5 py-4">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="lux-button-primary w-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {downloading ? 'Generating PDF...' : 'Download Tax Return PDF'}
        </button>
      </div>
    </div>
  );
}
