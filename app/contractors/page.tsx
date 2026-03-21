'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import ModalPortal from '@/components/ui/ModalPortal';
import { useAuth } from '@/context/AuthContext';
import type { Contractor, ContractorPayment, Filing1099, PaymentMethod } from '@/lib/types';
import {
  getContractors,
  createContractor,
  deleteContractor,
  getContractorPayments,
  recordContractorPayment,
  deleteContractorPayment,
  payContractorViaStripe,
  createContractorConnectAccount,
  getContractorOnboardingLink,
  getContractorConnectStatus,
  generate1099NEC,
  get1099Filings,
  send1099ToContractor,
  file1099WithIRS,
} from '@/lib/files-api';

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// ─── New Contractor Modal ────────────────────────────────────────────────────

function NewContractorModal({ open, onClose, onSave }: {
  open: boolean;
  onClose: () => void;
  onSave: (d: Partial<Contractor>, nextAction: 'invite' | 'record' | 'skip') => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [step, setStep] = useState<'form' | 'next'>('form');
  const [savedData, setSavedData] = useState<Partial<Contractor> | null>(null);

  if (!open) return null;

  const handleContinue = () => {
    if (!name.trim()) return;
    const data = { name: name.trim(), email: email.trim(), businessName: businessName.trim() || undefined };
    setSavedData(data);
    setStep('next');
  };

  const handleAction = (action: 'invite' | 'record' | 'skip') => {
    if (savedData) onSave(savedData, action);
    setName(''); setEmail(''); setBusinessName('');
    setStep('form'); setSavedData(null);
    onClose();
  };

  const handleClose = () => {
    setName(''); setEmail(''); setBusinessName('');
    setStep('form'); setSavedData(null);
    onClose();
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
        <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={handleClose} />
        <div className="lux-panel relative z-10 w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto p-6 sm:-translate-y-4 sm:p-7">

          {step === 'form' ? (
            <>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Add Contractor</h2>
              <div className="mt-5 space-y-4">
                <div>
                  <label className="lux-field-label mb-1.5 block">Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" className="lux-input" />
                </div>
                <div>
                  <label className="lux-field-label mb-1.5 block">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" className="lux-input" />
                </div>
                <div>
                  <label className="lux-field-label mb-1.5 block">Business Name (optional)</label>
                  <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Doe Consulting LLC" className="lux-input" />
                </div>
              </div>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button onClick={handleClose} className="lux-button-secondary px-4 py-2 text-sm font-semibold">Cancel</button>
                <button onClick={handleContinue} disabled={!name.trim()} className="lux-button-primary px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">Continue</button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                How would you like to pay {savedData?.name}?
              </h2>
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                Choose how to get started with this contractor.
              </p>
              <div className="mt-5 space-y-3">
                <button
                  onClick={() => handleAction('invite')}
                  className="flex w-full items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-4 text-left transition-colors hover:border-[var(--color-brand-strong)] hover:bg-[var(--color-brand-soft)]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#635bff]/10 text-[#635bff]">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">Invite to get paid via Stripe</p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                      Send an onboarding link so they can connect their bank account. You&apos;ll be able to pay them directly.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => handleAction('record')}
                  className="flex w-full items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-4 text-left transition-colors hover:border-[var(--color-brand-strong)] hover:bg-[var(--color-brand-soft)]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">Record a payment</p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                      Already paid them? Record the payment for bookkeeping and 1099 tracking.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => handleAction('skip')}
                  className="w-full rounded-[var(--radius-md)] px-4 py-2.5 text-center text-xs font-medium text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]"
                >
                  Skip for now
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </ModalPortal>
  );
}

// ─── Record Payment Modal ───────────────────────────────────────────────────

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank Transfer / ACH' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'check', label: 'Check' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

function RecordPaymentModal({ open, contractor, onClose, onSave }: {
  open: boolean;
  contractor: Contractor | null;
  onClose: () => void;
  onSave: (contractorId: string, data: { amount: number; date: string; method: string; description?: string }) => void;
}) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [description, setDescription] = useState('');

  if (!open || !contractor) return null;

  const handleSave = () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) return;
    onSave(contractor.id, { amount: num, date, method, description: description.trim() || undefined });
    setAmount(''); setDate(new Date().toISOString().slice(0, 10)); setMethod('bank_transfer'); setDescription('');
    onClose();
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
        <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
        <div className="lux-panel relative z-10 w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto p-6 sm:-translate-y-4 sm:p-7">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Record Payment</h2>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">Payment to {contractor.name}</p>
          <div className="mt-5 space-y-4">
            <div>
              <label className="lux-field-label mb-1.5 block">Amount ($)</label>
              <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="lux-input" />
            </div>
            <div>
              <label className="lux-field-label mb-1.5 block">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="lux-input" />
            </div>
            <div>
              <label className="lux-field-label mb-1.5 block">Payment Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className="lux-input">
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="lux-field-label mb-1.5 block">Description (optional)</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Web development — March" className="lux-input" />
            </div>
          </div>
          <div className="mt-6 flex items-center justify-end gap-3">
            <button onClick={onClose} className="lux-button-secondary px-4 py-2 text-sm font-semibold">Cancel</button>
            <button onClick={handleSave} disabled={!amount || parseFloat(amount) <= 0} className="lux-button-primary px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">Record Payment</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

// ─── Generate 1099-NEC Modal ────────────────────────────────────────────────

function Generate1099Modal({ open, contractor, onClose, onGenerate }: {
  open: boolean;
  contractor: Contractor | null;
  onClose: () => void;
  onGenerate: (contractorId: string, data: { taxYear: string; payerName: string; payerEIN?: string; payerAddress?: string }) => void;
}) {
  const [taxYear, setTaxYear] = useState(new Date().getFullYear().toString());
  const [payerName, setPayerName] = useState('');
  const [payerEIN, setPayerEIN] = useState('');
  const [payerAddress, setPayerAddress] = useState('');

  if (!open || !contractor) return null;

  const handleGenerate = () => {
    if (!payerName.trim()) return;
    onGenerate(contractor.id, {
      taxYear,
      payerName: payerName.trim(),
      payerEIN: payerEIN.trim() || undefined,
      payerAddress: payerAddress.trim() || undefined,
    });
    onClose();
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
        <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
        <div className="lux-panel relative z-10 w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto p-6 sm:-translate-y-4 sm:p-7">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Generate 1099-NEC</h2>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
            For {contractor.name} — YTD: {fmt(contractor.ytdPayments)}
          </p>
          <div className="mt-5 space-y-4">
            <div>
              <label className="lux-field-label mb-1.5 block">Tax Year</label>
              <select value={taxYear} onChange={(e) => setTaxYear(e.target.value)} className="lux-input">
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
              </select>
            </div>
            <div>
              <label className="lux-field-label mb-1.5 block">Your Business Name (Payer)</label>
              <input type="text" value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="Your Business LLC" className="lux-input" />
            </div>
            <div>
              <label className="lux-field-label mb-1.5 block">Your EIN (optional)</label>
              <input type="text" value={payerEIN} onChange={(e) => setPayerEIN(e.target.value)} placeholder="XX-XXXXXXX" className="lux-input" />
            </div>
            <div>
              <label className="lux-field-label mb-1.5 block">Your Address (optional)</label>
              <input type="text" value={payerAddress} onChange={(e) => setPayerAddress(e.target.value)} placeholder="123 Main St, City, ST 12345" className="lux-input" />
            </div>
          </div>
          <div className="mt-6 flex items-center justify-end gap-3">
            <button onClick={onClose} className="lux-button-secondary px-4 py-2 text-sm font-semibold">Cancel</button>
            <button onClick={handleGenerate} disabled={!payerName.trim()} className="lux-button-primary px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">Generate 1099-NEC</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

// ─── Pay via Stripe Modal ───────────────────────────────────────────────────

function PayViaStripeModal({ open, contractor, onClose, onPay }: {
  open: boolean;
  contractor: Contractor | null;
  onClose: () => void;
  onPay: (contractorId: string, data: { amount: number; description?: string }) => void;
}) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  if (!open || !contractor) return null;

  const handlePay = () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) return;
    onPay(contractor.id, { amount: num, description: description.trim() || undefined });
    setAmount(''); setDescription('');
    onClose();
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
        <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
        <div className="lux-panel relative z-10 w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto p-6 sm:-translate-y-4 sm:p-7">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Pay via Stripe</h2>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
            Send payment to {contractor.name} via Stripe transfer
          </p>
          <div className="mt-5 space-y-4">
            <div>
              <label className="lux-field-label mb-1.5 block">Amount ($)</label>
              <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="lux-input" />
            </div>
            <div>
              <label className="lux-field-label mb-1.5 block">Description (optional)</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Web development — March" className="lux-input" />
            </div>
          </div>
          <div className="mt-6 flex items-center justify-end gap-3">
            <button onClick={onClose} className="lux-button-secondary px-4 py-2 text-sm font-semibold">Cancel</button>
            <button onClick={handlePay} disabled={!amount || parseFloat(amount) <= 0} className="lux-button-primary px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">
              Send Payment
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type Tab = 'contractors' | '1099s';

export default function ContractorsPage() {
  const { user } = useAuth();
  const userId = user?.userId ?? 'dev-user-local';
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>('contractors');
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewContractor, setShowNewContractor] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState<Contractor | null>(null);
  const [showGenerate1099, setShowGenerate1099] = useState<Contractor | null>(null);
  const [expandedContractor, setExpandedContractor] = useState<string | null>(null);
  const [contractorPayments, setContractorPayments] = useState<Record<string, ContractorPayment[]>>({});
  const [filings1099, setFilings1099] = useState<Filing1099[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showPayViaStripe, setShowPayViaStripe] = useState<Contractor | null>(null);
  const [connectStatuses, setConnectStatuses] = useState<Record<string, { hasAccount: boolean; onboardingComplete: boolean; payoutsEnabled: boolean }>>({});
  const [paymentBanner, setPaymentBanner] = useState<string | null>(null);

  // Handle Stripe Checkout return
  useEffect(() => {
    const payment = searchParams.get('payment');
    if (payment === 'success') {
      const name = searchParams.get('contractor') ?? 'contractor';
      const amount = searchParams.get('amount');
      setPaymentBanner(`Payment of ${amount ? fmt(Number(amount)) : ''} sent to ${name} via Stripe.`);
      // Clean up URL params
      window.history.replaceState({}, '', '/contractors');
      // Auto-dismiss after 8 seconds
      setTimeout(() => setPaymentBanner(null), 8000);
    } else if (payment === 'cancelled') {
      setPaymentBanner('Payment was cancelled.');
      window.history.replaceState({}, '', '/contractors');
      setTimeout(() => setPaymentBanner(null), 5000);
    }
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [con, filings] = await Promise.all([getContractors(userId), get1099Filings(userId)]);
      setContractors(con);
      setFilings1099(filings);
    } catch (err) { console.error('Failed to load contractors:', err); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Fetch Stripe Connect status for contractors that have a Stripe account
  useEffect(() => {
    contractors.forEach(async (c) => {
      if (c.stripeAccountId && !connectStatuses[c.id]) {
        try {
          const status = await getContractorConnectStatus(userId, c.id);
          setConnectStatuses((prev) => ({ ...prev, [c.id]: status }));
        } catch { /* ignore */ }
      }
    });
  }, [contractors, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──

  const handleCreateContractor = async (data: Partial<Contractor>, nextAction: 'invite' | 'record' | 'skip') => {
    try {
      const created = await createContractor(userId, data);
      await load();
      if (nextAction === 'invite') {
        handleInviteContractor(created);
      } else if (nextAction === 'record') {
        setShowRecordPayment(created);
      }
    } catch (err) { console.error(err); }
  };
  const handleDeleteContractor = async (id: string) => {
    if (!confirm('Remove this contractor?')) return;
    await deleteContractor(userId, id); await load();
  };
  const handleRecordPayment = async (contractorId: string, data: { amount: number; date: string; method: string; description?: string }) => {
    try {
      await recordContractorPayment(userId, contractorId, data);
      await load();
      const payments = await getContractorPayments(userId, contractorId);
      setContractorPayments((prev) => ({ ...prev, [contractorId]: payments }));
    } catch (err: any) { alert(err.message ?? 'Failed to record payment'); }
  };
  const handleTogglePayments = async (contractorId: string) => {
    if (expandedContractor === contractorId) {
      setExpandedContractor(null);
      return;
    }
    setExpandedContractor(contractorId);
    if (!contractorPayments[contractorId]) {
      const payments = await getContractorPayments(userId, contractorId);
      setContractorPayments((prev) => ({ ...prev, [contractorId]: payments }));
    }
  };
  const handleDeletePayment = async (contractorId: string, paymentId: string) => {
    if (!confirm('Delete this payment record?')) return;
    await deleteContractorPayment(userId, contractorId, paymentId);
    const payments = await getContractorPayments(userId, contractorId);
    setContractorPayments((prev) => ({ ...prev, [contractorId]: payments }));
    await load();
  };
  const handleGenerate1099 = async (contractorId: string, data: { taxYear: string; payerName: string; payerEIN?: string; payerAddress?: string }) => {
    setActionLoading(contractorId);
    try {
      const r = await generate1099NEC(userId, contractorId, data);
      alert(`1099-NEC generated for ${fmt(r.totalNEC)} in nonemployee compensation. You can now send it to the contractor and file with the IRS.`);
      await load();
    } catch (err: any) { alert(err.message ?? 'Failed to generate 1099-NEC'); } finally { setActionLoading(null); }
  };
  const handleSend1099ToContractor = async (filingId: string) => {
    setActionLoading(filingId);
    try {
      const r = await send1099ToContractor(userId, filingId);
      alert(r.message);
      await load();
    } catch (err: any) { alert(err.message ?? 'Failed'); } finally { setActionLoading(null); }
  };
  const handleFile1099WithIRS = async (filingId: string) => {
    setActionLoading(filingId);
    try {
      const r = await file1099WithIRS(userId, filingId);
      alert(r.message);
      await load();
    } catch (err: any) { alert(err.message ?? 'Failed'); } finally { setActionLoading(null); }
  };

  const handleInviteContractor = async (contractor: Contractor) => {
    setActionLoading(contractor.id);
    try {
      // Create Connect account if needed, then get onboarding link
      if (!contractor.stripeAccountId) {
        await createContractorConnectAccount(userId, contractor.id);
      }
      const { url } = await getContractorOnboardingLink(userId, contractor.id);
      // Copy link to clipboard for sharing with the contractor
      await navigator.clipboard.writeText(url);
      alert(`Onboarding link copied to clipboard!\n\nSend this link to ${contractor.name} so they can connect their bank account and receive payments.\n\nIn test mode, use these test values:\n- SSN: 000-00-0000\n- Bank: routing 110000000, account 000123456789`);
      // Refresh contractor data
      await load();
      const status = await getContractorConnectStatus(userId, contractor.id);
      setConnectStatuses((prev) => ({ ...prev, [contractor.id]: status }));
    } catch (err: any) { alert(err.message ?? 'Failed to create invite'); } finally { setActionLoading(null); }
  };

  const handleRefreshConnectStatus = async (contractorId: string) => {
    try {
      const status = await getContractorConnectStatus(userId, contractorId);
      setConnectStatuses((prev) => ({ ...prev, [contractorId]: status }));
    } catch { /* ignore */ }
  };

  const handlePayViaStripe = async (contractorId: string, data: { amount: number; description?: string }) => {
    setActionLoading(contractorId);
    try {
      const result = await payContractorViaStripe(userId, contractorId, data);
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    } catch (err: any) { alert(err.message ?? 'Failed to send payment'); } finally { setActionLoading(null); }
  };

  // ── Computed ──

  const totalPaid = contractors.reduce((s, c) => s + c.ytdPayments, 0);
  const needs1099Count = contractors.filter((c) => c.needs1099).length;

  return (
    <div className="lux-shell flex min-h-screen flex-col">
      <Header />

      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">

        {/* ── Payment Banner ── */}
        {paymentBanner && (
          <div className="mb-4 flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-success-border)] bg-[var(--color-success-soft)] px-4 py-3">
            <div className="h-2 w-2 rounded-full bg-[var(--color-success)]" />
            <span className="text-sm font-medium text-[var(--color-success-text)]">{paymentBanner}</span>
            <button onClick={() => setPaymentBanner(null)} className="ml-auto text-[var(--color-success-text)]/60 hover:text-[var(--color-success-text)]">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        {/* ── Title + CTA ── */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
            Contractors
          </h1>
          {tab === 'contractors' && <button onClick={() => setShowNewContractor(true)} className="lux-button-primary px-5 py-2 text-xs font-semibold">Add Contractor</button>}
          {tab === '1099s' && <span className="text-xs text-[var(--color-text-tertiary)]">{filings1099.length} filing{filings1099.length !== 1 ? 's' : ''}</span>}
        </div>

        {/* ── Summary cards ── */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { label: 'Contractors', value: contractors.length, isCurrency: false, cls: 'text-[var(--color-text-primary)]' },
            { label: 'YTD Paid', value: totalPaid, isCurrency: true, cls: 'text-[var(--color-text-primary)]' },
            { label: 'Need 1099', value: needs1099Count, isCurrency: false, cls: needs1099Count > 0 ? 'text-[var(--color-warning-text)]' : 'text-[var(--color-text-primary)]' },
          ].map((c) => (
            <div key={c.label} className="lux-panel-soft px-4 py-3">
              <p className="lux-label">{c.label}</p>
              <p className={`mt-1 text-xl font-semibold tabular-nums ${c.cls}`}>{c.isCurrency ? fmt(c.value) : c.value}</p>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="mt-6 flex items-center gap-1">
          {(['contractors', '1099s'] as Tab[]).map((t) => {
            const label = t === 'contractors' ? 'Contractors' : '1099-NEC';
            const count = t === 'contractors' ? contractors.length : filings1099.length;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] transition-colors ${
                  tab === t
                    ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)] border border-[var(--color-border-strong)]'
                    : 'border border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                }`}
              >
                {label}
                {count > 0 && <span className="ml-1.5 font-normal opacity-60">{count}</span>}
                {t === 'contractors' && needs1099Count > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-warning-soft)] px-1 text-[9px] font-bold text-[var(--color-warning-text)]">
                    {needs1099Count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Contractors List ── */}
        {tab === 'contractors' && (
          <section className="mt-4">
            {loading ? (
              <p className="py-16 text-center text-sm text-[var(--color-text-tertiary)]">Loading...</p>
            ) : contractors.length === 0 ? (
              <div className="lux-panel-soft mt-2 py-16 text-center">
                <p className="lux-subtle text-sm">No contractors yet</p>
                <p className="lux-subtle mt-1 text-xs">Track who you pay — contractors receiving $600+ need a 1099-NEC</p>
                <button onClick={() => setShowNewContractor(true)} className="lux-button-ghost mt-2 text-xs font-medium text-[var(--color-brand-strong)]">
                  Add your first contractor
                </button>
              </div>
            ) : (
              <div className="mt-2 space-y-3">
                {contractors.map((c) => {
                  const isExpanded = expandedContractor === c.id;
                  const payments = contractorPayments[c.id] ?? [];
                  return (
                    <div key={c.id} className="lux-card-outline overflow-hidden">
                      <div className="flex items-center gap-4 px-5 py-3.5">
                        <button onClick={() => handleTogglePayments(c.id)} className="shrink-0 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]" title="View payments">
                          <svg className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">
                            {c.name}
                            {c.businessName && <span className="ml-1.5 font-normal text-[var(--color-text-tertiary)]">{c.businessName}</span>}
                          </p>
                          {c.email && <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">{c.email}</p>}
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">{fmt(c.ytdPayments)}</p>
                          <p className="lux-label mt-0.5">YTD Paid</p>
                        </div>

                        {c.needs1099 && (
                          <span className="lux-chip lux-warning">1099</span>
                        )}

                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setShowRecordPayment(c)} className="lux-button-primary px-3 py-1.5 text-[10px] font-semibold">
                            Record Payment
                          </button>

                          {/* Stripe Connect: show different buttons based on onboarding status */}
                          {(() => {
                            const cs = connectStatuses[c.id];
                            if (cs?.onboardingComplete && cs?.payoutsEnabled) {
                              // Contractor is fully onboarded — show Pay via Stripe
                              return (
                                <button
                                  onClick={() => setShowPayViaStripe(c)}
                                  disabled={actionLoading === c.id}
                                  className="lux-button-primary px-3 py-1.5 text-[10px] font-semibold bg-[#635bff] hover:bg-[#5147e6]"
                                >
                                  Pay via Stripe
                                </button>
                              );
                            }
                            if (cs?.hasAccount && !cs?.onboardingComplete) {
                              // Account created but onboarding not finished
                              return (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleInviteContractor(c)}
                                    disabled={actionLoading === c.id}
                                    className="lux-button-secondary px-3 py-1.5 text-[10px] font-semibold text-amber-600 border-amber-400"
                                  >
                                    {actionLoading === c.id ? '...' : 'Resend Invite'}
                                  </button>
                                  <button
                                    onClick={() => handleRefreshConnectStatus(c.id)}
                                    className="lux-button-ghost p-1"
                                    title="Refresh status"
                                  >
                                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="23 4 23 10 17 10" />
                                      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                                    </svg>
                                  </button>
                                </div>
                              );
                            }
                            // No account yet — show invite button
                            return (
                              <button
                                onClick={() => handleInviteContractor(c)}
                                disabled={actionLoading === c.id}
                                className="lux-button-secondary px-3 py-1.5 text-[10px] font-semibold"
                              >
                                {actionLoading === c.id ? 'Setting up...' : 'Invite to get paid'}
                              </button>
                            );
                          })()}

                          {c.needs1099 && (
                            <button onClick={() => setShowGenerate1099(c)} disabled={actionLoading === c.id} className="lux-button-secondary px-3 py-1.5 text-[10px] font-semibold border-[var(--color-warning-text)] text-[var(--color-warning-text)]">
                              1099-NEC
                            </button>
                          )}
                          <button onClick={() => handleDeleteContractor(c.id)} className="lux-button-ghost p-1" title="Remove">
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>

                      {/* Payment History (expanded) */}
                      {isExpanded && (
                        <div className="border-t border-[var(--color-soft-border)] bg-[var(--color-surface-soft)] px-5 py-3">
                          {payments.length === 0 ? (
                            <p className="text-xs text-[var(--color-text-tertiary)]">No payments recorded yet</p>
                          ) : (
                            <div className="space-y-2">
                              <p className="lux-label">Payment History</p>
                              {[...payments].sort((a, b) => b.date.localeCompare(a.date)).map((p) => (
                                <div key={p.id} className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium text-[var(--color-text-primary)]">
                                      {fmt(p.amount)}
                                      <span className="ml-2 font-normal text-[var(--color-text-tertiary)]">
                                        {PAYMENT_METHODS.find((m) => m.value === p.method)?.label ?? p.method}
                                      </span>
                                    </p>
                                    <p className="mt-0.5 text-[10px] text-[var(--color-text-tertiary)]">
                                      {new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      {p.description && ` — ${p.description}`}
                                    </p>
                                  </div>
                                  <button onClick={() => handleDeletePayment(c.id, p.id)} className="lux-button-ghost p-1" title="Delete payment">
                                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ── 1099-NEC Tab ── */}
        {tab === '1099s' && (
          <section className="mt-4">
            {filings1099.length === 0 ? (
              <div className="lux-panel-soft mt-2 py-16 text-center">
                <p className="lux-subtle text-sm">No 1099-NEC filings yet</p>
                <p className="lux-subtle mt-1 text-xs">
                  When a contractor receives $600+ in a year, generate their 1099-NEC from the Contractors tab.
                </p>
              </div>
            ) : (
              <div className="mt-2 space-y-3">
                {[...filings1099].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)).map((f) => (
                  <div key={f.id} className="lux-card-outline px-5 py-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-warning-soft)]">
                        <svg className="h-5 w-5 text-[var(--color-warning-text)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                          <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                          1099-NEC — {f.contractorName}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                          Tax Year {f.taxYear} &middot; {fmt(f.totalNEC)} &middot; Generated {new Date(f.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {f.sentToContractor ? (
                          <span className="lux-chip lux-success text-[9px]">Sent to Contractor</span>
                        ) : (
                          <button
                            onClick={() => handleSend1099ToContractor(f.id)}
                            disabled={actionLoading === f.id}
                            className="lux-button-secondary px-3 py-1 text-[10px] font-semibold disabled:opacity-50"
                          >
                            {actionLoading === f.id ? '...' : 'Send to Contractor'}
                          </button>
                        )}
                        {f.filedWithIRS ? (
                          <span className="lux-chip lux-success text-[9px]">Filed with IRS</span>
                        ) : (
                          <button
                            onClick={() => handleFile1099WithIRS(f.id)}
                            disabled={actionLoading === f.id}
                            className="lux-button-primary px-3 py-1 text-[10px] font-semibold disabled:opacity-50"
                          >
                            {actionLoading === f.id ? '...' : 'File with IRS'}
                          </button>
                        )}
                      </div>
                    </div>

                    {(f.sentToContractorAt || f.irsConfirmationNumber) && (
                      <div className="mt-3 flex flex-wrap gap-4 border-t border-[var(--color-soft-border)] pt-3">
                        {f.sentToContractorAt && (
                          <p className="text-[10px] text-[var(--color-text-tertiary)]">
                            Sent {new Date(f.sentToContractorAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        )}
                        {f.irsConfirmationNumber && (
                          <p className="text-[10px] text-[var(--color-text-tertiary)]">
                            IRS Confirmation: <span className="font-mono font-medium text-[var(--color-text-secondary)]">{f.irsConfirmationNumber}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Modals */}
      <NewContractorModal open={showNewContractor} onClose={() => setShowNewContractor(false)} onSave={handleCreateContractor} />
      <RecordPaymentModal open={!!showRecordPayment} contractor={showRecordPayment} onClose={() => setShowRecordPayment(null)} onSave={handleRecordPayment} />
      <PayViaStripeModal open={!!showPayViaStripe} contractor={showPayViaStripe} onClose={() => setShowPayViaStripe(null)} onPay={handlePayViaStripe} />
      <Generate1099Modal open={!!showGenerate1099} contractor={showGenerate1099} onClose={() => setShowGenerate1099(null)} onGenerate={handleGenerate1099} />
    </div>
  );
}
