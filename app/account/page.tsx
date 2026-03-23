'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import { useAgent } from '@/context/AgentContext';
import { useAuth } from '@/context/AuthContext';
import { useUserProfile } from '@/context/UserProfileContext';
import ModalPortal from '@/components/ui/ModalPortal';
import {
  buyTokens,
  confirmTokenPurchase,
  fetchAccountProfile,
  getTokenBalance,
  updateAccountProfile,
} from '@/lib/files-api';

type AccountTab = 'profile' | 'billing' | 'settings';

const TABS: { key: AccountTab; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'billing', label: 'Billing' },
  { key: 'settings', label: 'Settings' },
];

// ─── Tab Content Components ──────────────────────────────────────────────────

interface UserProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  preferredLanguage: string;
}

const EMPTY_PROFILE: UserProfileData = {
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  preferredLanguage: 'en',
};

const FILING_STATUS_LABELS: Record<string, string> = {
  single: 'Single',
  married_filing_jointly: 'Married Filing Jointly',
  married_filing_separately: 'Married Filing Separately',
  head_of_household: 'Head of Household',
  qualifying_surviving_spouse: 'Qualifying Surviving Spouse',
};

function formatFilingStatus(status?: string | null): string {
  if (!status) return 'Not set';
  return FILING_STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

function getFallbackProfile(user: ReturnType<typeof useAuth>['user']): UserProfileData {
  return {
    firstName: user?.name?.split(' ')[0] ?? '',
    lastName: user?.name?.split(' ').slice(1).join(' ') ?? '',
    email: user?.email ?? user?.username ?? '',
    phoneNumber: user?.phone ?? '',
    preferredLanguage: 'en',
  };
}

function AccountBanner({
  tone,
  message,
  onDismiss,
}: {
  tone: 'success' | 'danger';
  message: string;
  onDismiss: () => void;
}) {
  const config = tone === 'success'
    ? {
        border: 'border-[var(--color-success-border)]',
        background: 'bg-[var(--color-success-soft)]',
        dot: 'bg-[var(--color-success)]',
        text: 'text-[var(--color-success-text)]',
        textMuted: 'text-[var(--color-success-text)]/60',
        textHover: 'hover:text-[var(--color-success-text)]',
      }
    : {
        border: 'border-[var(--color-danger-border)]',
        background: 'bg-[var(--color-danger-soft)]',
        dot: 'bg-[var(--color-danger)]',
        text: 'text-[var(--color-danger-text)]',
        textMuted: 'text-[var(--color-danger-text)]/60',
        textHover: 'hover:text-[var(--color-danger-text)]',
      };

  return (
    <div className={`flex items-center gap-3 rounded-[var(--radius-md)] border px-4 py-3 ${config.border} ${config.background}`}>
      <div className={`h-2 w-2 rounded-full ${config.dot}`} />
      <span className={`text-sm font-medium ${config.text}`}>{message}</span>
      <button onClick={onDismiss} className={`ml-auto ${config.textMuted} ${config.textHover}`}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
      </button>
    </div>
  );
}

function ProfileTab() {
  const { user, idToken } = useAuth();
  const [profile, setProfile] = useState<UserProfileData>(EMPTY_PROFILE);
  const [filingStatus, setFilingStatus] = useState<string | null>(null);
  const [hasDependents, setHasDependents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.userId) return;

    let cancelled = false;
    const fallbackProfile = getFallbackProfile(user);
    setProfile(fallbackProfile);

    fetchAccountProfile(user.userId, idToken)
      .then((data) => {
        if (cancelled || !data) return;
        setProfile({
          firstName: typeof data.firstName === 'string' ? data.firstName : fallbackProfile.firstName,
          lastName: typeof data.lastName === 'string' ? data.lastName : fallbackProfile.lastName,
          email: typeof data.email === 'string' ? data.email : fallbackProfile.email,
          phoneNumber: typeof data.phoneNumber === 'string' ? data.phoneNumber : fallbackProfile.phoneNumber,
          preferredLanguage: data.preferredLanguage === 'es' ? 'es' : 'en',
        });
        setFilingStatus(typeof data.filingStatus === 'string' ? data.filingStatus : null);
        setHasDependents(Boolean(data.hasDependents));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setSaveError(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [idToken, user]);

  const handleFieldChange = (field: keyof UserProfileData, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }));
    if (saveMessage) setSaveMessage(null);
    if (saveError) setSaveError(null);
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.userId) return;

    setSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    try {
      const updated = await updateAccountProfile(
        user.userId,
        {
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          phoneNumber: profile.phoneNumber,
          preferredLanguage: profile.preferredLanguage,
        },
        idToken,
      );

      setProfile({
        firstName: typeof updated.firstName === 'string' ? updated.firstName : '',
        lastName: typeof updated.lastName === 'string' ? updated.lastName : '',
        email: typeof updated.email === 'string' ? updated.email : '',
        phoneNumber: typeof updated.phoneNumber === 'string' ? updated.phoneNumber : '',
        preferredLanguage: updated.preferredLanguage === 'es' ? 'es' : 'en',
      });
      setFilingStatus(typeof updated.filingStatus === 'string' ? updated.filingStatus : filingStatus);
      setHasDependents(Boolean(updated.hasDependents));
      setSaveMessage('Profile updated.');
    } catch (error: any) {
      setSaveError(error?.message || 'Unable to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {saveMessage && (
        <AccountBanner tone="success" message={saveMessage} onDismiss={() => setSaveMessage(null)} />
      )}

      {saveError && (
        <AccountBanner tone="danger" message={saveError} onDismiss={() => setSaveError(null)} />
      )}

      <form onSubmit={handleSaveProfile} className="lux-card-outline p-5 sm:p-6">
        <div className="max-w-2xl space-y-6">
          <div className="space-y-5">
            <div className="border-t border-[var(--color-soft-border)] pt-4">
              <p className="lux-label">Filing Status</p>
              <p className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">
                {formatFilingStatus(filingStatus)}
              </p>
            </div>

            <div className="border-t border-[var(--color-soft-border)] pt-4">
              <p className="lux-label">Dependents</p>
              <p className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">
                {hasDependents ? 'Yes' : 'No'}
              </p>
            </div>

            <div className="border-t border-[var(--color-soft-border)] pt-4">
              <p className="lux-label">Personal Information</p>
              <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
                Used for reminders, billing, and return preparation.
              </p>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={saving}
              className="lux-button-primary px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="lux-field-label mb-1.5 block">First Name</label>
              <input
                type="text"
                value={profile.firstName}
                onChange={(e) => handleFieldChange('firstName', e.target.value)}
                placeholder="First name"
                className="lux-input"
              />
            </div>

            <div>
              <label className="lux-field-label mb-1.5 block">Last Name</label>
              <input
                type="text"
                value={profile.lastName}
                onChange={(e) => handleFieldChange('lastName', e.target.value)}
                placeholder="Last name"
                className="lux-input"
              />
            </div>

            <div>
              <label className="lux-field-label mb-1.5 block">Email</label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => handleFieldChange('email', e.target.value)}
                placeholder="you@example.com"
                className="lux-input"
              />
            </div>

            <div>
              <label className="lux-field-label mb-1.5 block">Phone Number</label>
              <input
                type="tel"
                value={profile.phoneNumber}
                onChange={(e) => handleFieldChange('phoneNumber', e.target.value)}
                placeholder="(555) 555-5555"
                className="lux-input"
              />
            </div>

            <div>
              <label className="lux-field-label mb-1.5 block">Language</label>
              <select
                value={profile.preferredLanguage}
                onChange={(e) => handleFieldChange('preferredLanguage', e.target.value)}
                className="lux-select"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
              </select>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

