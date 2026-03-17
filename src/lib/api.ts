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
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002/api/agent';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ─── Session ─────────────────────────────────────────────────────────────────

export async function createSession(filingStatus: string): Promise<CreateSessionResponse> {
  return request<CreateSessionResponse>('/session', {
    method: 'POST',
    body: JSON.stringify({ filingStatus }),
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
): Promise<AgentResponse> {
  const formData = new FormData();
  formData.append('sessionKey', sessionKey);
  if (message) formData.append('message', message);
  for (const file of files) {
    formData.append('files', file);
  }

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Upload failed: ${res.status}`);
  }

  return res.json() as Promise<AgentResponse>;
}

// ─── Export ──────────────────────────────────────────────────────────────────

export async function getExportSummary(sessionKey: string): Promise<TaxReturnSummary> {
  return request<TaxReturnSummary>(`/export/${sessionKey}/summary`);
}

export async function downloadPdf(sessionKey: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/export/${sessionKey}/pdf`);
  if (!res.ok) {
    throw new Error(`PDF download failed: ${res.status}`);
  }
  return res.blob();
}

// ─── History ─────────────────────────────────────────────────────────────────

export async function getChatHistory(sessionKey: string): Promise<{ messages: ChatMessage[] }> {
  return request<{ messages: ChatMessage[] }>(`/history/${sessionKey}`);
}
