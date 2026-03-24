'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/layout/Header';
import { useAuth } from '@/context/AuthContext';
import { useUserProfile } from '@/context/UserProfileContext';
import {
  uploadFilesForClassification,
  listUserFiles,
  getFileDownloadUrl,
  fetchFileAsBlob,
  getFileDetail,
  deleteUserFile,
} from '@/lib/files-api';
import type {
  DocumentMetadata,
  DocumentStatus,
  DocumentCategorization,
  ExtractedField,
  ValidationIssue,
  BookkeepingNodeAssignment,
} from '@/lib/types';

// ─── Confidence threshold — below this we flag for user review ───────────────

// Classification confidence below this triggers review,
// BUT only if extraction also looks uncertain (see needsAttention).
const CLASSIFICATION_REVIEW_THRESHOLD = 0.5;

// ─── Helper: does this doc need user attention? ──────────────────────────────

function needsAttention(doc: DocumentMetadata): boolean {
  if (doc.status === 'failed') return true;
  if (doc.isJunk) return true;
  if (!doc.formId) return true;
  // Only flag low classification confidence if extraction also has issues.
  // A text_pattern match at 70% with all fields at 100% is fine.
  if ((doc.classificationConfidence ?? 0) < CLASSIFICATION_REVIEW_THRESHOLD) return true;
  if (doc.validationIssueCount > 0) return true;
  if (doc.errorMessage) return true;
  return false;
}

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DocumentStatus, { label: string; text: string; dot: string }> = {
  uploaded:     { label: 'Uploaded', text: 'text-[var(--color-info-text)]', dot: 'bg-[var(--color-info-text)]' },
  classifying:  { label: 'Classifying', text: 'text-[var(--color-info-text)]', dot: 'bg-[var(--color-info-text)]' },
  extracting:   { label: 'Extracting', text: 'text-[var(--color-warning-text)]', dot: 'bg-[var(--color-warning-text)]' },
  categorizing: { label: 'Categorizing', text: 'text-[var(--color-warning-text)]', dot: 'bg-[var(--color-warning-text)]' },
  complete:     { label: 'Ready', text: 'text-[var(--color-success-text)]', dot: 'bg-[var(--color-success-text)]' },
  failed:       { label: 'Failed', text: 'text-[var(--color-danger-text)]', dot: 'bg-[var(--color-danger-text)]' },
};

function StatusLabel({ status }: { status: DocumentStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.uploaded;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium ${config.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type FileCategoryFilter = 'all' | 'tax_forms' | 'business';

function getDocumentYear(doc: DocumentMetadata): string {
  const createdAt = new Date(doc.createdAt);
  if (Number.isNaN(createdAt.getTime())) {
    return String(new Date().getFullYear());
  }
  return String(createdAt.getFullYear());
}

function matchesFileCategory(doc: DocumentMetadata, category: FileCategoryFilter): boolean {
  if (doc.status !== 'complete') return true;
  if (category === 'business') return doc.isBookkeepingDoc;
  if (category === 'tax_forms') return !doc.isBookkeepingDoc;
  return true;
}

function trimDocTypeLabel(label: string): string {
  return label.split(',')[0].trim();
}

function getDocumentKindLabel(doc: DocumentMetadata): string {
  return trimDocTypeLabel(
    doc.irsFormName
    ?? (doc.isBookkeepingDoc ? 'Bookkeeping' : null)
    ?? (doc.isJunk ? 'Junk' : null)
    ?? (doc.formId ?? 'Unknown')
  );
}

function formatFieldValue(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: value % 1 !== 0 ? 2 : 0,
      maximumFractionDigits: 2,
    });
  }
  return String(value);
}

function confidenceColor(c: number): string {
  if (c >= 0.8) return 'text-[var(--color-success-text)]';
  if (c >= 0.5) return 'text-[var(--color-warning-text)]';
  return 'text-[var(--color-danger-text)]';
}

// ─── Editable Field Row ──────────────────────────────────────────────────────