interface TokenPack {
  id: string;
  name: string;
  tokens: number;
  price: string;
  kind: 'one_time' | 'subscription';
  note?: string;
}

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => {
      elements: (options?: Record<string, unknown>) => {
        create: (
          type: 'card',
          options?: Record<string, unknown>,
        ) => {
          mount: (selectorOrElement: string | HTMLElement) => void;
          destroy: () => void;
        };
      };
      confirmCardPayment: (
        clientSecret: string,
        data: Record<string, unknown>,
      ) => Promise<{ paymentIntent?: { id: string; status: string }; error?: { message?: string } }>;
    };
  }
}

let stripeScriptPromise: Promise<void> | null = null;

function loadStripeJs(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Stripe is only available in the browser'));
  if (window.Stripe) return Promise.resolve();
  if (stripeScriptPromise) return stripeScriptPromise;

  stripeScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-stripe-js]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Stripe.js')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    script.dataset.stripeJs = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Stripe.js'));
    document.head.appendChild(script);
  });

  return stripeScriptPromise;
}

function CardCheckoutForm({
  offer,
  userId,
  idToken,
  initialName,
  initialEmail,
  onBack,
  onComplete,
}: {
  offer: TokenPack;
  userId: string;
  idToken?: string | null;
  initialName?: string;
  initialEmail?: string;
  onBack: () => void;
  onComplete: (message: string) => Promise<void>;
}) {
  const cardMountRef = useRef<HTMLDivElement | null>(null);
  const cardElementRef = useRef<{ mount: (selectorOrElement: string | HTMLElement) => void; destroy: () => void } | null>(null);
  const stripeRef = useRef<ReturnType<NonNullable<typeof window.Stripe>> | null>(null);
  const hasStripeClient = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

  const [fullName, setFullName] = useState(initialName ?? '');
  const [email, setEmail] = useState(initialEmail ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasStripeClient || !cardMountRef.current) return;

    let cancelled = false;
    const mountNode = cardMountRef.current;

    loadStripeJs()
      .then(() => {
        const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
        if (!publishableKey || !window.Stripe) {
          throw new Error('Stripe publishable key is missing');
        }

        const stripe = window.Stripe(publishableKey);
        const elements = stripe.elements();
        const cardElement = elements.create('card', {
          style: {
            base: {
              fontSize: '16px',
              color: '#1f172a',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              '::placeholder': { color: '#8b849b' },
            },
            invalid: {
              color: '#b42318',
              iconColor: '#b42318',
            },
          },
        });

        if (cancelled) {
          cardElement.destroy();
          return;
        }

        stripeRef.current = stripe;
        cardElementRef.current = cardElement;
        cardElement.mount(mountNode);
      })
      .catch((err: any) => {
        setError(err.message || 'Failed to load Stripe');
      });

    return () => {
      cancelled = true;
      cardElementRef.current?.destroy();
      cardElementRef.current = null;
    };
  }, [hasStripeClient]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await buyTokens(userId, offer.id, idToken);

      if (result.devMode) {
        await onComplete(
          result.message
          ?? (result.offerKind === 'subscription'
            ? `Monthly plan activated. ${result.grantedTokens?.toLocaleString() ?? '0'} tokens added to your account!`
            : `${result.grantedTokens?.toLocaleString() ?? '0'} tokens added to your account!`),
        );
        return;
      }

      const stripe = stripeRef.current;
      const cardElement = cardElementRef.current;
      if (!result.clientSecret || !stripe || !cardElement) {
        throw new Error('Stripe card form is not ready');
      }

      const confirmation = await stripe.confirmCardPayment(result.clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: fullName.trim() || undefined,
            email: email.trim() || undefined,
          },
        },
      });

      if (confirmation.error) {
        throw new Error(confirmation.error.message || 'Payment failed');
      }

      if (!confirmation.paymentIntent || confirmation.paymentIntent.status !== 'succeeded') {
        throw new Error('Payment was not completed');
      }

      const sync = await confirmTokenPurchase(
        userId,
        {
          paymentIntentId: confirmation.paymentIntent.id,
          subscriptionId: result.subscriptionId,
        },
        idToken,
      );

      await onComplete(sync.message);
    } catch (err: any) {
      setError(err.message || 'Failed to complete payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-soft-border)] pb-4">
        <div className="text-left">
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-medium text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]"
          >
            Back
          </button>
          <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">{offer.name}</p>
          <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
            {offer.kind === 'subscription'
              ? `${offer.tokens.toLocaleString()} tokens each month`
              : `${offer.tokens.toLocaleString()} tokens`}
          </p>
        </div>
        <p className="text-lg font-semibold text-[var(--color-text-primary)]">{offer.price}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="lux-field-label mb-1.5 block">Name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            className="lux-input"
          />
        </div>

        <div>
          <label className="lux-field-label mb-1.5 block">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="lux-input"
          />
        </div>

        {hasStripeClient ? (
          <div>
            <label className="lux-field-label mb-1.5 block">Card Details</label>
            <div
              ref={cardMountRef}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-4 py-4"
            />
          </div>
        ) : (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-info-border)] bg-[var(--color-info-soft)] px-4 py-3 text-sm text-[var(--color-info-text)]">
            Stripe is not configured in this environment. Submitting will use the local dev billing fallback.
          </div>
        )}

        {error && (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger-text)]">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {offer.kind === 'subscription'
              ? 'Monthly billing starts after your first successful payment.'
              : 'One-time packs never expire.'}
          </p>
          <button
            type="submit"
            disabled={loading}
            className="lux-button-primary px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Processing...' : offer.kind === 'subscription' ? 'Start Plan' : 'Pay'}
          </button>
        </div>
      </form>
    </div>
  );
}

