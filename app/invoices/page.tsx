'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/layout/Header';
import StripeConnectBanner from '@/components/invoices/StripeConnectBanner';
import ModalPortal from '@/components/ui/ModalPortal';
import { useAuth } from '@/context/AuthContext';
import type { Invoice, InvoiceLineItem, Contractor, InvoiceStatus } from '@/lib/types';
import {
  getInvoices,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  createPaymentLink,
  syncInvoicePaymentStatus,
  getContractors,
  createContractor,
  deleteContractor,
  getStripeStatus,
  toggleStripeConnect,
} from '@/lib/files-api';

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// ─── Status Badge ────────────────────────────────────────────────────────────

const STATUS_CLS: Record<InvoiceStatus, string> = {
  draft: 'border border-[var(--color-border)] bg-[var(--color-surface-soft)] text-[var(--color-text-tertiary)]',
  sent: 'border border-[var(--color-border-strong)] bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]',
  paid: 'lux-success',
  overdue: 'lux-warning',
  cancelled: 'border border-[var(--color-border)] bg-[var(--color-surface-soft)] text-[var(--color-text-tertiary)] line-through',
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Awaiting Payment',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};

function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span className={`lux-chip ${STATUS_CLS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── New Invoice Modal ───────────────────────────────────────────────────────

interface NewInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Invoice>) => void;
  contractors: Contractor[];
}

function NewInvoiceModal({ open, onClose, onSave, contractors }: NewInvoiceModalProps) {
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [contractorId, setContractorId] = useState('');
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  );
  const [items, setItems] = useState<InvoiceLineItem[]>([
    { description: '', quantity: 1, unitPrice: 0, amount: 0 },
  ]);
  const [notes, setNotes] = useState('');

  if (!open) return null;

  const addItem = () => setItems([...items, { description: '', quantity: 1, unitPrice: 0, amount: 0 }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof InvoiceLineItem, value: string) => {
    const updated = [...items];
    if (field === 'description') {
      updated[idx] = { ...updated[idx], description: value };
    } else {
      const num = parseFloat(value) || 0;
      updated[idx] = {
        ...updated[idx],
        [field]: num,
        amount: field === 'quantity' ? num * updated[idx].unitPrice : updated[idx].quantity * num,
      };
    }
    setItems(updated);
  };

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  const handleContractorSelect = (id: string) => {
    setContractorId(id);
    const c = contractors.find((c) => c.id === id);
    if (c) { setClientName(c.businessName || c.name); setClientEmail(c.email); }
  };

  const handleSave = () => {
    if (!clientName.trim() || subtotal <= 0) return;
    onSave({
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim(),
      contractorId: contractorId || undefined,
      items: items.map((i) => ({ ...i, amount: i.quantity * i.unitPrice })),
      dueDate,
      notes: notes.trim() || undefined,
    });
    setClientName(''); setClientEmail(''); setContractorId('');
    setItems([{ description: '', quantity: 1, unitPrice: 0, amount: 0 }]);
    setNotes('');
    onClose();
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
        <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />

        <div className="lux-panel relative z-10 w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto p-6 sm:-translate-y-4 sm:p-7">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">New Invoice</h2>

          <div className="mt-5 space-y-4">
            {contractors.length > 0 && (
              <div>
                <label className="lux-field-label mb-1.5 block">Link to Contractor</label>
                <select value={contractorId} onChange={(e) => handleContractorSelect(e.target.value)} className="lux-select">
                  <option value="">— Select or enter manually —</option>
                  {contractors.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.businessName ? ` (${c.businessName})` : ''}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="lux-field-label mb-1.5 block">Client Name</label>
                <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Acme Corp" className="lux-input" />
              </div>
              <div>
                <label className="lux-field-label mb-1.5 block">Client Email</label>
                <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="client@example.com" className="lux-input" />
              </div>
            </div>

            <div>
              <label className="lux-field-label mb-1.5 block">Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="lux-input" />
            </div>

            {/* Line items */}
            <div>
              <label className="lux-field-label mb-2 block">Line Items</label>

              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-soft)]/70 p-3"
                  >
                    <div className="flex items-end gap-3">
                      <div className="min-w-0 flex-1">
                        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                          Description
                        </label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(idx, 'description', e.target.value)}
                          placeholder="e.g. Tax preparation"
                          className="lux-input"
                        />
                      </div>
                      {items.length > 1 && (
                        <button
                          onClick={() => removeItem(idx)}
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-background-alt)]/70 text-[var(--color-text-tertiary)] transition-colors hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
                          title="Remove line item"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-[120px_160px_minmax(0,1fr)]">
                      <div>
                        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                          Qty
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity || ''}
                          onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                          placeholder="1"
                          className="lux-input text-center"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                          Rate
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice || ''}
                          onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                          placeholder="0.00"
                          className="lux-input text-right"
                        />
                      </div>

                      <div className="col-span-2 sm:col-span-1">
                        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                          Amount
                        </label>
                        <div className="flex h-[52px] items-center justify-end rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background-alt)]/70 px-4 text-base font-semibold tabular-nums text-[var(--color-text-primary)]">
                          {fmt(item.quantity * item.unitPrice)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={addItem} className="lux-button-ghost mt-2 text-xs font-medium">+ Add line item</button>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
              <span className="lux-field-label">Total</span>
              <span className="text-lg font-semibold tabular-nums text-[var(--color-text-primary)]">{fmt(subtotal)}</span>
            </div>

            <div>
              <label className="lux-field-label mb-1.5 block">Notes (optional)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment terms, thank you note..." rows={2} className="lux-textarea resize-none" />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button onClick={onClose} className="lux-button-secondary px-4 py-2 text-sm font-semibold">Cancel</button>
            <button onClick={handleSave} disabled={!clientName.trim() || subtotal <= 0} className="lux-button-primary px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">Create Invoice</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

// ─── New Contractor Modal ────────────────────────────────────────────────────

function NewContractorModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (d: Partial<Contractor>) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');

  if (!open) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), email: email.trim(), businessName: businessName.trim() || undefined });
    setName(''); setEmail(''); setBusinessName('');
    onClose();
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
        <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
        <div className="lux-panel relative z-10 w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto p-6 sm:-translate-y-4 sm:p-7">
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
            <button onClick={onClose} className="lux-button-secondary px-4 py-2 text-sm font-semibold">Cancel</button>
            <button onClick={handleSave} disabled={!name.trim()} className="lux-button-primary px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">Add</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type Tab = 'invoices' | 'contractors';

export default function InvoicesPage() {
  const { user } = useAuth();
  const userId = user?.userId ?? 'dev-user-local';

  const [tab, setTab] = useState<Tab>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [showNewContractor, setShowNewContractor] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, con, stripe] = await Promise.all([getInvoices(userId), getContractors(userId), getStripeStatus(userId)]);
      let nextInvoices = inv;
      const sentInvoices = inv.filter((invoice) =>
        invoice.status === 'sent' && (invoice.stripeCheckoutSessionId || invoice.stripePaymentIntentId)
      );
      if (sentInvoices.length > 0) {
        const synced = await Promise.all(
          sentInvoices.map((invoice) =>
            syncInvoicePaymentStatus(userId, invoice.id).catch(() => null)
          ),
        );
        const syncedById = new Map(
          synced
            .filter((result): result is { invoice: Invoice; synced: boolean } => result !== null)
            .map((result) => [result.invoice.id, result.invoice]),
        );
        nextInvoices = inv.map((invoice) => syncedById.get(invoice.id) ?? invoice);
      }

      setInvoices(nextInvoices);
      setContractors(con);
      setStripeConnected(stripe.connected);
    } catch (err) { console.error('Failed to load invoices data:', err); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paidId = params.get('paid');
    if (paidId) { updateInvoice(userId, paidId, { status: 'paid' }).then(() => load()); window.history.replaceState({}, '', '/invoices'); }
  }, [userId, load]);

  // ── Handlers ──

  const handleConnectStripe = async () => {
    try { const s = await toggleStripeConnect(userId); setStripeConnected(s.connected); } catch (err) { console.error(err); }
  };
  const handleCreateInvoice = async (data: Partial<Invoice>) => {
    try { await createInvoice(userId, data); await load(); } catch (err) { console.error(err); }
  };
  const handleCreateContractor = async (data: Partial<Contractor>) => {
    try { await createContractor(userId, data); await load(); } catch (err) { console.error(err); }
  };
  const handleMarkPaid = async (inv: Invoice) => {
    setActionLoading(inv.id);
    try { await updateInvoice(userId, inv.id, { status: 'paid' }); await load(); } finally { setActionLoading(null); }
  };
  const handleSendPaymentLink = async (inv: Invoice) => {
    setActionLoading(inv.id);
    try {
      const r = await createPaymentLink(userId, inv.id);
      if (r.paymentUrl) {
        await navigator.clipboard.writeText(r.paymentUrl);
        alert(inv.clientEmail
          ? `Payment link copied. PaisaTax does not email invoices automatically yet, so send the link to ${inv.clientEmail} yourself.`
          : 'Payment link created and copied to clipboard. Share it with your client.');
      }
      await load();
    } catch (err: any) { alert(err.message ?? 'Failed'); } finally { setActionLoading(null); }
  };
  const handleDeleteInvoice = async (id: string) => {
    if (!confirm('Delete this invoice?')) return;
    await deleteInvoice(userId, id); await load();
  };
  const handleDeleteContractor = async (id: string) => {
    if (!confirm('Remove this contractor?')) return;
    await deleteContractor(userId, id); await load();
  };

  // ── Computed ──

  const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0);
  const totalReceived = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0);
  const totalOutstanding = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.total, 0);
  const sorted = [...invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const needs1099Count = contractors.filter((c) => c.needs1099).length;

  return (
    <div className="lux-shell flex min-h-screen flex-col">
      <Header />

      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">

        {/* ── Stripe banner (only when disconnected) ── */}
        {!stripeConnected && (
          <div className="mb-6">
            <StripeConnectBanner connected={false} onConnect={handleConnectStripe} />
          </div>
        )}

        {/* ── Title + CTA ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
              Invoices
            </h1>
            {stripeConnected && (
              <span className="lux-chip lux-success">
                <span className="lux-dot" />
                Connected
              </span>
            )}
          </div>
          {tab === 'invoices'
            ? <button onClick={() => setShowNewInvoice(true)} className="lux-button-primary px-5 py-2 text-xs font-semibold">New Invoice</button>
            : <button onClick={() => setShowNewContractor(true)} className="lux-button-primary px-5 py-2 text-xs font-semibold">Add Contractor</button>
          }
        </div>

        {/* ── Summary cards ── */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { label: 'Invoiced', value: totalInvoiced, cls: 'text-[var(--color-text-primary)]' },
            { label: 'Received', value: totalReceived, cls: 'text-[var(--color-success-text)]' },
            { label: 'Outstanding', value: totalOutstanding, cls: 'text-[var(--color-warning-text)]' },
          ].map((c) => (
            <div key={c.label} className="lux-panel-soft px-4 py-3">
              <p className="lux-label">{c.label}</p>
              <p className={`mt-1 text-xl font-semibold tabular-nums ${c.cls}`}>{fmt(c.value)}</p>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="mt-6 flex items-center gap-1">
          {(['invoices', 'contractors'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] transition-colors ${
                tab === t
                  ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)] border border-[var(--color-border-strong)]'
                  : 'border border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              {t === 'invoices' ? 'Invoices' : 'Contractors'}
              {t === 'invoices' && invoices.length > 0 && <span className="ml-1.5 font-normal opacity-60">{invoices.length}</span>}
              {t === 'contractors' && contractors.length > 0 && <span className="ml-1.5 font-normal opacity-60">{contractors.length}</span>}
              {t === 'contractors' && needs1099Count > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-warning-soft)] px-1 text-[9px] font-bold text-[var(--color-warning-text)]">
                  {needs1099Count}
                </span>
              )}
            </button>
          ))}

          {stripeConnected && (
            <button onClick={handleConnectStripe} className="lux-button-ghost ml-auto text-[10px]" title="Disconnect Stripe">
              Disconnect Stripe
            </button>
          )}
        </div>

        {/* ── Invoice List ── */}
        {tab === 'invoices' && (
          <section className="mt-4">
            {loading ? (
              <p className="py-16 text-center text-sm text-[var(--color-text-tertiary)]">Loading...</p>
            ) : sorted.length === 0 ? (
              <div className="lux-panel-soft mt-2 py-16 text-center">
                <p className="lux-subtle text-sm">No invoices yet</p>
                <button onClick={() => setShowNewInvoice(true)} className="lux-button-ghost mt-2 text-xs font-medium text-[var(--color-brand-strong)]">
                  Create your first invoice
                </button>
              </div>
            ) : (
              <div className="lux-card-outline mt-2 divide-y divide-[var(--color-soft-border)] overflow-hidden">
                {sorted.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--color-surface-soft)]">
                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">{inv.clientName}</span>
                        <StatusBadge status={inv.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                        {inv.invoiceNumber} · Due {new Date(inv.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {inv.paidDate && ` · Paid ${new Date(inv.paidDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                      </p>
                    </div>

                    {/* Amount */}
                    <span className="text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">{fmt(inv.total)}</span>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      {inv.status === 'draft' && (
                        <button onClick={() => handleSendPaymentLink(inv)} disabled={actionLoading === inv.id} className="lux-button-secondary px-3 py-1 text-[10px] font-semibold disabled:opacity-50">
                          {actionLoading === inv.id ? '...' : 'Copy Payment Link'}
                        </button>
                      )}
                      {inv.status === 'sent' && (
                        <>
                          {inv.paymentLinkUrl && (
                            <button onClick={() => { navigator.clipboard.writeText(inv.paymentLinkUrl!); }} className="lux-icon-button !h-7 !w-7" title="Copy payment link">
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                              </svg>
                            </button>
                          )}
                          <button onClick={() => handleMarkPaid(inv)} disabled={actionLoading === inv.id} className="lux-button-primary px-3 py-1 text-[10px] font-semibold disabled:opacity-50">
                            {actionLoading === inv.id ? '...' : 'Mark Paid Manually'}
                          </button>
                        </>
                      )}
                      {(inv.status === 'draft' || inv.status === 'cancelled') && (
                        <button onClick={() => handleDeleteInvoice(inv.id)} className="lux-button-ghost p-1" title="Delete">
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Contractors Tab ── */}
        {tab === 'contractors' && (
          <section className="mt-4">
            {contractors.length === 0 ? (
              <div className="lux-panel-soft mt-2 py-16 text-center">
                <p className="lux-subtle text-sm">No contractors yet</p>
                <p className="lux-subtle mt-1 text-xs">Track who you pay — contractors receiving $600+ need a 1099-NEC</p>
                <button onClick={() => setShowNewContractor(true)} className="lux-button-ghost mt-2 text-xs font-medium text-[var(--color-brand-strong)]">
                  Add your first contractor
                </button>
              </div>
            ) : (
              <div className="lux-card-outline mt-2 divide-y divide-[var(--color-soft-border)] overflow-hidden">
                {contractors.map((c) => (
                  <div key={c.id} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--color-surface-soft)]">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {c.name}
                        {c.businessName && <span className="ml-1.5 font-normal text-[var(--color-text-tertiary)]">{c.businessName}</span>}
                      </p>
                      {c.email && <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">{c.email}</p>}
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">{fmt(c.ytdPayments)}</p>
                      <p className="lux-label mt-0.5">YTD</p>
                    </div>

                    {c.needs1099 && (
                      <span className="lux-chip lux-warning">1099</span>
                    )}

                    <button onClick={() => handleDeleteContractor(c.id)} className="lux-button-ghost p-1" title="Remove">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Modals */}
      <NewInvoiceModal open={showNewInvoice} onClose={() => setShowNewInvoice(false)} onSave={handleCreateInvoice} contractors={contractors} />
      <NewContractorModal open={showNewContractor} onClose={() => setShowNewContractor(false)} onSave={handleCreateContractor} />
    </div>
  );
}
