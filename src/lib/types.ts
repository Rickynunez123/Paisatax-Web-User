/**
 * paisatax-web-user/src/lib/types.ts
 *
 * Frontend DTOs — mirrors paisatax-agent/src/types/agent.types.ts
 */

export type AgentPhase = 'intake' | 'documents' | 'qa' | 'review';

export interface QuickReplyOption {
  label: string;
  value: string;
}

// ─── Message Block Types ─────────────────────────────────────────────────────

export type AgentMessageBlock =
  | { type: 'text'; content: string }
  | { type: 'quick_reply'; content: string; options: QuickReplyOption[] }
  | {
      type: 'confirmation';
      content: string;
      fields: Array<{ label: string; value: string | number | boolean; nodeId: string }>;
    }
  | {
      type: 'summary';
      refund: number | null;
      owed: number | null;
      progress: number;
      phase: AgentPhase;
      agi?: number | null;
      totalIncome?: number | null;
      totalTax?: number | null;
    }
  | { type: 'upload_prompt'; content: string; acceptedTypes?: string[] }
  | {
      type: 'document_review';
      content: string;
      documents: Array<{
        formName: string;
        formId: string;
        fields: Array<{ label: string; value: string | number | boolean | null; nodeId: string }>;
      }>;
    }
  | { type: 'payment'; content: string; amount?: number }
  | {
      type: 'download';
      content: string;
      sessionKey?: string;
      refund?: number | null;
      amountOwed?: number | null;
      primaryName?: string;
      filingStatus?: string;
      forms?: string[];
    }
  | {
      type: 'onboarding_basics';
      isReturning: boolean;
      prefilled: { year: string; status: string; dependents: boolean | null };
    }
  | {
      type: 'onboarding_files';
      files: Array<{ fileId: string; displayName: string; formId: string | null }>;
    }
  | {
      type: 'onboarding_profiles';
      isReturning: boolean;
      preselected: string[];
    }
  | {
      type: 'onboarding_identity';
      isReturning: boolean;
      showSpouse: boolean;
      showDependents: boolean;
      prefilled: {
        primary: Record<string, string>;
        spouse: Record<string, string>;
        dependents: Array<Record<string, string>>;
      };
    };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  blocks: AgentMessageBlock[];
  timestamp: string;
}

// ─── API Request/Response Types ──────────────────────────────────────────────

export interface CreateSessionResponse {
  sessionKey: string;
  filingStatus: string;
}

export interface ConfirmedFieldValue {
  nodeId: string;
  value: string | number | boolean | null;
}

export interface ConverseRequest {
  sessionKey: string;
  message?: string;
  selectedOption?: string;
  confirmedFields?: ConfirmedFieldValue[];
  rejectedFields?: string[];
}

export interface AgentResponse {
  messages: AgentMessageBlock[];
  sessionKey: string;
  phase: AgentPhase;
  progress: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalSessionTokens: number;
  };
}

export interface TaxReturnSummary {
  taxYear: string;
  filingStatus: string;
  primaryName: string;
  spouseName?: string;
  totalIncome: number | null;
  adjustedGrossIncome: number | null;
  taxableIncome: number | null;
  totalTax: number | null;
  totalPayments: number | null;
  refund: number | null;
  amountOwed: number | null;
  forms: Array<{
    formId: string;
    irsFormName: string;
    title: { en: string; es: string };
    slotCount: number;
  }>;
}

// ─── Document Pipeline Types ─────────────────────────────────────────────────

export type DocumentStatus =
  | 'uploaded'
  | 'classifying'
  | 'extracting'
  | 'categorizing'
  | 'complete'
  | 'failed';

export interface DocumentMetadata {
  sessionKey: string;
  fileId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;
  s3OriginalKey: string;
  s3CategorizationKey: string;
  status: DocumentStatus;
  formId: string | null;
  irsFormName: string | null;
  isBookkeepingDoc: boolean;
  isJunk: boolean;
  classificationMethod: string | null;
  classificationConfidence: number | null;
  extractedFieldCount: number;
  validationIssueCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  displayName?: string;
}

export interface DuplicateWarning {
  originalName: string;
  existingFile: string | null;
}

export interface UploadResponse extends AgentResponse {
  duplicateWarnings?: DuplicateWarning[];
}

