/**
 * paisatax-web-user/src/lib/files-api.ts
 *
 * Standalone files API — uploads directly via docproc (no agent/session).
 * Dev: hits paisatax-agent /files/* endpoints (filesystem store)
 * Prod: hits UserDataLambda for S3 storage + TaxLambda for classification
 */

import type { DocumentMetadata, MileageEntry, HomeOfficeEntry, BookkeepingNodeAssignment, Invoice, Contractor, ContractorPayment, Filing1099, StripeConnectStatus, ContractorConnectStatus } from './types';
import { storage } from './storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002/api/agent';

/**
 * Derive the API Gateway root from NEXT_PUBLIC_API_URL by stripping the Lambda path.
 * e.g. "https://xxx.execute-api.us-east-1.amazonaws.com/prod/api/tax" → "https://xxx.execute-api.us-east-1.amazonaws.com/prod"
 * In dev mode the agent handles everything so we just use API_BASE.
 */
function getGatewayRoot(): string | null {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) return null; // dev mode
  // Strip /api/tax, /api/agent, /api/bucket suffix
  return url.replace(/\/api\/(tax|agent|bucket)$/, '');
}

/** Tax-graph Lambda base (most API calls). */
function getBase(): string {
  const root = getGatewayRoot();
  return root ? `${root}/api/tax` : API_BASE;
}

/** UserData Lambda base (S3 bucket operations: files, completed-returns). */
function getBucketBase(): string {
  const root = getGatewayRoot();
  return root ? `${root}/api/bucket` : API_BASE;
}

/** Agent Lambda base (AI chat, converse). */
function getAgentBase(): string {
  const root = getGatewayRoot();
  return root ? `${root}/api/agent` : API_BASE;
}

/** Database base (UserData Lambda — DynamoDB operations). */
function getDatabaseBase(): string {
  const root = getGatewayRoot();
  return root ? `${root}/api/database` : API_BASE;
}

/** Resolve token: use explicit param if provided, otherwise read from localStorage. */
function resolveToken(idToken?: string | null): string | null {
  if (idToken) return idToken;
  return storage.getItem('idToken');
}

/** Whether we are running against production API Gateway (not localhost). */
function isProd(): boolean {
  return getGatewayRoot() !== null;
}

/**
 * Upload files for classification + extraction.
 * Dev: agent Lambda docproc (filesystem store).
 * Prod: S3 via UserData Lambda (bucket endpoint).
 */
