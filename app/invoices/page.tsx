'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/layout/Header';
import StripeConnectBanner from '@/components/invoices/StripeConnectBanner';
import ModalPortal from '@/components/ui/ModalPortal';
import OverflowMenu from '@/components/ui/OverflowMenu';
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

type InvoiceListFilter = 'all' | 'pending' | 'paid' | 'draft';

const FILTER_LABELS: Record<InvoiceListFilter, string> = {
  all: 'All',
  pending: 'Awaiting Payment',
  paid: 'Paid',
  draft: 'Draft',
};

function getInvoiceYear(invoice: Invoice): string {
  return (invoice.issueDate || invoice.createdAt).slice(0, 4);
}

// ─── Status Badge ────────────────────────────────────────────────────────────

const STATUS_CLS: Record<InvoiceStatus, string> = {
  draft: 'text-[var(--color-text-tertiary)]',
  sent: 'text-[var(--color-brand-strong)]',
  paid: 'text-[var(--color-success-text)]',
  overdue: 'text-[var(--color-warning-text)]',
  cancelled: 'text-[var(--color-text-tertiary)] line-through',
};

const STATUS_DOT_CLS: Record<InvoiceStatus, string> = {
  draft: 'bg-[var(--color-text-tertiary)]/50',
  sent: 'bg-[var(--color-brand-strong)]',
  paid: 'bg-[var(--color-success-text)]',
  overdue: 'bg-[var(--color-warning-text)]',
  cancelled: 'bg-[var(--color-text-tertiary)]/45',
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
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium ${STATUS_CLS[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLS[status]}`} />
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
      <div className="lux-modal-shell">
        <div className="lux-modal-backdrop" onClick={onClose} />

        <div className="lux-modal-card lux-modal-card-xl">
          <div className="lux-modal-header">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">New Invoice</h2>
              <p className="lux-modal-subtitle">
                Create a clean invoice with client details, due date, and line items.
              </p>
            </div>
          </div>

          <div className="lux-modal-body">
            <div className="lux-form-grid-2">
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

          <div className="lux-modal-actions">
            <button onClick={onClose} className="lux-button-secondary px-4 py-2 text-sm font-semibold">Cancel</button>
            <button onClick={handleSave} disabled={!clientName.trim() || subtotal <= 0} className="lux-button-primary px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">Create Invoice</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

function InvoiceSummarySkeleton() {
  return (
    <div className="lux-summary-grid mt-6">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="lux-summary-card">
          <div className="h-3 w-20 lux-skeleton" />
          <div className="mt-4 h-8 w-24 lux-skeleton" />
        </div>
      ))}
    </div>
  );
}

function InvoiceListSkeleton() {
  return (
    <div className="lux-card-outline mt-2 overflow-hidden">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className={`flex items-center gap-4 px-5 py-4 ${index > 0 ? 'border-t border-[var(--color-soft-border)]' : ''}`}
        >
          <div className="min-w-0 flex-1">
            <div className="h-4 w-36 max-w-full lux-skeleton" />
            <div className="mt-2 h-3 w-44 max-w-full lux-skeleton" />
          </div>
          <div className="h-5 w-20 lux-skeleton" />
          <div className="h-8 w-8 lux-skeleton rounded-full" />
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const { user } = useAuth();
  const userId = user?.userId ?? 'dev-user-local';
  const currentYear = new Date().getFullYear().toString();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stripeStatus, setStripeStatus] = useState<StripeConnectStatus | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<InvoiceListFilter>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');

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

  const yearOptions = useMemo(() => {
    const years = new Set<string>([currentYear]);
    invoices.forEach((invoice) => years.add(getInvoiceYear(invoice)));
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [currentYear, invoices]);

  const filteredInvoices = useMemo(() => {
    const matchesStatus = (invoice: Invoice) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'pending') return invoice.status === 'sent' || invoice.status === 'overdue';
      return invoice.status === statusFilter;
    };

    return invoices
      .filter((invoice) => yearFilter === 'all' || getInvoiceYear(invoice) === yearFilter)
      .filter(matchesStatus)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [invoices, statusFilter, yearFilter]);

  const totalInvoiced = filteredInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const totalReceived = filteredInvoices
    .filter((invoice) => invoice.status === 'paid')
    .reduce((sum, invoice) => sum + invoice.total, 0);
  const totalOutstanding = filteredInvoices
    .filter((invoice) => invoice.status === 'sent' || invoice.status === 'overdue')
    .reduce((sum, invoice) => sum + invoice.total, 0);

  return (
    <div className="lux-shell flex min-h-screen flex-col">
      <Header />

      <div className="lux-page">
        <h1 className="sr-only">Invoices</h1>

        {/* ── Stripe banner ── */}
        {!loading && (!stripeStatus?.connected || !stripeStatus?.detailsSubmitted) && (
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

        <section className="lux-toolbar">
          <div className="lux-toolbar-row">
            <div className="lux-segmented-control">
              {(['all', 'pending', 'paid', 'draft'] as InvoiceListFilter[]).map((filter) => {
                const isActive = statusFilter === filter;
                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setStatusFilter(filter)}
                    className={`lux-segmented-pill ${isActive ? 'is-active' : ''}`}
                  >
                    {FILTER_LABELS[filter]}
                  </button>
                );
              })}
            </div>

            <div className="lux-inline-group">
              <select
                id="invoice-year-filter"
                aria-label="Filter invoices by year"
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="lux-select-compact"
              >
                <option value="all">All years</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>

              <button onClick={() => setShowNewInvoice(true)} className="lux-button-primary px-5 py-2 text-xs font-semibold">New Invoice</button>
            </div>
          </div>
        </section>

        {loading && <InvoiceSummarySkeleton />}

        {!loading && invoices.length > 0 && (
          <div className="lux-summary-grid mt-6">
            {[
              { label: 'Invoiced', value: totalInvoiced, cls: 'text-[var(--color-text-primary)]' },
              { label: 'Received', value: totalReceived, cls: 'text-[var(--color-success-text)]' },
              { label: 'Outstanding', value: totalOutstanding, cls: 'text-[var(--color-warning-text)]' },
            ].map((c) => (
              <div key={c.label} className="lux-summary-card">
                <p className="lux-label">{c.label}</p>
                <p className={`mt-1 text-xl font-semibold tabular-nums ${c.cls}`}>{fmt(c.value)}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Invoice List ── */}
        <section className="mt-6">
          {loading ? (
            <InvoiceListSkeleton />
          ) : invoices.length === 0 ? (
            <div className="lux-empty-state mt-2 text-center">
              <p className="lux-subtle text-sm">No invoices yet</p>
              <button onClick={() => setShowNewInvoice(true)} className="lux-button-ghost mt-2 text-xs font-medium text-[var(--color-brand-strong)]">
                Create your first invoice
              </button>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="lux-empty-state mt-2 text-center">
              <p className="lux-subtle text-sm">No invoices match these filters</p>
            </div>
          ) : (
            <div className="lux-card-outline mt-2 divide-y divide-[var(--color-soft-border)] overflow-hidden">
              {filteredInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--color-surface-soft)]">
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-base font-semibold text-[var(--color-text-primary)]">{inv.clientName}</span>
                      <StatusBadge status={inv.status} />
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
                      {inv.invoiceNumber} · Due {new Date(inv.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {inv.paidDate && ` · Paid ${new Date(inv.paidDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                    </p>
                  </div>

                  {/* Amount */}
                  <span className="text-base font-semibold tabular-nums text-[var(--color-text-primary)]">{fmt(inv.total)}</span>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {(inv.status === 'draft') && (
                      <button onClick={() => handleSendInvoice(inv)} disabled={actionLoading === inv.id} className="lux-button-secondary px-3 py-1.5 text-[10px] font-semibold disabled:opacity-50">
                        {actionLoading === inv.id ? 'Sending...' : 'Send'}
                      </button>
                    )}
                    {(inv.status === 'sent' || inv.status === 'overdue') && (
                      <button onClick={() => handleMarkPaid(inv)} disabled={actionLoading === inv.id} className="lux-button-primary px-3 py-1.5 text-[10px] font-semibold disabled:opacity-50">
                        {actionLoading === inv.id ? '...' : 'Mark Paid'}
                      </button>
                    )}
                    {(Boolean(inv.paymentLinkUrl) || inv.status === 'draft' || inv.status === 'cancelled') && (
                      <OverflowMenu>
                        {({ close }) => (
                          <>
                            {inv.paymentLinkUrl && (
                              <button
                                type="button"
                                className="lux-menu-item"
                                onClick={() => {
                                  navigator.clipboard.writeText(inv.paymentLinkUrl!);
                                  close();
                                }}
                              >
                                Copy payment link
                              </button>
                            )}
                            {(inv.status === 'draft' || inv.status === 'cancelled') && (
                              <button
                                type="button"
                                className="lux-menu-item lux-menu-item-danger"
                                onClick={() => {
                                  close();
                                  handleDeleteInvoice(inv.id);
                                }}
                              >
                                Delete invoice
                              </button>
                            )}
                          </>
                        )}
                      </OverflowMenu>
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
