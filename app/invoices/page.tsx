'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/layout/Header';
import StripeConnectBanner from '@/components/invoices/StripeConnectBanner';
import ModalPortal from '@/components/ui/ModalPortal';
import { useAuth } from '@/context/AuthContext';
import type { Invoice, InvoiceLineItem, InvoiceStatus, StripeConnectStatus } from '@/lib/types';
import {
  getInvoices,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  createPaymentLink,
  syncInvoicePaymentStatus,
  getStripeStatus,
  createStripeAccount,
  getStripeOnboardingLink,
  getStripeDashboardLink,
  disconnectStripe,
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

function NewInvoiceModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (data: Partial<Invoice>) => void }) {
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
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

  const handleSave = () => {
    if (!clientName.trim() || subtotal <= 0) return;
    onSave({
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim(),
      items: items.map((i) => ({ ...i, amount: i.quantity * i.unitPrice })),
      dueDate,
      notes: notes.trim() || undefined,
    });
    setClientName(''); setClientEmail('');
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
                  <div key={idx} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-soft)]/70 p-3">
                    <div className="flex items-end gap-3">
                      <div className="min-w-0 flex-1">
                        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Description</label>
                        <input type="text" value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} placeholder="e.g. Tax preparation" className="lux-input" />
                      </div>
                      {items.length > 1 && (
                        <button onClick={() => removeItem(idx)} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-background-alt)]/70 text-[var(--color-text-tertiary)] transition-colors hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]" title="Remove line item">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-[120px_160px_minmax(0,1fr)]">
                      <div>
                        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Qty</label>
                        <input type="number" min="1" value={item.quantity || ''} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} placeholder="1" className="lux-input text-center" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Rate</label>
                        <input type="number" min="0" step="0.01" value={item.unitPrice || ''} onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)} placeholder="0.00" className="lux-input text-right" />
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Amount</label>
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

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const { user } = useAuth();
  const userId = user?.userId ?? 'dev-user-local';

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stripeStatus, setStripeStatus] = useState<StripeConnectStatus | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, stripe] = await Promise.all([getInvoices(userId), getStripeStatus(userId)]);
      let nextInvoices = inv;
      const sentInvoices = inv.filter((invoice) =>
        invoice.status === 'sent' && (invoice.stripeInvoiceId || invoice.stripeCheckoutSessionId || invoice.stripePaymentIntentId)
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
      setStripeStatus(stripe);
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
    setStripeLoading(true);
    setStripeError(null);
    try {
      let status = await getStripeStatus(userId);
      if (!status.accountId) {
        await createStripeAccount(userId, {});
        status = await getStripeStatus(userId);
      }
      const { url } = await getStripeOnboardingLink(userId);
      window.open(url, '_blank');
      setTimeout(async () => { setStripeStatus(await getStripeStatus(userId)); }, 3000);
    } catch (err: any) { setStripeError(err.message ?? 'Failed'); }
    finally { setStripeLoading(false); }
  };
  const handleStripeDashboard = async () => {
    try { const { url } = await getStripeDashboardLink(userId); window.open(url, '_blank'); }
    catch { window.open('https://dashboard.stripe.com', '_blank'); }
  };
  const handleDisconnectStripe = async () => {
    if (!confirm('Disconnect Stripe? You will not be able to send invoices.')) return;
    const status = await disconnectStripe(userId);
    setStripeStatus(status);
  };
  const handleRefreshStripe = async () => {
    setStripeStatus(await getStripeStatus(userId));
  };
  const handleCreateInvoice = async (data: Partial<Invoice>) => {
    try { await createInvoice(userId, data); await load(); } catch (err) { console.error(err); }
  };
  const handleMarkPaid = async (inv: Invoice) => {
    setActionLoading(inv.id);
    try { await updateInvoice(userId, inv.id, { status: 'paid' }); await load(); } finally { setActionLoading(null); }
  };
  const handleSendInvoice = async (inv: Invoice) => {
    if (!inv.clientEmail) {
      alert('Client email is required to send an invoice. Edit the invoice and add an email address.');
      return;
    }
    setActionLoading(inv.id);
    try {
      const r = await createPaymentLink(userId, inv.id);
      if (r.paymentUrl) {
        await navigator.clipboard.writeText(r.paymentUrl);
      }
      alert(`Invoice sent to ${inv.clientEmail}. Payment link copied to clipboard.\n\nNote: Stripe test mode does not deliver emails — use the copied link to test payment.`);
      await load();
    } catch (err: any) { alert(err.message ?? 'Failed to send invoice'); } finally { setActionLoading(null); }
  };
  const handleDeleteInvoice = async (id: string) => {
    if (!confirm('Delete this invoice?')) return;
    await deleteInvoice(userId, id); await load();
  };

  // ── Computed ──

  const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0);
  const totalReceived = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0);
  const totalOutstanding = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.total, 0);
  const sorted = [...invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="lux-shell flex min-h-screen flex-col">
      <Header />

      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">

        {/* ── Stripe banner ── */}
        {(!stripeStatus?.connected || !stripeStatus?.detailsSubmitted) && (
          <div className="mb-6">
            <StripeConnectBanner
              status={stripeStatus}
              onConnect={handleConnectStripe}
              onDisconnect={handleDisconnectStripe}
              onDashboard={handleStripeDashboard}
              onRefresh={handleRefreshStripe}
              loading={stripeLoading}
              error={stripeError}
            />
          </div>
        )}

        {/* ── Title + CTA ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
              Invoices
            </h1>
            {stripeStatus?.connected && stripeStatus?.detailsSubmitted && (
              <span className="lux-chip lux-success">
                <span className="lux-dot" />
                Connected
              </span>
            )}
          </div>
          <button onClick={() => setShowNewInvoice(true)} className="lux-button-primary px-5 py-2 text-xs font-semibold">New Invoice</button>
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

        {/* ── Invoice List ── */}
        <section className="mt-6">
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
                      <button onClick={() => handleSendInvoice(inv)} disabled={actionLoading === inv.id} className="lux-button-secondary px-3 py-1 text-[10px] font-semibold disabled:opacity-50">
                        {actionLoading === inv.id ? 'Sending...' : 'Send Invoice'}
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

        {stripeStatus?.connected && stripeStatus?.detailsSubmitted && (
          <div className="mt-4 text-right">
            <button onClick={handleDisconnectStripe} className="lux-button-ghost text-[10px]" title="Disconnect Stripe">
              Disconnect Stripe
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      <NewInvoiceModal open={showNewInvoice} onClose={() => setShowNewInvoice(false)} onSave={handleCreateInvoice} />
    </div>
  );
}
