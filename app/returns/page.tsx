'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import { useAuth } from '@/context/AuthContext';
import {
  listCompletedReturns,
  getReturnDownloadUrl,
  type CompletedReturn,
} from '@/lib/files-api';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extractYearFromFilename(name: string): string | null {
  const match = name.match(/(\d{4})/);
  return match ? match[1] : null;
}

function ReturnCard({ ret, userId, idToken }: {
  ret: CompletedReturn;
  userId: string;
  idToken?: string | null;
}) {
  const [viewing, setViewing] = useState(false);
  const year = extractYearFromFilename(ret.name);
  const date = new Date(ret.lastModified).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const downloadUrl = getReturnDownloadUrl(userId, ret.name);

  return (
    <>
      <div className="lux-card-outline p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-success-soft)]">
              <svg className="h-6 w-6 text-[var(--color-success-text)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="9 15 11 17 15 13" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                {year ? `${year} Federal Return` : ret.name}
              </h3>
              <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                {ret.name} &middot; {formatBytes(ret.size)} &middot; {date}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex rounded-full bg-[var(--color-success-soft)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-success-text)]">
              Complete
            </span>
            <button
              onClick={() => setViewing(true)}
              className="lux-button-primary px-4 py-2 text-xs font-semibold"
            >
              View
            </button>
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="lux-icon-button"
              title="Download PDF"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* PDF Viewer Modal */}
      {viewing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative flex h-[90vh] w-[90vw] max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                {year ? `${year} Federal Return` : ret.name}
              </h3>
              <button
                onClick={() => setViewing(false)}
                className="lux-icon-button"
                aria-label="Close"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
                  <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <iframe
              src={downloadUrl}
              className="flex-1"
              title="Tax Return PDF"
            />
          </div>
        </div>
      )}
    </>
  );
}

export default function ReturnsPage() {
  const { user, idToken } = useAuth();
  const [returns, setReturns] = useState<CompletedReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = user?.userId ?? 'dev-user-local';

  useEffect(() => {
    setLoading(true);
    listCompletedReturns(userId, idToken)
      .then(setReturns)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load returns'))
      .finally(() => setLoading(false));
  }, [userId, idToken]);

  return (
    <div className="lux-shell flex min-h-screen flex-col">
      <Header />

      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
          Returns
        </h1>

        {error && (
          <div className="mt-4 rounded-2xl border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] px-4 py-3 text-xs font-medium text-[var(--color-danger-text)]">
            {error}
          </div>
        )}

        <div className="mt-8 space-y-3">
          {loading && (
            <div className="flex items-center justify-center gap-3 py-12">
              <svg className="h-5 w-5 animate-spin text-[var(--color-brand-strong)]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-[var(--color-text-tertiary)]">Loading returns...</span>
            </div>
          )}

          {!loading && returns.length === 0 && !error && (
            <div className="py-16 text-center">
              <svg className="mx-auto h-12 w-12 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="mt-4 text-sm font-medium text-[var(--color-text-secondary)]">
                No completed returns yet
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                Once your tax return is ready, it will appear here.
              </p>
              <Link
                href="/home"
                className="lux-button-primary mt-6 inline-flex px-6 py-2.5 text-xs font-semibold"
              >
                Start a Return
              </Link>
            </div>
          )}

          {returns.map((ret) => (
            <ReturnCard
              key={ret.name}
              ret={ret}
              userId={userId}
              idToken={idToken}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