function BuyTokensModal({
  open,
  offers,
  selectedOffer,
  userId,
  idToken,
  initialName,
  initialEmail,
  onClose,
  onSelectOffer,
  onBackToOffers,
  onPurchaseComplete,
}: {
  open: boolean;
  offers: TokenPack[];
  selectedOffer: TokenPack | null;
  userId: string;
  idToken?: string | null;
  initialName?: string;
  initialEmail?: string;
  onClose: () => void;
  onSelectOffer: (offerId: string) => void;
  onBackToOffers: () => void;
  onPurchaseComplete: (message: string) => Promise<void>;
}) {
  if (!open) return null;

  const tokenPacks = offers.filter((offer) => offer.kind === 'one_time');
  const monthlyPlan = offers.find((offer) => offer.kind === 'subscription') ?? null;

  return (
    <ModalPortal>
      <div className="lux-modal-shell">
        <div className="lux-modal-backdrop" onClick={onClose} />

        <div className="lux-modal-card lux-modal-card-xl">
          <div className="lux-modal-header">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Buy Tokens</h2>
              <p className="lux-modal-subtitle">
                {selectedOffer
                  ? `Enter your payment details for ${selectedOffer.name} without leaving this page.`
                  : 'Choose a pack or monthly plan. In local dev, purchases are added directly so you can test the flow.'}
              </p>
            </div>
          </div>

          <div className="lux-modal-body">
            {selectedOffer ? (
              <CardCheckoutForm
                offer={selectedOffer}
                userId={userId}
                idToken={idToken}
                initialName={initialName}
                initialEmail={initialEmail}
                onBack={onBackToOffers}
                onComplete={onPurchaseComplete}
              />
            ) : (
              <>
                {monthlyPlan && (
                  <section className="space-y-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">Monthly Plan</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectOffer(monthlyPlan.id)}
                      className="lux-card-outline flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:border-[var(--color-brand-strong)] hover:bg-[var(--color-brand-soft)]"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{monthlyPlan.name}</p>
                        <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                          {monthlyPlan.tokens.toLocaleString()} tokens each month
                        </p>
                        {monthlyPlan.note && (
                          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{monthlyPlan.note}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-semibold text-[var(--color-text-primary)]">{monthlyPlan.price}</p>
                        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-brand-strong)]">
                          Choose
                        </span>
                      </div>
                    </button>
                  </section>
                )}

                <section className="space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">One-Time Packs</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {tokenPacks.map((pack) => (
                      <button
                        key={pack.id}
                        type="button"
                        onClick={() => onSelectOffer(pack.id)}
                        className="lux-card-outline flex flex-col items-center p-5 text-center transition-colors hover:border-[var(--color-brand-strong)] hover:bg-[var(--color-brand-soft)]"
                      >
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{pack.name}</p>
                        <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">{pack.tokens.toLocaleString()} tokens</p>
                        <p className="mt-3 text-xl font-semibold text-[var(--color-text-primary)]">{pack.price}</p>
                        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-brand-strong)]">
                          Choose
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                <p className="text-xs text-[var(--color-text-tertiary)]">
                  One-time packs never expire.
                </p>
              </>
            )}
          </div>

          <div className="lux-modal-actions">
            <button type="button" onClick={onClose} className="lux-button-secondary px-4 py-2 text-sm font-semibold">
              Close
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

function BillingTab() {
  const { totalTokens } = useAgent();
  const { user, idToken } = useAuth();
  const userId = user?.userId ?? 'dev-user-local';

  const [purchasedTokens, setPurchasedTokens] = useState(0);
  const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [showBuyTokensModal, setShowBuyTokensModal] = useState(false);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);

  const packs: TokenPack[] = [
    { id: 'monthly',  name: 'Monthly Plan', tokens: 25000, price: '$12.99/mo', kind: 'subscription', note: 'Lower monthly pricing for ongoing use.' },
    { id: 'starter',  name: 'Starter',    tokens: 5000,   price: '$4.99', kind: 'one_time' },
    { id: 'standard', name: 'Standard',   tokens: 25000,  price: '$19.99', kind: 'one_time' },
    { id: 'power',    name: 'Power Pack', tokens: 100000, price: '$49.99', kind: 'one_time' },
  ];
  const selectedOffer = packs.find((pack) => pack.id === selectedOfferId) ?? null;

  const refreshBalance = async () => {
    const balance = await getTokenBalance(userId, idToken);
    setPurchasedTokens(balance.tokens);
  };

  // Fetch token balance on mount
  useEffect(() => {
    refreshBalance().catch(() => {});
  }, [userId, idToken]);

  const totalBalance = purchasedTokens;
  const sessionUsed = totalTokens;

  const closeBuyTokensModal = () => {
    setShowBuyTokensModal(false);
    setSelectedOfferId(null);
  };

  const handlePurchaseComplete = async (message: string) => {
    setPurchaseMessage(message);
    setPurchaseError(null);
    setShowBuyTokensModal(false);
    setSelectedOfferId(null);
    await refreshBalance();
  };

  return (
    <div className="space-y-8">
      {/* ── Purchase success message ─── */}
      {purchaseMessage && (
        <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-success-border)] bg-[var(--color-success-soft)] px-4 py-3">
          <div className="h-2 w-2 rounded-full bg-[var(--color-success)]" />
          <span className="text-sm font-medium text-[var(--color-success-text)]">{purchaseMessage}</span>
          <button onClick={() => setPurchaseMessage(null)} className="ml-auto text-[var(--color-success-text)]/60 hover:text-[var(--color-success-text)]">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {purchaseError && (
        <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] px-4 py-3">
          <div className="h-2 w-2 rounded-full bg-[var(--color-danger)]" />
          <span className="text-sm font-medium text-[var(--color-danger-text)]">{purchaseError}</span>
          <button onClick={() => setPurchaseError(null)} className="ml-auto text-[var(--color-danger-text)]/60 hover:text-[var(--color-danger-text)]">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <div className="lux-summary-grid">
        {[
          { label: 'Token Balance', value: totalBalance.toLocaleString(), cls: 'text-[var(--color-text-primary)]' },
          { label: 'Session Used', value: sessionUsed.toLocaleString(), cls: 'text-[var(--color-text-secondary)]' },
        ].map((item) => (
          <div key={item.label} className="lux-summary-card">
            <p className="lux-label">{item.label}</p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${item.cls}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <section className="lux-toolbar">
        <div className="lux-toolbar-row justify-end">
          <button
            type="button"
            onClick={() => {
              setShowBuyTokensModal(true);
              setSelectedOfferId(null);
              setPurchaseError(null);
            }}
            className="lux-button-primary px-5 py-2 text-xs font-semibold"
          >
            Buy Tokens
          </button>
        </div>
      </section>

      <BuyTokensModal
        open={showBuyTokensModal}
        offers={packs}
        selectedOffer={selectedOffer}
        userId={userId}
        idToken={idToken}
        initialName={user?.name}
        initialEmail={user?.email ?? user?.username}
        onClose={closeBuyTokensModal}
        onSelectOffer={setSelectedOfferId}
        onBackToOffers={() => setSelectedOfferId(null)}
        onPurchaseComplete={handlePurchaseComplete}
      />

    </div>
  );
}

function SettingsTab() {
  const { mode } = useUserProfile();

  return (
    <section className="lux-card-outline px-5">
      <div className="divide-y divide-[var(--color-soft-border)]">
        <div className="flex items-center justify-between py-4">
          <span className="text-sm text-[var(--color-text-primary)]">Email notifications</span>
          <button className="relative h-6 w-11 rounded-full bg-[var(--color-brand-soft)] transition-colors">
            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-[var(--color-brand-strong)] transition-transform" />
          </button>
        </div>

        {mode === 'business' && (
          <div className="flex items-center justify-between py-4">
            <span className="text-sm text-[var(--color-text-primary)]">Quarterly reminders</span>
            <button className="relative h-6 w-11 rounded-full bg-[var(--color-brand-soft)] transition-colors">
              <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-[var(--color-brand-strong)] transition-transform" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

function AccountPageInner() {
  const searchParams = useSearchParams();
  const defaultTab = (searchParams.get('tab') as AccountTab) || 'profile';
  const [activeTab, setActiveTab] = useState<AccountTab>(
    TABS.some((t) => t.key === defaultTab) ? defaultTab : 'profile',
  );

  // Sync URL param changes
  useEffect(() => {
    const urlTab = searchParams.get('tab') as AccountTab;
    if (urlTab && TABS.some((t) => t.key === urlTab)) {
      setActiveTab(urlTab);
    }
  }, [searchParams]);

  return (
    <div className="lux-shell flex min-h-screen flex-col">
      <Header />

      <div className="lux-page">
        <h1 className="sr-only">Account</h1>

        {/* Tab strip */}
        <div className="overflow-x-auto">
          <div className="lux-local-tabs w-max min-w-full sm:min-w-0">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`lux-local-tab ${activeTab === tab.key ? 'is-active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="mt-8">
          {activeTab === 'profile' && <ProfileTab />}
          {activeTab === 'billing' && <BillingTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense>
      <AccountPageInner />
    </Suspense>
  );
}
