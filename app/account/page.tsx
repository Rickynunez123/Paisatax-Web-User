'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import { useAgent } from '@/context/AgentContext';
import { useUserProfile } from '@/context/UserProfileContext';

type AccountTab = 'profile' | 'tokens' | 'subscription' | 'payments' | 'settings';

const TABS: { key: AccountTab; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'tokens', label: 'Tokens' },
  { key: 'subscription', label: 'Subscription' },
  { key: 'payments', label: 'Payments' },
  { key: 'settings', label: 'Settings' },
];

// ─── Tab Content Components ──────────────────────────────────────────────────

function ProfileTab() {
  return (
    <div className="space-y-5">
      <div>
        <label className="lux-field-label mb-1.5 block">Name</label>
        <input type="text" className="lux-input" placeholder="Your name" />
      </div>
      <div>
        <label className="lux-field-label mb-1.5 block">Email</label>
        <input
          type="email"
          className="lux-input opacity-60"
          placeholder="you@example.com"
          readOnly
        />
      </div>
      <div>
        <label className="lux-field-label mb-1.5 block">Language</label>
        <div className="flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-background-alt)]/72 w-fit">
          <button className="rounded-full bg-[var(--color-brand-soft)] px-4 py-2 text-xs font-medium text-[var(--color-brand-strong)]">
            English
          </button>
          <button className="rounded-full px-4 py-2 text-xs font-medium text-[var(--color-text-tertiary)]">
            Espa&ntilde;ol
          </button>
        </div>
      </div>
      <button disabled className="lux-button-primary px-5 py-2 text-sm font-semibold opacity-50" title="Coming soon">
        Save
      </button>
    </div>
  );
}

function TokensTab() {
  const { totalTokens } = useAgent();
  const planLimit = 50000; // free tier placeholder
  const usedPct = Math.min((totalTokens / planLimit) * 100, 100);
  const isLow = usedPct > 90;

  const packs = [
    { name: 'Starter', tokens: '5,000', price: '$4.99' },
    { name: 'Standard', tokens: '25,000', price: '$19.99' },
    { name: 'Power Pack', tokens: '100,000', price: '$49.99' },
  ];

  return (
    <div className="space-y-8">
      {/* Usage */}
      <div>
        <p className="text-3xl font-semibold tabular-nums text-[var(--color-text-primary)]">
          {totalTokens.toLocaleString()}
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">tokens used this session</p>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-overlay)]">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isLow ? 'bg-amber-500' : 'bg-[var(--color-brand-strong)]'
            }`}
            style={{ width: `${usedPct}%` }}
          />
        </div>
      </div>

      {/* Token Packs */}
      <div>
        <h3 className="lux-field-label mb-4">Need more tokens?</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {packs.map((pack) => (
            <div key={pack.name} className="lux-card-outline p-5 text-center">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">{pack.name}</p>
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{pack.tokens} tokens</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text-primary)]">{pack.price}</p>
              <button
                disabled
                className="lux-button-primary mt-3 w-full px-4 py-2 text-xs font-semibold opacity-50"
                title="Coming soon"
              >
                Buy
              </button>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">Token packs never expire.</p>
      </div>
    </div>
  );
}

function SubscriptionTab() {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: '/month',
      desc: '2,000 tokens included per session',
      active: true,
    },
    {
      name: 'Standard',
      price: '$9',
      period: '/month',
      desc: '50,000 tokens/month',
      active: false,
    },
    {
      name: 'Treprenuer',
      price: '$19',
      period: '/month',
      desc: '200,000 tokens/month + bookkeeping + invoicing',
      active: false,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-[var(--radius-md)] border p-5 ${
              plan.active
                ? 'border-[var(--color-brand-strong)] bg-[var(--color-brand-soft)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface-soft)]'
            }`}
          >
            <p className="text-base font-semibold text-[var(--color-text-primary)]">{plan.name}</p>
            <p className="mt-1">
              <span className="text-2xl font-semibold text-[var(--color-text-primary)]">{plan.price}</span>
              <span className="text-sm text-[var(--color-text-tertiary)]">{plan.period}</span>
            </p>
            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{plan.desc}</p>
            {plan.active ? (
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-brand-strong)]">
                Current Plan
              </p>
            ) : (
              <button
                disabled
                className="lux-button-secondary mt-4 w-full px-4 py-2 text-xs font-semibold opacity-50"
                title="Coming soon"
              >
                Upgrade
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-[var(--color-text-tertiary)]">
        Federal e-file: $19.99 per return · State e-file: $9.99 per return (coming soon)
      </p>
    </div>
  );
}

function PaymentsTab() {
  const stripeConnected = false; // placeholder

  if (!stripeConnected) {
    return (
      <div className="lux-card-outline p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Connect your bank to receive payments
        </h3>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          PaisaTax uses Stripe to send invoices and deposit payments directly to your account.
        </p>
        <button
          disabled
          className="lux-button-primary mt-4 px-5 py-2 text-xs font-semibold opacity-50"
          title="Coming soon"
        >
          Connect Bank Account
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-[var(--color-success)]" />
        <span className="text-sm font-medium text-[var(--color-success-text)]">
          Connected · Payouts enabled
        </span>
      </div>
      <div className="lux-card-outline p-4">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--color-text-secondary)]">Payout schedule</span>
          <span className="text-[var(--color-text-primary)]">Standard — 2 business days</span>
        </div>
      </div>
      <a
        href="https://dashboard.stripe.com"
        target="_blank"
        rel="noopener noreferrer"
        className="lux-button-secondary inline-flex px-4 py-2 text-xs font-semibold"
      >
        Manage Stripe Account
      </a>
      <button
        disabled
        className="lux-button-secondary ml-3 px-4 py-2 text-xs font-semibold text-[var(--color-danger)] opacity-50"
        title="Coming soon"
      >
        Disconnect
      </button>
    </div>
  );
}

function SettingsTab() {
  const { mode, setMode } = useUserProfile();
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Toggles */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--color-text-primary)]">Email notifications</span>
          <button className="relative h-6 w-11 rounded-full bg-[var(--color-brand-soft)] transition-colors">
            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-[var(--color-brand-strong)] transition-transform" />
          </button>
        </div>

        {mode === 'business' && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--color-text-primary)]">Quarterly reminders</span>
            <button className="relative h-6 w-11 rounded-full bg-[var(--color-brand-soft)] transition-colors">
              <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-[var(--color-brand-strong)] transition-transform" />
            </button>
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="border-t border-[var(--color-soft-border)] pt-6">
        <p className="lux-field-label mb-2">Danger Zone</p>
        <p className="text-xs text-[var(--color-text-tertiary)] mb-3">
          This returns you to the mode selection screen.
        </p>
        <button
          onClick={() => {
            setMode('personal');
            if (typeof window !== 'undefined') {
              window.localStorage.removeItem('paisatax-mode');
            }
            router.push('/');
          }}
          className="rounded-full border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-4 py-2 text-xs font-semibold text-[var(--color-danger-text)]"
        >
          Reset Mode Preference
        </button>
      </div>
    </div>
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

      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
          Account
        </h1>

        {/* Tab strip */}
        <div className="mt-6 flex gap-2 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] transition-colors ${
                activeTab === tab.key
                  ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)] border border-[var(--color-brand-strong)]'
                  : 'border border-[var(--color-border)] text-[var(--color-text-tertiary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="mt-8">
          {activeTab === 'profile' && <ProfileTab />}
          {activeTab === 'tokens' && <TokensTab />}
          {activeTab === 'subscription' && <SubscriptionTab />}
          {activeTab === 'payments' && <PaymentsTab />}
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
