'use client';

import { useState, useRef, useCallback } from 'react';
import { useAgent } from '@/context/AgentContext';
import { useUserProfile } from '@/context/UserProfileContext';

interface UploadZoneProps {
  onLogMileage?: () => void;
  onHomeOffice?: () => void;
}

export default function UploadZone({ onLogMileage, onHomeOffice }: UploadZoneProps) {
  const { uploadFiles, isLoading } = useAgent();
  const { mode } = useUserProfile();
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const files = Array.from(fileList);
      await uploadFiles(files);
    },
    [uploadFiles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`rounded-[24px] border-2 border-dashed p-6 text-center transition-colors ${
        isDragging
          ? 'border-[var(--color-brand-strong)] bg-[var(--color-brand-soft)]'
          : 'border-[var(--color-border)] bg-[var(--color-background-alt)] hover:border-[var(--color-border-strong)]'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {mode === 'business' ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Add to your books</p>
          <div className="flex items-center gap-4">
            {/* Upload Document */}
            <button
              onClick={() => inputRef.current?.click()}
              disabled={isLoading}
              className="flex flex-col items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-5 py-4 transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-brand-soft)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-6 w-6 text-[var(--color-brand-strong)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                {isLoading ? 'Uploading...' : 'Upload'}
              </span>
            </button>

            {/* Log Mileage */}
            <button
              onClick={onLogMileage}
              className="flex flex-col items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-5 py-4 transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-brand-soft)]"
            >
              <svg className="h-6 w-6 text-[var(--color-brand-strong)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Mileage</span>
            </button>

            {/* Home Office */}
            <button
              onClick={onHomeOffice}
              className="flex flex-col items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-5 py-4 transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-brand-soft)]"
            >
              <svg className="h-6 w-6 text-[var(--color-brand-strong)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Home Office</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Drop your tax documents here</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            PDF, JPEG, PNG — W-2s, 1099s, and more
          </p>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={isLoading}
            className="lux-button-primary mt-3 px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Uploading...' : 'Browse Files'}
          </button>
        </div>
      )}
    </div>
  );
}
