'use client';

/**
 * DocumentList — shows all uploaded documents for the current session
 * with status badges and classification results.
 */

import { useAgent } from '@/context/AgentContext';
import type { DocumentMetadata, DocumentStatus } from '@/lib/types';

const STATUS_CONFIG: Record<DocumentStatus, { label: string; color: string }> = {
  uploaded:     { label: 'Uploaded',     color: 'bg-stone-200 text-stone-700' },
  classifying:  { label: 'Classifying',  color: 'bg-blue-100 text-blue-700' },
  extracting:   { label: 'Extracting',   color: 'bg-amber-100 text-amber-700' },
  categorizing: { label: 'Categorizing', color: 'bg-violet-100 text-violet-700' },
  complete:     { label: 'Complete',     color: 'bg-emerald-100 text-emerald-700' },
  failed:       { label: 'Failed',       color: 'bg-red-100 text-red-700' },
};

function StatusBadge({ status }: { status: DocumentStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.uploaded;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentRow({ doc }: { doc: DocumentMetadata }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 border-b border-stone-100 last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-900 truncate">
          {doc.originalName}
        </p>
        <p className="text-xs text-stone-500">
          {doc.irsFormName ?? (doc.isBookkeepingDoc ? 'Bookkeeping Document' : 'Unknown')}
          {doc.isJunk && ' — Junk'}
          {' · '}
          {formatBytes(doc.sizeBytes)}
          {doc.extractedFieldCount > 0 && ` · ${doc.extractedFieldCount} fields`}
          {doc.validationIssueCount > 0 && ` · ${doc.validationIssueCount} issues`}
        </p>
      </div>
      <div className="ml-3 flex-shrink-0">
        <StatusBadge status={doc.status} />
      </div>
    </div>
  );
}

export default function DocumentList() {
  const { documents } = useAgent();

  if (documents.length === 0) return null;

  return (
    <div className="mx-4 mb-3 rounded-lg border border-stone-200 bg-white overflow-hidden">
      <div className="px-3 py-2 bg-stone-50 border-b border-stone-200">
        <h3 className="text-xs font-semibold text-stone-600 uppercase tracking-wide">
          Uploaded Documents ({documents.length})
        </h3>
      </div>
      <div className="divide-y divide-stone-100">
        {documents.map((doc) => (
          <DocumentRow key={doc.fileId} doc={doc} />
        ))}
      </div>
    </div>
  );
}
