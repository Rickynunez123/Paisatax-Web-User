'use client';

import { useState } from 'react';
import { useAgent } from '@/context/AgentContext';

interface DocumentReviewProps {
  content: string;
  documents: Array<{
    formName: string;
    formId: string;
    fields: Array<{ label: string; value: string | number | boolean | null; nodeId: string }>;
  }>;
}

export default function DocumentReview({ content, documents }: DocumentReviewProps) {
  const { confirmFields, isLoading } = useAgent();
  const [expandedDoc, setExpandedDoc] = useState<number>(0);
  const [confirmed, setConfirmed] = useState(false);

  const allFieldValues = documents.flatMap((d) =>
    d.fields
      .filter((f) => f.value !== null)
      .map((f) => ({ nodeId: f.nodeId, value: f.value })),
  );

  const handleConfirmAll = async () => {
    if (confirmed || isLoading) return;
    setConfirmed(true);
    await confirmFields(allFieldValues);
  };

  return (
    <div className="lux-panel-soft px-4 py-4 sm:px-5">
      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{content}</p>

      <div className="mt-4 space-y-2">
        {documents.map((doc, i) => (
          <div
            key={`${doc.formId}-${i}`}
            className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-background-alt)]"
          >
            <button
              onClick={() => setExpandedDoc(expandedDoc === i ? -1 : i)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-brand-soft)]"
            >
              <span>{doc.formName}</span>
              <span className="text-xs font-medium text-[var(--color-text-tertiary)]">
                {doc.fields.filter((f) => f.value !== null).length} fields
                {expandedDoc === i ? ' ▲' : ' ▼'}
              </span>
            </button>

            {expandedDoc === i && (
              <div className="border-t border-[var(--color-border)] px-4 py-3">
                <div className="space-y-1">
                  {doc.fields
                    .filter((f) => f.value !== null)
                    .map((field) => (
                      <div
                        key={field.nodeId}
                        className="flex items-center justify-between gap-4 py-1.5 text-xs"
                      >
                        <span className="text-[var(--color-text-secondary)]">{field.label}</span>
                        <span className="font-semibold text-[var(--color-text-primary)]">
                          {String(field.value)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {!confirmed && allFieldValues.length > 0 && (
        <button
          onClick={handleConfirmAll}
          disabled={isLoading}
          className="lux-button-primary mt-4 w-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          Confirm All Extracted Values
        </button>
      )}

      {confirmed && (
        <p className="mt-4 rounded-2xl border border-[var(--color-success-border)] bg-[var(--color-success-soft)] px-4 py-3 text-center text-xs font-semibold text-[var(--color-success-text)]">
          All values confirmed
        </p>
      )}
    </div>
  );
}
