'use client';

import { useState, useRef } from 'react';
import Header from '@/components/layout/Header';
import { useAgent } from '@/context/AgentContext';

type FileStatus = 'Processing' | 'Extracted' | 'Needs Review' | 'Failed';

interface UploadedFile {
  id: string;
  name: string;
  docType: string;
  uploadDate: string;
  status: FileStatus;
}

const FILE_STATUS_COLORS: Record<FileStatus, string> = {
  Processing: 'bg-[var(--color-info-soft)] text-[var(--color-info-text)]',
  Extracted: 'bg-[var(--color-success-soft)] text-[var(--color-success-text)]',
  'Needs Review': 'bg-[var(--color-warning-soft)] text-[var(--color-warning-text)]',
  Failed: 'bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]',
};

export default function FilesPage() {
  const { uploadFiles } = useAgent();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const fileArray = Array.from(fileList);

    // Add to local list with Processing status
    const newFiles: UploadedFile[] = fileArray.map((f) => ({
      id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: f.name,
      docType: 'Processing',
      uploadDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      status: 'Processing' as FileStatus,
    }));
    setFiles((prev) => [...prev, ...newFiles]);

    // Fire upload through agent
    await uploadFiles(fileArray);
  };

  return (
    <div className="lux-shell flex min-h-screen flex-col">
      <Header />

      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
            Files
          </h1>
          <button
            onClick={() => inputRef.current?.click()}
            className="lux-button-primary px-5 py-2 text-xs font-semibold"
          >
            Upload
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>

        {/* Year filter */}
        <div className="mt-6 flex gap-2">
          <button className="rounded-full border border-[var(--color-brand-strong)] bg-[var(--color-brand-soft)] px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-brand-strong)]">
            2025
          </button>
        </div>

        {/* File list */}
        <div className="mt-8 space-y-3">
          {files.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-[var(--color-text-tertiary)]">
                No files uploaded yet. Upload your tax documents to get started.
              </p>
            </div>
          ) : (
            files.map((f) => (
              <div key={f.id} className="lux-card-outline flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-soft)]">
                    <svg className="h-5 w-5 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                      <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate max-w-[240px]">
                      {f.name}
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">{f.uploadDate}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="lux-chip">{f.docType}</span>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${FILE_STATUS_COLORS[f.status]}`}>
                    {f.status}
                  </span>
                  <button
                    disabled
                    className="lux-button-secondary px-3 py-1.5 text-xs font-medium opacity-50"
                    title="Coming soon"
                  >
                    View
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
