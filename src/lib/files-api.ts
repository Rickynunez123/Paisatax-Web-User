/**
 * paisatax-web-user/src/lib/files-api.ts
 *
 * Standalone files API — uploads directly via docproc (no agent/session).
 * Dev: hits paisatax-agent /files/* endpoints (filesystem store)
 * Prod: hits UserDataLambda for S3 storage + TaxLambda for classification
 */

import type { DocumentMetadata, MileageEntry, HomeOfficeEntry, BookkeepingNodeAssignment, Invoice, Contractor, StripeConnectStatus } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002/api/agent';

// In production, this would point to the UserDataLambda API Gateway
const PROD_API_BASE = process.env.NEXT_PUBLIC_PROD_API_URL;

function getBase(): string {
  return PROD_API_BASE ?? API_BASE;
}

/**
 * Upload files for classification + extraction (synchronous).
 * Returns the full list of documents for this user after processing.
 */
export async function uploadFilesForClassification(
  userId: string,
  files: File[],
  idToken?: string | null,
): Promise<{ documents: DocumentMetadata[] }> {
  const formData = new FormData();
  formData.append('userId', userId);
  for (const file of files) {
    formData.append('files', file);
  }

  const headers: Record<string, string> = {};
  if (idToken && idToken !== 'dev-token') {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  const res = await fetch(`${getBase()}/files/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Upload failed: ${res.status}`);
  }

  return res.json();
}

/**
 * List all documents for a user.
 */
export async function listUserFiles(
  userId: string,
  idToken?: string | null,
): Promise<DocumentMetadata[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken && idToken !== 'dev-token') {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  const res = await fetch(`${getBase()}/files/${userId}`, { headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Failed to list files: ${res.status}`);
  }

  const data = await res.json();
  return data.documents;
}

/**
 * Get single file detail with categorization data.
 */
export async function getFileDetail(
  userId: string,
  fileId: string,
  idToken?: string | null,
): Promise<{ metadata: DocumentMetadata; categorization: any | null }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken && idToken !== 'dev-token') {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  const res = await fetch(`${getBase()}/files/${userId}/${fileId}`, { headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Failed to get file: ${res.status}`);
  }

  return res.json();
}

/**
 * Get the download URL for a file's original content.
 */
export function getFileDownloadUrl(
  userId: string,
  fileId: string,
): string {
  return `${getBase()}/files/${userId}/${fileId}/download`;
}

// ─── Books API ──────────────────────────────────────────────────────────────

export interface BooksSummary {
  quarter: number;
  year: string;
  income: {
    grossReceipts: number;
    returnsAllowances: number;
    otherIncome: number;
    grossProfit: number;
    grossIncome: number;
  };
  expenses: Array<{ lineId: string; label: string; amount: number }>;
  totalExpenses: number;
  netProfit: number;
  seTax: number;
  paymentOwed: number;
  mileage: {
    entries: MileageEntry[];
    totalMiles: number;
    deduction: number;
    ratePerMile: number;
  };
  homeOffice: (HomeOfficeEntry & { deduction: number }) | null;
  documentCount: number;
  assignmentCount: number;
}

function authHeaders(idToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken && idToken !== 'dev-token') {
    headers['Authorization'] = `Bearer ${idToken}`;
  }
  return headers;
}

export async function getBooksSummary(
  userId: string,
  quarter: number,
  year?: string,
  idToken?: string | null,
): Promise<BooksSummary> {
  const params = new URLSearchParams({ quarter: String(quarter) });
  if (year) params.set('year', year);
  const res = await fetch(`${getBase()}/books/${userId}/summary?${params}`, {
    headers: authHeaders(idToken),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Failed to get books summary: ${res.status}`);
  }
  return res.json();
}

export async function getMileageEntries(
  userId: string,
  idToken?: string | null,
): Promise<MileageEntry[]> {
  const res = await fetch(`${getBase()}/books/${userId}/mileage`, {
    headers: authHeaders(idToken),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.entries ?? [];
}

export async function saveMileageEntries(
  userId: string,
  entries: MileageEntry[],
  idToken?: string | null,
): Promise<void> {
  await fetch(`${getBase()}/books/${userId}/mileage`, {
    method: 'PUT',
    headers: authHeaders(idToken),
    body: JSON.stringify({ entries }),
  });
}

export async function getHomeOffice(
  userId: string,
  idToken?: string | null,
): Promise<HomeOfficeEntry | null> {
  const res = await fetch(`${getBase()}/books/${userId}/home-office`, {
    headers: authHeaders(idToken),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.entry ?? null;
}

export async function saveHomeOffice(
  userId: string,
  entry: HomeOfficeEntry,
  idToken?: string | null,
): Promise<void> {
  await fetch(`${getBase()}/books/${userId}/home-office`, {
    method: 'PUT',
    headers: authHeaders(idToken),
    body: JSON.stringify({ entry }),
  });
}

export async function getManualEntries(
  userId: string,
  idToken?: string | null,
): Promise<BookkeepingNodeAssignment[]> {
  const res = await fetch(`${getBase()}/books/${userId}/manual-entries`, {
    headers: authHeaders(idToken),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.entries ?? [];
}

export async function saveManualEntries(
  userId: string,
  entries: BookkeepingNodeAssignment[],
  idToken?: string | null,
): Promise<void> {
  await fetch(`${getBase()}/books/${userId}/manual-entries`, {
    method: 'PUT',
    headers: authHeaders(idToken),
    body: JSON.stringify({ entries }),
  });
}

export function getQuarterlyReportUrl(userId: string, quarter: number): string {
  return `${getBase()}/books/${userId}/quarterly-report?quarter=${quarter}&format=pdf`;
}

// ─── Invoices API ────────────────────────────────────────────────────────────

export async function getInvoices(
  userId: string,
  idToken?: string | null,
): Promise<Invoice[]> {
  const res = await fetch(`${getBase()}/invoices/${userId}`, {
    headers: authHeaders(idToken),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.invoices ?? [];
}

export async function createInvoice(
  userId: string,
  invoice: Partial<Invoice>,
  idToken?: string | null,
): Promise<Invoice> {
  const res = await fetch(`${getBase()}/invoices/${userId}`, {
    method: 'POST',
    headers: authHeaders(idToken),
    body: JSON.stringify(invoice),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Failed to create invoice: ${res.status}`);
  }
  const data = await res.json();
  return data.invoice;
}

