/**
 * paisatax-web-user/src/lib/api.ts
 *
 * Typed fetch wrappers for the paisatax-agent backend.
 */

import type {
  CreateSessionResponse,
  AgentResponse,
  TaxReturnSummary,
  ChatMessage,
  ConfirmedFieldValue,
  DocumentMetadata,
  UploadResponse,
  ChatSessionSummary,
} from './types';
import { storage } from './storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002/api/agent';

/** Build auth headers from stored token. Skips for dev-token. */
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = storage.getItem('idToken');
  if (token && token !== 'dev-token') {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...getAuthHeaders(), ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ─── Session ─────────────────────────────────────────────────────────────────

export async function createSession(
  filingStatus: string,
  taxYear?: string,
  hasDependents?: boolean,
  prefill?: { profiles?: string[]; identity?: Record<string, string> },
): Promise<CreateSessionResponse> {
  return request<CreateSessionResponse>('/session', {
    method: 'POST',
    body: JSON.stringify({ filingStatus, taxYear, hasDependents, prefill }),
  });
}

// ─── Conversation ────────────────────────────────────────────────────────────

export async function converse(params: {
  sessionKey: string;
  message?: string;
  selectedOption?: string;
  confirmedFields?: ConfirmedFieldValue[];
  rejectedFields?: string[];
}): Promise<AgentResponse> {
  return request<AgentResponse>('/converse', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ─── File Upload ─────────────────────────────────────────────────────────────

export async function uploadFiles(
  sessionKey: string,
  files: File[],
  message?: string,
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('sessionKey', sessionKey);
  if (message) formData.append('message', message);
  for (const file of files) {
    formData.append('files', file);
  }

  const uploadHeaders: Record<string, string> = {};
  const token = storage.getItem('idToken');
  if (token && token !== 'dev-token') {
    uploadHeaders['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: uploadHeaders,
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    // Surface duplicate filename as a specific error type
    if (res.status === 409) {
      const err = new Error(body.message ?? 'Duplicate file') as Error & { code: string; existingFile: any };
      err.code = 'DUPLICATE_FILENAME';
      err.existingFile = body.existingFile;
      throw err;
    }
    throw new Error(body.error ?? body.message ?? `Upload failed: ${res.status}`);
  }

  return res.json() as Promise<UploadResponse>;
}

// ─── Documents ──────────────────────────────────────────────────────────────

export async function getDocuments(sessionKey: string): Promise<DocumentMetadata[]> {
  const result = await request<{ documents: DocumentMetadata[] }>(`/documents/${sessionKey}`);
  return result.documents;
}

export async function getDocument(
  sessionKey: string,
  fileId: string,
): Promise<{ metadata: DocumentMetadata; categorization: any | null }> {
  return request(`/documents/${sessionKey}/${fileId}`);
}

// ─── Export ──────────────────────────────────────────────────────────────────

export async function getExportSummary(sessionKey: string): Promise<TaxReturnSummary> {
  return request<TaxReturnSummary>(`/export/${sessionKey}/summary`);
}

export async function downloadPdf(sessionKey: string): Promise<Blob> {
  const pdfHeaders: Record<string, string> = {};
  const pdfToken = storage.getItem('idToken');
  if (pdfToken && pdfToken !== 'dev-token') {
    pdfHeaders['Authorization'] = `Bearer ${pdfToken}`;
  }

  const res = await fetch(`${API_BASE}/export/${sessionKey}/pdf`, { headers: pdfHeaders });
  if (!res.ok) {
    throw new Error(`PDF download failed: ${res.status}`);
  }
  return res.blob();
}

// ─── History ─────────────────────────────────────────────────────────────────

export async function getChatHistory(sessionKey: string): Promise<{ messages: ChatMessage[] }> {
  // Agent (dev): /history/:key — Tax-graph (prod): /session/:key/chat/history
  const isProd = API_BASE.includes('/api/tax');
  const path = isProd
    ? `/session/${sessionKey}/chat/history`
    : `/history/${sessionKey}`;
  return request<{ messages: ChatMessage[] }>(path);
}

// ─── Chat Session Management ────────────────────────────────────────────────

/** List all persisted chat sessions for the authenticated user. */
export async function listChatSessions(_idToken?: string | null): Promise<ChatSessionSummary[]> {
  const res = await fetch(`${API_BASE}/chat/sessions`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Request failed: ${res.status}`);
  }

  const data = await res.json() as { sessions: any[] };
  return (data.sessions ?? []).map((s: any) => ({
    sessionKey: s.sessionKey,
    userId: s.userId,
    messageCount: s.messages?.length ?? 0,
    totalInputTokens: s.totalInputTokens ?? 0,
    totalOutputTokens: s.totalOutputTokens ?? 0,
    fileCount: s.fileCount ?? 0,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));
}