export async function uploadFilesForClassification(
  userId: string,
  files: File[],
  idToken?: string | null,
): Promise<{ documents: DocumentMetadata[] }> {
  if (isProd()) {
    // Prod: upload each file to S3 via bucket Lambda
    const uploadToken = resolveToken(idToken);
    const hdrs: Record<string, string> = {};
    if (uploadToken && uploadToken !== 'dev-token') {
      hdrs['Authorization'] = `Bearer ${uploadToken}`;
    }
    hdrs['Content-Type'] = 'application/json';

    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), ''),
      );
      await fetch(`${getBucketBase()}/users/${userId}/tax-documents`, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({ fileContent: base64, fileName: file.name }),
      });
    }

    // After uploading, list all files to return updated list
    const docs = await listUserFiles(userId, idToken);
    return { documents: docs };
  }

  // Dev: agent Lambda docproc
  const formData = new FormData();
  formData.append('userId', userId);
  for (const file of files) {
    formData.append('files', file);
  }

  const headers: Record<string, string> = {};
  const uploadToken = resolveToken(idToken);
  if (uploadToken && uploadToken !== 'dev-token') {
    headers['Authorization'] = `Bearer ${uploadToken}`;
  }

  const res = await fetch(`${getAgentBase()}/files/upload`, {
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
 * Dev: agent Lambda filesystem store.
 * Prod: S3 via UserData Lambda (bucket endpoint).
 */
export async function listUserFiles(
  userId: string,
  idToken?: string | null,
): Promise<DocumentMetadata[]> {
  if (isProd()) {
    // Prod: list S3 objects via bucket Lambda
    const res = await fetch(
      `${getBucketBase()}/users/${userId}/tax-documents`,
      { headers: authHeaders(idToken) },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error ?? body.message ?? `Failed to list files: ${res.status}`);
    }
    const raw = await res.json();
    // The Lambda response may be double-wrapped: { statusCode, body: '{"files":[...]}' }
    const data = typeof raw.body === 'string' ? JSON.parse(raw.body) : raw;
    // Map S3 listing { name, lastModified, size } → DocumentMetadata shape
    const files: Array<{ name: string; lastModified: string; size: number }> = data.files ?? [];
    return files.map((f) => ({
      fileId: f.name,
      sessionKey: `user_${userId}`,
      userId,
      originalName: f.name,
      displayName: f.name,
      mimeType: guessMimeType(f.name),
      sizeBytes: f.size,
      contentHash: '',
      status: 'complete' as const,
      createdAt: typeof f.lastModified === 'string' ? f.lastModified : new Date(f.lastModified).toISOString(),
      updatedAt: typeof f.lastModified === 'string' ? f.lastModified : new Date(f.lastModified).toISOString(),
      s3OriginalKey: `users/${userId}/tax-documents/${f.name}`,
      s3CategorizationKey: '',
      formId: null,
      irsFormName: null,
      taxYear: null,
      classificationConfidence: null,
      classificationMethod: null,
      isBookkeepingDoc: false,
      isJunk: false,
      extractedFieldCount: 0,
      validationIssueCount: 0,
      errorMessage: null,
    } as DocumentMetadata));
  }

  // Dev: agent Lambda
  const res = await fetch(`${getAgentBase()}/files/${userId}`, { headers: authHeaders(idToken) });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Failed to list files: ${res.status}`);
  }
  const data = await res.json();
  return data.documents;
}

function guessMimeType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'application/octet-stream';
}

/**
 * Get single file detail with categorization data.
 * In prod, returns minimal metadata (no docproc extraction data).
 */
export async function getFileDetail(
  userId: string,
  fileId: string,
  idToken?: string | null,
): Promise<{ metadata: DocumentMetadata; categorization: any | null }> {
  if (isProd()) {
    // No per-file detail endpoint in prod S3 — return stub
    return {
      metadata: {
        fileId,
        sessionKey: `user_${userId}`,
        userId,
        originalName: fileId,
        displayName: fileId,
        mimeType: guessMimeType(fileId),
        sizeBytes: 0,
        contentHash: '',
        status: 'complete' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        s3OriginalKey: `users/${userId}/tax-documents/${fileId}`,
        s3CategorizationKey: '',
        formId: null,
        irsFormName: null,
        taxYear: null,
        classificationConfidence: null,
        classificationMethod: null,
        isBookkeepingDoc: false,
        isJunk: false,
        extractedFieldCount: 0,
        validationIssueCount: 0,
        errorMessage: null,
      } as DocumentMetadata,
      categorization: null,
    };
  }

  const res = await fetch(`${getAgentBase()}/files/${userId}/${fileId}`, { headers: authHeaders(idToken) });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Failed to get file: ${res.status}`);
  }
  return res.json();
}

/**
 * Get the download URL for a file's original content.
 * Dev: agent Lambda download endpoint.
 * Prod: S3 via bucket Lambda.
 */
export function getFileDownloadUrl(
  userId: string,
  fileId: string,
): string {
  if (isProd()) {
    return `${getBucketBase()}/users/${userId}/tax-documents/${fileId}`;
  }
  return `${getAgentBase()}/files/${userId}/${fileId}/download`;
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
  const token = resolveToken(idToken);
  if (token && token !== 'dev-token') {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Fetch user profile from UserInfoTable (DynamoDB) via the UserData Lambda.
 * Path: GET /api/database/users/{userId}/sensitive
 */
export async function fetchUserProfile(
  userId: string,
  idToken?: string | null,
): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(
      `${getDatabaseBase()}/users/${userId}/sensitive`,
      { headers: authHeaders(idToken) },
    );
    if (!res.ok) return null;
    const raw = await res.json();
    const data = typeof raw.body === 'string' ? JSON.parse(raw.body) : raw;
    return data && Object.keys(data).length > 0 ? data : null;
  } catch {
    return null;
  }
}

