'use client';

import { useState, useRef, useCallback } from 'react';
import { useAgent } from '@/context/AgentContext';

export default function ChatInput() {
  const { sendMessage, uploadFiles, isLoading, sessionKey } = useAgent();
  const [text, setText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(async () => {
    if (!text.trim() || isLoading || !sessionKey) return;
    const message = text.trim();
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await sendMessage(message);
  }, [text, isLoading, sessionKey, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextareaInput = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    await uploadFiles(Array.from(fileList));
    e.target.value = '';
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) {
        await uploadFiles(Array.from(e.dataTransfer.files));
      }
    },
    [uploadFiles],
  );

  if (!sessionKey) return null;

  return (
    <div
      className="border-t border-[var(--color-soft-border)] bg-[var(--color-surface)]/92 px-4 py-4 backdrop-blur-2xl sm:px-6"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="mx-auto max-w-3xl">
        <div className="lux-panel-soft overflow-hidden px-3 py-3 sm:px-4">
          <div className="flex items-end gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="lux-icon-button h-11 w-11 shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Upload files"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleFileSelect}
            />

            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                handleTextareaInput();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question or upload your documents..."
              rows={1}
              disabled={isLoading}
              className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-1 py-2 text-[15px] leading-6 text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:outline-none disabled:opacity-50"
            />

            <button
              onClick={handleSubmit}
              disabled={!text.trim() || isLoading}
              className="lux-button-primary h-11 w-11 shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Send message"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3 border-t border-[var(--color-soft-border)] px-1 pt-2 text-xs text-[var(--color-text-tertiary)]">
            <span>Upload PDFs or photos of W-2s, 1099s, and tax letters</span>
            <span className="hidden sm:inline">Enter to send</span>
          </div>
        </div>
      </div>
    </div>
  );
}
