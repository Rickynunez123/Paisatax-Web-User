'use client';

import { useState, useRef, useCallback } from 'react';
import { useAgent } from '@/context/AgentContext';

export default function UploadZone() {
  const { uploadFiles, isLoading } = useAgent();
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

      <div className="space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-lg text-[var(--color-brand-strong)]">
          📄
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
    </div>
  );
}