/** Extracted field from a tax form (IRS). */
export interface ExtractedField {
  nodeIdPattern: string;
  shortLabel: string;
  value: number | boolean | string | null;
  confidence: number;
  parseAs: string;
  valueType: string;
}

/** Validation issue from extraction. */
export interface ValidationIssue {
  nodeIdPattern: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
}

/** Bookkeeping node assignment (receipts, invoices, etc.). */
export interface BookkeepingNodeAssignment {
  rawDescription: string;
  extractedAmount: number | null;
  extractedDate: string | null;
  assignedNodeId: string;
  assignedCategory: string;
  isIncome: boolean;
  confidence: number;
  needsReview: boolean;
}

/** Full categorization payload from docproc. */
export interface DocumentCategorization {
  fileId: string;
  sessionKey?: string;
  originalName: string;
  documentType: string | null;
  taxYear: string | null;
  quarter: number | null;
  classification: {
    formId: string | null;
    irsFormName: string | null;
    method: string;
    confidence: number;
    isJunk: boolean;
    reason: string | null;
  };
  extraction: {
    fields: ExtractedField[];
    processingTimeMs: number;
  } | null;
  validation: {
    isValid: boolean;
    issues: ValidationIssue[];
  } | null;
  categorization: {
    assignments: BookkeepingNodeAssignment[];
    processingTimeMs: number;
  } | null;
  status: DocumentStatus;
  processedAt: string;
}

/** Result from processUploadBatch — per-file extracted fields. */
export interface ProcessedDocument {
  fileId: string;
  formId: string | null;
  irsFormName: string | null;
  fields: Array<{
    nodeId: string;
    label: string;
    value: string | number | boolean | null;
    confidence: number;
  }>;
}

// ─── User Mode & Bookkeeping Types ──────────────────────────────────────────

export type UserMode = 'personal' | 'business';

export interface UserProfile {
  mode: UserMode;
}

export interface MileageEntry {
  id: string;
  date: string;
  miles: number;
  purpose: string;
  quarter: 1 | 2 | 3 | 4;
  year: string;
}

export interface HomeOfficeEntry {
  squareFootage: number;
  totalSquareFootage: number;
  method: 'simplified' | 'regular';
  year: string;
}

// ─── Invoice & Contractor Types ─────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  userId: string;
  clientName: string;
  clientEmail: string;
  contractorId?: string;
  items: InvoiceLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  paymentLinkUrl?: string;
  stripeInvoiceId?: string;
  stripeCustomerId?: string;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  notes?: string;
  invoiceNumber: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contractor {
  id: string;
  userId: string;
  name: string;
  email: string;
  businessName?: string;
  ein?: string;
  address?: string;
  ytdPayments: number;
  needs1099: boolean;
  stripeAccountId?: string;
  stripeOnboardingComplete?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod = 'check' | 'bank_transfer' | 'zelle' | 'venmo' | 'cash' | 'stripe' | 'other';

export interface ContractorPayment {
  id: string;
  contractorId: string;
  contractorName: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  description: string;
  stripeTransferId?: string;
  createdAt: string;
}

export interface Filing1099 {
  id: string;
  contractorId: string;
  contractorName: string;
  taxYear: string;
  totalNEC: number;
  filename: string;
  generatedAt: string;
  sentToContractor: boolean;
  sentToContractorAt?: string;
  filedWithIRS: boolean;
  filedWithIRSAt?: string;
  irsConfirmationNumber?: string;
}

// ─── Chat Session Persistence ───────────────────────────────────────────────

export interface ChatSessionSummary {
  sessionKey: string;
  userId: string;
  messageCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Stripe Types ───────────────────────────────────────────────────────────

export interface StripeConnectStatus {
  connected: boolean;
  accountId: string | null;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  detailsSubmitted?: boolean;
  requiresAction?: boolean;
}

export interface ContractorConnectStatus {
  hasAccount: boolean;
  onboardingComplete: boolean;
  payoutsEnabled: boolean;
  chargesEnabled?: boolean;
  accountId?: string;
}

export interface InvoicePaymentLink {
  invoiceId: string;
  paymentUrl: string;
  amount: number;
  status: 'unpaid' | 'paid' | 'expired';
}