export async function fetchAccountProfile(
  userId: string,
  idToken?: string | null,
): Promise<Record<string, any> | null> {
  const headers = authHeaders(idToken);

  if (isProd()) {
    const [databaseProfile, accountProfile] = await Promise.all([
      fetchUserProfile(userId, idToken),
      fetch(`${getAgentBase()}/users/${userId}/profile`, { headers })
        .then(async (res) => (res.ok ? res.json() : null))
        .catch(() => null),
    ]);
    const merged = { ...(databaseProfile ?? {}), ...(accountProfile ?? {}) };
    return Object.keys(merged).length > 0 ? merged : null;
  }

  try {
    const res = await fetch(`${getAgentBase()}/users/${userId}/profile`, { headers });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function updateAccountProfile(
  userId: string,
  body: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    preferredLanguage: string;
  },
  idToken?: string | null,
): Promise<Record<string, any>> {
  const res = await fetch(`${getAgentBase()}/users/${userId}/profile`, {
    method: 'PUT',
    headers: authHeaders(idToken),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error ?? data.message ?? `Failed to update profile: ${res.status}`);
  }

  return res.json();
}

export async function getBooksSummary(
  userId: string,
  quarter: number,
  year?: string,
  idToken?: string | null,
): Promise<BooksSummary> {
  const params = new URLSearchParams({ quarter: String(quarter) });
  if (year) params.set('year', year);
  const res = await fetch(`${getAgentBase()}/books/${userId}/summary?${params}`, {
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
  const res = await fetch(`${getAgentBase()}/books/${userId}/mileage`, {
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
  await fetch(`${getAgentBase()}/books/${userId}/mileage`, {
    method: 'PUT',
    headers: authHeaders(idToken),
    body: JSON.stringify({ entries }),
  });
}

export async function getHomeOffice(
  userId: string,
  idToken?: string | null,
): Promise<HomeOfficeEntry | null> {
  const res = await fetch(`${getAgentBase()}/books/${userId}/home-office`, {
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
  await fetch(`${getAgentBase()}/books/${userId}/home-office`, {
    method: 'PUT',
    headers: authHeaders(idToken),
    body: JSON.stringify({ entry }),
  });
}

export async function getManualEntries(
  userId: string,
  idToken?: string | null,
): Promise<BookkeepingNodeAssignment[]> {
  const res = await fetch(`${getAgentBase()}/books/${userId}/manual-entries`, {
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
  await fetch(`${getAgentBase()}/books/${userId}/manual-entries`, {
    method: 'PUT',
    headers: authHeaders(idToken),
    body: JSON.stringify({ entries }),
  });
}

export function getQuarterlyReportUrl(userId: string, quarter: number): string {
  return `${getAgentBase()}/books/${userId}/quarterly-report?quarter=${quarter}&format=pdf`;
}

// ─── Invoices API ────────────────────────────────────────────────────────────

export async function getInvoices(
  userId: string,
  idToken?: string | null,
): Promise<Invoice[]> {
  const res = await fetch(`${getAgentBase()}/invoices/${userId}`, {
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
  const res = await fetch(`${getAgentBase()}/invoices/${userId}`, {
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
  const res = await fetch(`${getAgentBase()}/invoices/${userId}/${invoiceId}`, {
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
  await fetch(`${getAgentBase()}/invoices/${userId}/${invoiceId}`, {
    method: 'DELETE',
    headers: authHeaders(idToken),
  });
}

export async function createPaymentLink(
  userId: string,
  invoiceId: string,
  idToken?: string | null,
): Promise<{ paymentUrl: string; invoice: Invoice }> {
  const res = await fetch(`${getAgentBase()}/stripe/${userId}/create-payment-link`, {
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

export async function syncInvoicePaymentStatus(
  userId: string,
  invoiceId: string,
  idToken?: string | null,
): Promise<{ invoice: Invoice; synced: boolean }> {
  const res = await fetch(`${getAgentBase()}/stripe/${userId}/invoices/${invoiceId}/sync-status`, {
    method: 'POST',
    headers: authHeaders(idToken),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Failed to sync invoice payment: ${res.status}`);
  }
  return res.json();
}

// ─── Contractors API ─────────────────────────────────────────────────────────

export async function getContractors(
  userId: string,
  idToken?: string | null,
): Promise<Contractor[]> {
  const res = await fetch(`${getAgentBase()}/contractors/${userId}`, {
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
  const res = await fetch(`${getAgentBase()}/contractors/${userId}`, {
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
  const res = await fetch(`${getAgentBase()}/contractors/${userId}/${contractorId}`, {
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
  await fetch(`${getAgentBase()}/contractors/${userId}/${contractorId}`, {
    method: 'DELETE',
    headers: authHeaders(idToken),
  });
}

// ─── Contractor Payments API ─────────────────────────────────────────────────

export async function getContractorPayments(
  userId: string,
  contractorId: string,
  idToken?: string | null,
): Promise<ContractorPayment[]> {
  const res = await fetch(`${getAgentBase()}/contractors/${userId}/${contractorId}/payments`, {
    headers: authHeaders(idToken),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.payments ?? [];
}

export async function recordContractorPayment(
  userId: string,
  contractorId: string,
  payment: { amount: number; date: string; method: string; description?: string },
  idToken?: string | null,
): Promise<{ payment: ContractorPayment; contractor: Contractor }> {
  const res = await fetch(`${getAgentBase()}/contractors/${userId}/${contractorId}/payments`, {
    method: 'POST',
    headers: authHeaders(idToken),
    body: JSON.stringify(payment),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Failed to record payment: ${res.status}`);
  }
  return res.json();
}

export async function deleteContractorPayment(
  userId: string,
  contractorId: string,
  paymentId: string,
  idToken?: string | null,
): Promise<void> {
  await fetch(`${getAgentBase()}/contractors/${userId}/${contractorId}/payments/${paymentId}`, {
    method: 'DELETE',
    headers: authHeaders(idToken),
  });
}

// ─── Pay Contractor via Stripe ───────────────────────────────────────────────

export async function payContractorViaStripe(
  userId: string,
  contractorId: string,
  data: { amount: number; description?: string },
  idToken?: string | null,
): Promise<{ checkoutUrl: string }> {
  const res = await fetch(`${getAgentBase()}/contractors/${userId}/${contractorId}/pay-via-stripe`, {
    method: 'POST',
    headers: authHeaders(idToken),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Failed to pay via Stripe: ${res.status}`);
  }
  return res.json();
}

// ─── 1099-NEC API ────────────────────────────────────────────────────────────

export async function generate1099NEC(
  userId: string,
  contractorId: string,
  data: { taxYear: string; payerName: string; payerEIN?: string; payerAddress?: string },
  idToken?: string | null,
): Promise<{ filing: Filing1099; totalNEC: number }> {
  const res = await fetch(`${getAgentBase()}/contractors/${userId}/${contractorId}/generate-1099`, {
    method: 'POST',
    headers: authHeaders(idToken),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Failed to generate 1099: ${res.status}`);
  }
  return res.json();
}

export async function get1099Filings(
  userId: string,
  idToken?: string | null,
): Promise<Filing1099[]> {
  const res = await fetch(`${getAgentBase()}/contractors/${userId}/1099-filings`, {
    headers: authHeaders(idToken),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.filings ?? [];
}

export async function send1099ToContractor(
  userId: string,
  filingId: string,
  idToken?: string | null,
): Promise<{ filing: Filing1099; message: string }> {
  const res = await fetch(`${getAgentBase()}/contractors/${userId}/1099-filings/${filingId}/send-to-contractor`, {
    method: 'POST',
    headers: authHeaders(idToken),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Failed: ${res.status}`);
  }
  return res.json();
}

export async function file1099WithIRS(
  userId: string,
  filingId: string,
  idToken?: string | null,
): Promise<{ filing: Filing1099; message: string }> {
  const res = await fetch(`${getAgentBase()}/contractors/${userId}/1099-filings/${filingId}/file-with-irs`, {
    method: 'POST',
    headers: authHeaders(idToken),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Failed: ${res.status}`);
  }
  return res.json();
}

// ─── Stripe Connect API ─────────────────────────────────────────────────────

export async function getStripeStatus(
  userId: string,
  idToken?: string | null,
): Promise<StripeConnectStatus> {
  const res = await fetch(`${getAgentBase()}/stripe/${userId}/status`, {
    headers: authHeaders(idToken),
  });
  if (!res.ok) return { connected: false, accountId: null, payoutsEnabled: false, chargesEnabled: false };
  return res.json();
}

// Create Stripe Connect Express account for the user
export async function createStripeAccount(
  userId: string,
  data: { email?: string; businessName?: string; country?: string },
  idToken?: string | null,
): Promise<{ accountId: string; alreadyExists?: boolean }> {
  const res = await fetch(`${getAgentBase()}/stripe/${userId}/create-account`, {
    method: 'POST',
    headers: authHeaders(idToken),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Failed to create Stripe account: ${res.status}`);
  }
  return res.json();
}

// Get Stripe Express onboarding URL
export async function getStripeOnboardingLink(
  userId: string,
  data?: { returnUrl?: string; refreshUrl?: string },
  idToken?: string | null,
): Promise<{ url: string }> {
  const res = await fetch(`${getAgentBase()}/stripe/${userId}/onboarding-link`, {
    method: 'POST',
    headers: authHeaders(idToken),
    body: JSON.stringify(data ?? {}),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Failed to get onboarding link: ${res.status}`);
  }
  return res.json();
}

// Get Stripe Express dashboard login link
export async function getStripeDashboardLink(
  userId: string,
  idToken?: string | null,
): Promise<{ url: string }> {
  const res = await fetch(`${getAgentBase()}/stripe/${userId}/login-link`, {
    method: 'POST',
    headers: authHeaders(idToken),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Failed to get dashboard link: ${res.status}`);
  }
  return res.json();
}

// Prepare a token purchase or subscription billing intent.
export async function buyTokens(
  userId: string,
  offerId: string,
  idToken?: string | null,
): Promise<{
  clientSecret?: string | null;
  paymentIntentId?: string;
  subscriptionId?: string;
  devMode?: boolean;
  grantedTokens?: number;
  offerId?: string;
  offerKind?: 'one_time' | 'subscription';
  message?: string;
}> {
  const endpoint = isProd()
    ? `${getBase()}/tokens/${userId}/purchase`
    : `${getAgentBase()}/stripe/${userId}/buy-tokens`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: authHeaders(idToken),
    body: JSON.stringify({ offerId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Failed: ${res.status}`);
  }
  return res.json();
}

export async function confirmTokenPurchase(
  userId: string,
  data: { paymentIntentId?: string; subscriptionId?: string },
  idToken?: string | null,
): Promise<{ tokens: number; grantedTokens: number; offerKind: 'one_time' | 'subscription'; message: string }> {
  const endpoint = `${getAgentBase()}/stripe/${userId}/confirm-token-purchase`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: authHeaders(idToken),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Failed: ${res.status}`);
  }
  return res.json();
}

// Get token balance (hits tax-graph Lambda: GET /tokens/:userId)
export async function getTokenBalance(
  userId: string,
  idToken?: string | null,
): Promise<{ tokens: number; purchases: any[] }> {
  const endpoint = isProd()
    ? `${getBase()}/tokens/${userId}`
    : `${getAgentBase()}/stripe/${userId}/token-balance`;

  const res = await fetch(endpoint, {
    headers: authHeaders(idToken),
  });
  if (!res.ok) return { tokens: 0, purchases: [] };
  return res.json();
}

// Disconnect Stripe account
export async function disconnectStripe(
  userId: string,
  idToken?: string | null,
): Promise<StripeConnectStatus> {
  const res = await fetch(`${getAgentBase()}/stripe/${userId}/disconnect`, {
    method: 'POST',
    headers: authHeaders(idToken),
  });
  if (!res.ok) return { connected: false, accountId: null, payoutsEnabled: false, chargesEnabled: false };
  return res.json();
}

// ─── Contractor Stripe Connect API ──────────────────────────────────────────

export async function createContractorConnectAccount(
  userId: string,
  contractorId: string,
  idToken?: string | null,
): Promise<{ accountId: string; alreadyExists?: boolean }> {
  const res = await fetch(`${getAgentBase()}/contractors/${userId}/${contractorId}/create-connect-account`, {
    method: 'POST',
    headers: authHeaders(idToken),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Failed: ${res.status}`);
  }
  return res.json();
}

export async function getContractorOnboardingLink(
  userId: string,
  contractorId: string,
  data?: { returnUrl?: string; refreshUrl?: string },
  idToken?: string | null,
): Promise<{ url: string; contractorName: string }> {
  const res = await fetch(`${getAgentBase()}/contractors/${userId}/${contractorId}/onboarding-link`, {
    method: 'POST',
    headers: authHeaders(idToken),
    body: JSON.stringify(data ?? {}),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? body.message ?? `Failed: ${res.status}`);
  }
  return res.json();
}

export async function getContractorConnectStatus(
  userId: string,
  contractorId: string,
  idToken?: string | null,
): Promise<ContractorConnectStatus> {
  const res = await fetch(`${getAgentBase()}/contractors/${userId}/${contractorId}/connect-status`, {
    headers: authHeaders(idToken),
  });
  if (!res.ok) return { hasAccount: false, onboardingComplete: false, payoutsEnabled: false };
  return res.json();
}

// ─── Completed Returns API ───────────────────────────────────────────────────

// Returns go through the UserData lambda (api/bucket), not the tax-graph API.

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
  const res = await fetch(`${getBucketBase()}/users/${userId}/completed-returns`, {
    headers: authHeaders(idToken),
  });

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
  return `${getBucketBase()}/users/${userId}/completed-returns/${fileName}`;
}
