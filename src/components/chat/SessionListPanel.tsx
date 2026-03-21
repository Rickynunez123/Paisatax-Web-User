'use client';

/**
 * SessionListPanel — collapsible panel showing the user's past chat sessions.
 * Appears on the welcome screen so users can resume a previous conversation.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAgent } from '@/context/AgentContext';
import type { ChatSessionSummary } from '@/lib/types';
import * as api from '@/lib/api';

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function SessionListPanel() {
  const { user, idToken } = useAuth();
  const { loadSession } = useAgent();
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !user) return;
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    api.listChatSessions(idToken)
      .then((result) => {
        if (!cancelled) setSessions(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load sessions');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, user]);

  const handleResume = (sessionKey: string) => {
    loadSession(sessionKey);
  };

  if (!user) return null;

  return (
    <div className="mt-6 w-full max-w-md">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="mx-auto flex items-center gap-2 text-xs font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
      >
        <svg
          className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        Previous Sessions
        {sessions.length > 0 && !isOpen && (
          <span className="rounded-full bg-[var(--color-surface-soft)] px-2 py-0.5 text-[10px] tabular-nums">
            {sessions.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-3">
          {isLoading && (
            <p className="text-center text-xs text-[var(--color-text-tertiary)]">Loading sessions...</p>
          )}

          {error && (
            <p className="text-center text-xs text-[var(--color-danger-text)]">{error}</p>
          )}

          {!isLoading && !error && sessions.length === 0 && (
            <p className="text-center text-xs text-[var(--color-text-tertiary)]">No previous sessions found.</p>
          )}

          {!isLoading && sessions.length > 0 && (
            <ul className="space-y-2">
              {sessions.map((s) => (
                <li key={s.sessionKey}>
                  <button
                    onClick={() => handleResume(s.sessionKey)}
                    className="group w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-left transition-all hover:border-[var(--color-border-strong)] hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                        {s.sessionKey.replace(/^session_/, 'Session ')}
                      </span>
                      <span className="ml-2 shrink-0 text-[10px] text-[var(--color-text-tertiary)]">
                        {formatDate(s.updatedAt)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[10px] text-[var(--color-text-tertiary)]">
                      <span>{s.messageCount} messages</span>
                      {s.fileCount > 0 && <span>{s.fileCount} files</span>}
                      <span className="ml-auto font-medium text-[var(--color-brand-strong)] opacity-0 transition-opacity group-hover:opacity-100">
                        Resume
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