export async function updateInvoice(
  userId: string,
  invoiceId: string,
  updates: Partial<Invoice>,
  idToken?: string | null,
): Promise<Invoice> {
  const res = await fetch(`${getBase()}/invoices/${userId}/${invoiceId}`, {
    method: 'PUT',
    headers: authHeaders(idToken),
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Failed to update invoice: ${res.status}`);
  }
  const data = await res.json();
  return data.invoice;
}

export async function deleteInvoice(
  userId: string,
  invoiceId: string,
  idToken?: string | null,
): Promise<void> {
  await fetch(`${getBase()}/invoices/${userId}/${invoiceId}`, {
    method: 'DELETE',
    headers: authHeaders(idToken),
  });
}

export async function createPaymentLink(
  userId: string,
  invoiceId: string,
  idToken?: string | null,
): Promise<{ paymentUrl: string; invoice: Invoice }> {
  const res = await fetch(`${getBase()}/stripe/${userId}/create-payment-link`, {
    method: 'POST',
    headers: authHeaders(idToken),
    body: JSON.stringify({ invoiceId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Failed to create payment link: ${res.status}`);
  }
  return res.json();
}

// ─── Contractors API ─────────────────────────────────────────────────────────

export async function getContractors(
  userId: string,
  idToken?: string | null,
): Promise<Contractor[]> {
  const res = await fetch(`${getBase()}/contractors/${userId}`, {
    headers: authHeaders(idToken),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.contractors ?? [];
}

export async function createContractor(
  userId: string,
  contractor: Partial<Contractor>,
  idToken?: string | null,
): Promise<Contractor> {
  const res = await fetch(`${getBase()}/contractors/${userId}`, {
    method: 'POST',
    headers: authHeaders(idToken),
    body: JSON.stringify(contractor),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Failed to create contractor: ${res.status}`);
  }
  const data = await res.json();
  return data.contractor;
}

export async function updateContractor(
  userId: string,
  contractorId: string,
  updates: Partial<Contractor>,
  idToken?: string | null,
): Promise<Contractor> {
  const res = await fetch(`${getBase()}/contractors/${userId}/${contractorId}`, {
    method: 'PUT',
    headers: authHeaders(idToken),
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Failed to update contractor: ${res.status}`);
  }
  const data = await res.json();
  return data.contractor;
}

export async function deleteContractor(
  userId: string,
  contractorId: string,
  idToken?: string | null,
): Promise<void> {
  await fetch(`${getBase()}/contractors/${userId}/${contractorId}`, {
    method: 'DELETE',
    headers: authHeaders(idToken),
  });
}

// ─── Stripe Connect API ─────────────────────────────────────────────────────

export async function getStripeStatus(
  userId: string,
  idToken?: string | null,
): Promise<StripeConnectStatus> {
  const res = await fetch(`${getBase()}/stripe/${userId}/status`, {
    headers: authHeaders(idToken),
  });
  if (!res.ok) return { connected: false, accountId: null, payoutsEnabled: false, chargesEnabled: false };
  return res.json();
}

export async function toggleStripeConnect(
  userId: string,
  idToken?: string | null,
): Promise<StripeConnectStatus> {
  const res = await fetch(`${getBase()}/stripe/${userId}/connect`, {
    method: 'POST',
    headers: authHeaders(idToken),
  });
  if (!res.ok) return { connected: false, accountId: null, payoutsEnabled: false, chargesEnabled: false };
  return res.json();
}

// ─── Completed Returns API ───────────────────────────────────────────────────

// Returns go through the UserData lambda (api/bucket), not the tax-graph API.
const BUCKET_API_BASE = process.env.NEXT_PUBLIC_PROD_API_URL
  ? `${process.env.NEXT_PUBLIC_PROD_API_URL}/api/bucket`
  : 'http://localhost:3002/api/agent'; // dev fallback

export interface CompletedReturn {
  name: string;
  size: number;
  lastModified: string;
}

/**
 * List all completed returns for a user.
 */
export async function listCompletedReturns(
  userId: string,
  idToken?: string | null,
): Promise<CompletedReturn[]> {
  const headers: Record<string, string> = {};
  if (idToken && idToken !== 'dev-token') {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  const res = await fetch(`${BUCKET_API_BASE}/users/${userId}/completed-returns`, { headers });

  if (!res.ok) {
    // 404 or empty is fine — no returns yet
    if (res.status === 404) return [];
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Failed to list returns: ${res.status}`);
  }

  const data = await res.json();
  // The lambda-utils response wraps in { message, files }
  const parsed = typeof data.body === 'string' ? JSON.parse(data.body) : data;
  return parsed.files ?? [];
}

/**
 * Get the download URL for a completed return.
 */
export function getReturnDownloadUrl(
  userId: string,
  fileName: string,
): string {
  return `${BUCKET_API_BASE}/users/${userId}/completed-returns/${fileName}`;
}
