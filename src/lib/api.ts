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

/**
 * Derive the agent Lambda base URL.
 * When NEXT_PUBLIC_AGENT_STREAM_URL is set, ALL agent requests go through the
 * Lambda Function URL — bypasses API Gateway's 29s timeout for every route.
 * The Function URL handler routes /converse to SSE streaming and everything
 * else to standard JSON responses (still no 29s limit).
 */
function getAgentBase(): string {
  // Prefer Function URL (no timeout) when available
  const streamUrl = process.env.NEXT_PUBLIC_AGENT_STREAM_URL;
  if (streamUrl) {
    // Function URL expects paths like /session, /converse, /history/xxx
    // Strip trailing slash so paths like /session work correctly
    return streamUrl.replace(/\/+$/, '');
  }
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) return API_BASE; // dev mode — agent handles everything
  // Strip /api/tax or /api/bucket suffix → use /api/agent
  const root = url.replace(/\/api\/(tax|agent|bucket)$/, '');
  return `${root}/api/agent`;
}

/** Build auth headers from stored token. Skips for dev-token. */
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = storage.getItem('idToken');
  if (token && token !== 'dev-token') {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request<T>(path: string, init?: RequestInit, base?: string): Promise<T> {
  const res = await fetch(`${base ?? API_BASE}${path}`, {
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
  prefill?: { profiles?: string[]; identity?: Record<string, string>; documentFormIds?: string[] },
): Promise<CreateSessionResponse> {
  return request<CreateSessionResponse>('/session', {
    method: 'POST',
    body: JSON.stringify({ filingStatus, taxYear, hasDependents, prefill }),
  }, getAgentBase());
}

// ─── Conversation ────────────────────────────────────────────────────────────

export interface ConverseParams {
  sessionKey: string;
  message?: string;
  selectedOption?: string;
  confirmedFields?: ConfirmedFieldValue[];
  rejectedFields?: string[];
}

export async function converse(params: ConverseParams): Promise<AgentResponse> {
  return request<AgentResponse>('/converse', {
    method: 'POST',
    body: JSON.stringify(params),
  }, getAgentBase());
}

// ─── Streaming Conversation (SSE via Lambda Function URL) ────────────────────

export type StreamEvent =
  | { type: 'thinking'; turn: number }
  | { type: 'tool_use'; name: string; turn: number }
  | { type: 'text_delta'; text: string }
  | { type: 'text_done'; fullText: string }
  | { type: 'done'; data: AgentResponse }
  | { type: 'error'; message: string };

/**
 * Stream a converse call via SSE (Lambda Function URL).
 * Falls back to non-streaming converse() if no stream URL is configured.
 */
export async function converseStream(
  params: ConverseParams,
  onEvent: (event: StreamEvent) => void,
): Promise<AgentResponse> {
  const streamUrl = process.env.NEXT_PUBLIC_AGENT_STREAM_URL;

  // Fallback: no stream URL configured — use standard converse
  if (!streamUrl) {
    const response = await converse(params);
    onEvent({ type: 'done', data: response });
    return response;
  }

  const res = await fetch(`${getAgentBase()}/converse`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Stream request failed: ${res.status} — ${body}`);
  }

  if (!res.body) {
    throw new Error('No response body — streaming not supported');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResponse: AgentResponse | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE lines: "data: {...}\n\n"
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        try {
          const event: StreamEvent = JSON.parse(trimmed.slice(6));
          onEvent(event);

          if (event.type === 'done') {
            finalResponse = event.data;
          }
        } catch {
          // malformed SSE line — skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!finalResponse) {
    throw new Error('Stream ended without a final response');
  }

  return finalResponse;
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

  const res = await fetch(`${getAgentBase()}/upload`, {
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
  const result = await request<{ documents: DocumentMetadata[] }>(`/documents/${sessionKey}`, undefined, getAgentBase());
  return result.documents;
}

export async function getDocument(
  sessionKey: string,
  fileId: string,
): Promise<{ metadata: DocumentMetadata; categorization: any | null }> {
  return request(`/documents/${sessionKey}/${fileId}`, undefined, getAgentBase());
}

// ─── Export ──────────────────────────────────────────────────────────────────

export async function getExportSummary(sessionKey: string): Promise<TaxReturnSummary> {
  return request<TaxReturnSummary>(`/export/${sessionKey}/summary`, undefined, getAgentBase());
}

export async function downloadPdf(sessionKey: string): Promise<Blob> {
  const pdfHeaders: Record<string, string> = {
    'Accept': 'application/pdf',
  };
  const pdfToken = storage.getItem('idToken');
  if (pdfToken && pdfToken !== 'dev-token') {
    pdfHeaders['Authorization'] = `Bearer ${pdfToken}`;
  }

  const res = await fetch(`${getAgentBase()}/export/${sessionKey}/pdf`, { headers: pdfHeaders });
  if (!res.ok) {
    throw new Error(`PDF download failed: ${res.status}`);
  }
  return res.blob();
}

// ─── History ─────────────────────────────────────────────────────────────────

export async function getChatHistory(sessionKey: string): Promise<{ messages: ChatMessage[] }> {
  return request<{ messages: ChatMessage[] }>(`/history/${sessionKey}`, undefined, getAgentBase());
}

// ─── Chat Session Management ────────────────────────────────────────────────

/** List all persisted chat sessions for the authenticated user. */
export async function listChatSessions(_idToken?: string | null): Promise<ChatSessionSummary[]> {
  const res = await fetch(`${getAgentBase()}/chat/sessions`, { headers: getAuthHeaders() });
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