function EditableFieldRow({ field, onUpdate }: {
  field: ExtractedField;
  onUpdate: (nodeIdPattern: string, newValue: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(field.value ?? ''));

  const handleSave = () => {
    onUpdate(field.nodeIdPattern, editValue);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditValue(String(field.value ?? ''));
      setEditing(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 text-xs hover:bg-[var(--color-surface-soft)] group">
      <span className="text-[var(--color-text-secondary)]">{field.shortLabel}</span>
      <div className="flex items-center gap-2">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              autoFocus
              className="w-32 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1 text-xs font-semibold text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-strong)]"
            />
          </div>
        ) : (
          <>
            <span className="font-semibold text-[var(--color-text-primary)]">
              {formatFieldValue(field.value)}
            </span>
            <button
              onClick={() => setEditing(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity lux-icon-button !p-0.5"
              title="Edit value"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        )}
        <span className={`text-[10px] tabular-nums ${confidenceColor(field.confidence)}`}>
          {Math.round(field.confidence * 100)}%
        </span>
      </div>
    </div>
  );
}

// ─── Extracted Fields Panel (IRS tax forms) ──────────────────────────────────

function FieldsPanel({ fields, validation, onFieldUpdate }: {
  fields: ExtractedField[];
  validation: { isValid: boolean; issues: ValidationIssue[] } | null;
  onFieldUpdate: (nodeIdPattern: string, newValue: string) => void;
}) {
  const nonNullFields = fields.filter(f => f.value !== null);

  return (
    <div className="space-y-3">
      {nonNullFields.length > 0 && (
        <div className="space-y-0.5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
            Extracted Fields
          </p>
          {nonNullFields.map((field) => (
            <EditableFieldRow
              key={field.nodeIdPattern}
              field={field}
              onUpdate={onFieldUpdate}
            />
          ))}
        </div>
      )}

      {validation && validation.issues.length > 0 && (
        <div className="space-y-1">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-danger-text)]">
            Validation Issues
          </p>
          {validation.issues.map((issue, i) => (
            <div
              key={`${issue.code}-${i}`}
              className={`rounded-lg px-3 py-2 text-xs ${
                issue.severity === 'error'
                  ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]'
                  : issue.severity === 'warning'
                    ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning-text)]'
                    : 'bg-[var(--color-info-soft)] text-[var(--color-info-text)]'
              }`}
            >
              {issue.message}
            </div>
          ))}
        </div>
      )}

      {nonNullFields.length === 0 && (!validation || validation.issues.length === 0) && (
        <p className="text-xs text-[var(--color-text-tertiary)]">No fields extracted.</p>
      )}
    </div>
  );
}

// ─── Bookkeeping Assignments Panel (receipts, invoices) ──────────────────────

