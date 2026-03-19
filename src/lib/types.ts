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

// ─── Stripe Types ───────────────────────────────────────────────────────────

export interface StripeConnectStatus {
  connected: boolean;
  accountId: string | null;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
}

export interface InvoicePaymentLink {
  invoiceId: string;
  paymentUrl: string;
  amount: number;
  status: 'unpaid' | 'paid' | 'expired';
}