function AssignmentsPanel({ assignments }: { assignments: BookkeepingNodeAssignment[] }) {
  if (assignments.length === 0) {
    return <p className="text-xs text-[var(--color-text-tertiary)]">No bookkeeping assignments.</p>;
  }

  return (
    <div className="space-y-0.5">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
        Bookkeeping Assignments
      </p>
      {assignments.map((a, i) => (
        <div
          key={`${a.assignedNodeId}-${i}`}
          className={`flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 text-xs ${
            a.needsReview ? 'bg-[var(--color-warning-soft)]' : 'hover:bg-[var(--color-surface-soft)]'
          }`}
        >
          <div className="min-w-0 flex-1">
            <span className="text-[var(--color-text-secondary)]">{a.assignedCategory}</span>
            {a.rawDescription && (
              <p className="mt-0.5 truncate text-[10px] text-[var(--color-text-tertiary)]">
                {a.rawDescription}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap">
            {a.extractedAmount !== null && (
              <span className={`font-semibold ${a.isIncome ? 'text-[var(--color-success-text)]' : 'text-[var(--color-text-primary)]'}`}>
                {a.isIncome ? '+' : ''}${Math.abs(a.extractedAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            )}
            <span className={`text-[10px] tabular-nums ${confidenceColor(a.confidence)}`}>
              {Math.round(a.confidence * 100)}%
            </span>
            {a.needsReview && (
              <span className="text-[10px] font-semibold text-[var(--color-warning-text)]" title="Needs review">
                !
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Attention Banner ────────────────────────────────────────────────────────

function AttentionBanner({ doc }: { doc: DocumentMetadata }) {
  const reasons: string[] = [];

  if (doc.status === 'failed') {
    reasons.push(doc.errorMessage ?? 'Processing failed');
  }
  if (!doc.formId) {
    reasons.push('Could not identify document type');
  }
  if (doc.isJunk) {
    reasons.push('Classified as junk or irrelevant');
  }
  if ((doc.classificationConfidence ?? 0) < CLASSIFICATION_REVIEW_THRESHOLD && doc.formId) {
    reasons.push(`Low classification confidence (${Math.round((doc.classificationConfidence ?? 0) * 100)}%)`);
  }
  if (doc.validationIssueCount > 0) {
    reasons.push(`${doc.validationIssueCount} validation issue${doc.validationIssueCount > 1 ? 's' : ''}`);
  }

  if (reasons.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-warning-text)]">
        Needs Review
      </p>
      <ul className="mt-1 space-y-0.5">
        {reasons.map((r, i) => (
          <li key={i} className="text-xs text-[var(--color-warning-text)]">{r}</li>
        ))}
      </ul>
    </div>
  );
}

// ─── Expandable Document Row ─────────────────────────────────────────────────

function DocumentRow({ doc, userId, defaultExpanded, onDelete }: {
  doc: DocumentMetadata;
  userId: string;
  defaultExpanded: boolean;
  onDelete: (fileId: string) => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [detail, setDetail] = useState<DocumentCategorization | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { idToken } = useAuth();

  const date = new Date(doc.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const isProcessing = ['uploaded', 'classifying', 'extracting', 'categorizing'].includes(doc.status);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const attention = needsAttention(doc);

  // Fetch blob URL for viewing (handles auth in prod)
  const handleView = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (blobUrl) {
      window.open(blobUrl, '_blank');
      return;
    }
    try {
      const url = await fetchFileAsBlob(userId, doc.fileId, idToken);
      setBlobUrl(url);
      window.open(url, '_blank');
    } catch {
      // Fallback to direct URL (works in dev)
      window.open(getFileDownloadUrl(userId, doc.fileId), '_blank');
    }
  };

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [blobUrl]);
  const docKindLabel = getDocumentKindLabel(doc);
  const rowIndicator = doc.status === 'failed'
    ? <StatusLabel status="failed" />
    : attention
      ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium text-[var(--color-warning-text)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-warning-text)]" />
            Needs review
          </span>
        )
      : doc.status !== 'complete'
        ? <StatusLabel status={doc.status} />
        : null;

  // Lazy-load detail on expand
  useEffect(() => {
    if (expanded && !detail && !loadingDetail && !isProcessing) {
      setLoadingDetail(true);
      getFileDetail(userId, doc.fileId, idToken)
        .then((res) => setDetail(res.categorization))
        .catch(() => {})
        .finally(() => setLoadingDetail(false));
    }
  }, [expanded, detail, loadingDetail, isProcessing, userId, doc.fileId, idToken]);

  return (
    <div className={`overflow-hidden rounded-2xl border transition-colors ${
      doc.status === 'failed'
        ? 'border-[var(--color-danger-border)]'
        : attention
        ? 'border-[var(--color-warning-border)]'
        : 'border-[var(--color-border)]'
    } bg-[var(--color-background-alt)]`}>
      {/* Header row — clickable to expand */}
      <button
        onClick={() => !isProcessing && setExpanded(!expanded)}
        disabled={isProcessing}
        className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-[var(--color-surface-soft)] disabled:cursor-default"
      >
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-soft)]">
            {isProcessing ? (
              <svg className="h-5 w-5 animate-spin text-[var(--color-brand-strong)]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <div className="min-w-0">
            <p className="max-w-[320px] truncate text-sm font-medium text-[var(--color-text-primary)]">
              {doc.displayName ?? doc.originalName}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">
              {date}
              {docKindLabel && <> &middot; {docKindLabel}</>}
              {doc.sizeBytes > 0 && <> &middot; {formatBytes(doc.sizeBytes)}</>}
              {doc.extractedFieldCount > 0 && <> &middot; {doc.extractedFieldCount} fields</>}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {rowIndicator}
          {!isProcessing && (
            <button
              type="button"
              className="lux-icon-button"
              title="View file"
              onClick={handleView}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="15 3 21 3 21 9" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="10" y1="14" x2="21" y2="3" strokeLinecap="round" />
              </svg>
            </button>
          )}
          {!isProcessing && (
            <button
              type="button"
              disabled={deleting}
              title="Delete file"
              className="lux-icon-button text-[var(--color-text-tertiary)] hover:text-[var(--color-danger-text)] disabled:opacity-50"
              onClick={(e) => {
                e.stopPropagation();
                if (!confirm(`Delete "${doc.displayName ?? doc.originalName}"?`)) return;
                setDeleting(true);
                deleteUserFile(userId, doc.fileId, idToken)
                  .then(() => onDelete(doc.fileId))
                  .catch((err) => alert(err.message))
                  .finally(() => setDeleting(false));
              }}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <polyline points="3 6 5 6 21 6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {!isProcessing && (
            <svg
              className={`h-4 w-4 text-[var(--color-text-tertiary)] transition-transform ${expanded ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </button>

      {/* Expanded detail panel */}
      {expanded && !isProcessing && (
        <div className="border-t border-[var(--color-border)] px-5 py-4 space-y-3">
          {/* Attention banner */}
          <AttentionBanner doc={doc} />

          {/* Loading indicator */}
          {loadingDetail && (
            <div className="flex items-center gap-2 py-2">
              <svg className="h-4 w-4 animate-spin text-[var(--color-brand-strong)]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs text-[var(--color-text-tertiary)]">Loading details...</span>
            </div>
          )}

          {/* Extracted fields (IRS tax forms) */}
          {detail?.extraction && (
            <FieldsPanel
              fields={detail.extraction.fields}
              validation={detail.validation ?? null}
              onFieldUpdate={(nodeIdPattern, newValue) => {
                // Update the field value in local state
                setDetail((prev) => {
                  if (!prev?.extraction) return prev;
                  return {
                    ...prev,
                    extraction: {
                      ...prev.extraction,
                      fields: prev.extraction.fields.map((f) =>
                        f.nodeIdPattern === nodeIdPattern
                          ? { ...f, value: newValue, confidence: 1 }
                          : f
                      ),
                    },
                  };
                });
                // TODO: persist correction to backend
              }}
            />
          )}

          {/* Bookkeeping assignments (receipts, invoices) */}
          {detail?.categorization && (
            <AssignmentsPanel assignments={detail.categorization.assignments} />
          )}

          {/* No detail loaded yet and not loading */}
          {!loadingDetail && !detail && doc.status === 'complete' && (
            <p className="text-xs text-[var(--color-text-tertiary)]">No extraction data available.</p>
          )}

          {/* Classification info footer */}
          {detail?.classification && (
            <div className="flex items-center gap-3 border-t border-[var(--color-border)] pt-3 text-[10px] text-[var(--color-text-tertiary)]">
              <span>Method: {detail.classification.method}</span>
              <span>Confidence: {Math.round(detail.classification.confidence * 100)}%</span>
              {detail.taxYear && <span>Tax Year: {detail.taxYear}</span>}
              {detail.quarter && <span>Q{detail.quarter}</span>}
              {detail.classification.reason && (
                <span className="truncate" title={detail.classification.reason}>
                  {detail.classification.reason}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FilesListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-background-alt)]">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="h-10 w-10 rounded-[var(--radius-sm)] lux-skeleton" />
              <div className="min-w-0">
                <div className="h-4 w-40 max-w-full lux-skeleton" />
                <div className="mt-2 h-3 w-48 max-w-full lux-skeleton" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-5 w-16 lux-skeleton" />
              <div className="h-5 w-20 lux-skeleton" />
              <div className="h-8 w-8 rounded-full lux-skeleton" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function FilesPage() {
  const { user, idToken } = useAuth();
  const { mode } = useUserProfile();
  const inputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [justUploaded, setJustUploaded] = useState(false);
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [selectedCategory, setSelectedCategory] = useState<FileCategoryFilter>('all');

  const userId = user?.userId ?? 'dev-user-local';

  // Load existing documents on mount
  useEffect(() => {
    setLoadingDocuments(true);
    listUserFiles(userId, idToken)
      .then(setDocuments)
      .catch(() => {})
      .finally(() => setLoadingDocuments(false));
  }, [userId, idToken]);

  const handleUpload = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      setUploading(true);
      setError(null);
      setJustUploaded(false);
      try {
        const result = await uploadFilesForClassification(userId, files, idToken);
        setDocuments(result.documents);
        setJustUploaded(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [userId, idToken],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleUpload(e.dataTransfer.files);
      }
    },
    [handleUpload],
  );

  const yearOptions = useMemo(() => {
    const years = [...new Set(documents.map(getDocumentYear))].sort((a, b) => Number(b) - Number(a));
    return years.length > 0 ? years : [String(new Date().getFullYear())];
  }, [documents]);

  useEffect(() => {
    if (!yearOptions.includes(selectedYear)) {
      setSelectedYear(yearOptions[0]);
    }
  }, [selectedYear, yearOptions]);

  useEffect(() => {
    if (mode === 'personal' && selectedCategory !== 'tax_forms') {
      setSelectedCategory('tax_forms');
    }
  }, [mode, selectedCategory]);

  const visibleDocuments = useMemo(() => (
    documents.filter((doc) => getDocumentYear(doc) === selectedYear)
      .filter((doc) => (
        mode === 'personal'
          ? matchesFileCategory(doc, 'tax_forms')
          : matchesFileCategory(doc, selectedCategory)
      ))
  ), [documents, mode, selectedCategory, selectedYear]);

  const attentionCount = visibleDocuments.filter(needsAttention).length;
  const emptyStateLabel = mode === 'personal'
    ? 'tax forms'
    : selectedCategory === 'business'
      ? 'business documents'
      : selectedCategory === 'tax_forms'
        ? 'tax forms'
        : 'files';
  const hasDocuments = documents.length > 0;

  return (
    <div className="lux-shell flex min-h-screen flex-col">
      <Header />

      <div className="lux-page">
        <h1 className="sr-only">Files</h1>

        {error && (
          <div className="mt-4 rounded-2xl border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] px-4 py-3 text-xs font-medium text-[var(--color-danger-text)]">
            {error}
          </div>
        )}

        <section className="lux-toolbar mt-4">
          <div className="lux-toolbar-row">
            {mode === 'business' ? (
              <div className="lux-segmented-control">
                {[
                  { value: 'all', label: 'All' },
                  { value: 'tax_forms', label: 'Tax Forms' },
                  { value: 'business', label: 'Business' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSelectedCategory(option.value as FileCategoryFilter)}
                    className={`lux-segmented-pill ${selectedCategory === option.value ? 'is-active' : ''}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--color-text-tertiary)]">
                Personal mode shows tax forms only.
              </p>
            )}

            <div className="lux-inline-group">
              <select
                aria-label="Filter files by year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="lux-select-compact"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>

              {attentionCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-[var(--color-warning-soft)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--color-warning-text)]">
                  {attentionCount} need{attentionCount === 1 ? 's' : ''} review
                </span>
              )}

              <button
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="lux-button-primary px-5 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? 'Processing...' : 'Upload'}
              </button>
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleUpload(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
        </section>

        {/* Drop zone + file list */}
        <div
          className={`mt-8 space-y-3 transition-colors ${
            hasDocuments
              ? 'rounded-[var(--radius-md)] border border-dashed p-2'
              : 'rounded-2xl border-2 border-dashed p-4'
          } ${
            dragOver
              ? 'border-[var(--color-brand-strong)] bg-[var(--color-brand-soft)]'
              : hasDocuments
                ? 'border-[var(--color-soft-border)] bg-transparent'
                : 'border-transparent'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {loadingDocuments ? (
            <FilesListSkeleton />
          ) : documents.length === 0 && !uploading ? (
            <div className="lux-empty-state text-center">
              <svg className="mx-auto h-12 w-12 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="12" y1="18" x2="12" y2="12" strokeLinecap="round" />
                <polyline points="9 15 12 12 15 15" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="mt-4 text-sm font-medium text-[var(--color-text-secondary)]">
                Drop files here or click Upload
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                PDF, JPEG, PNG, WebP, or GIF. We&apos;ll automatically classify and extract data.
              </p>
            </div>
          ) : visibleDocuments.length === 0 && !uploading ? (
            <div className="lux-empty-state text-center">
              <svg className="mx-auto h-12 w-12 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="9" y1="15" x2="15" y2="15" strokeLinecap="round" />
              </svg>
              <p className="mt-4 text-sm font-medium text-[var(--color-text-secondary)]">
                No {emptyStateLabel} for {selectedYear}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                {mode === 'personal'
                  ? 'Receipts and bookkeeping documents are hidden in personal mode.'
                  : 'Try another year or switch the file type filter.'}
              </p>
            </div>
          ) : (
            visibleDocuments.map((doc) => (
              <DocumentRow
                key={doc.fileId}
                doc={doc}
                userId={userId}
                defaultExpanded={justUploaded && needsAttention(doc)}
                onDelete={(fileId) => setDocuments((prev) => prev.filter((d) => d.fileId !== fileId))}
              />
            ))
          )}

          {uploading && (
            <div className="lux-loading-state">
              <svg className="h-5 w-5 animate-spin text-[var(--color-brand-strong)]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                Classifying and extracting data...
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
