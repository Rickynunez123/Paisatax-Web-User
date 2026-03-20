'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import { useAgent } from '@/context/AgentContext';
import { useUserProfile } from '@/context/UserProfileContext';

type AccountTab = 'profile' | 'billing' | 'settings';

const TABS: { key: AccountTab; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'billing', label: 'Billing' },
  { key: 'settings', label: 'Settings' },
];

// ─── Tab Content Components ──────────────────────────────────────────────────

// ─── Dev dummy profile (mirrors DynamoDB Users table schema) ─────────────────

interface UserProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  birthday: string;
  preferredLanguage: string;
  createdAt: string;
}

const DEV_PROFILE: UserProfileData = {
  firstName: 'Ricardo',
  lastName: 'Nunez',
  email: 'ricardo@paisatax.com',
  phoneNumber: '+13051234567',
  birthday: '03/15/1995',
  preferredLanguage: 'en',
  createdAt: '2026-01-15T10:30:00.000Z',
};

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

function formatDate(dateStr: string): string {
  // Handle MM/DD/YYYY or ISO
  const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function ProfileInfoRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-[var(--color-text-primary)] truncate">{value}</p>
      </div>
    </div>
  );
}

function ProfileTab() {
  // TODO: fetch from backend API in production
  const profile = DEV_PROFILE;

  return (
    <div className="space-y-6">
      {/* Avatar + Name Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-brand-soft)] text-2xl font-bold text-[var(--color-brand-strong)]">
          {profile.firstName[0]}{profile.lastName[0]}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {profile.firstName} {profile.lastName}
          </h2>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Member since {formatDate(profile.createdAt)}
          </p>
        </div>
      </div>

      {/* Personal Information Card */}
      <div className="lux-card-outline p-5">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)] mb-2">
          Personal Information
        </h3>

        <div className="divide-y divide-[var(--color-soft-border)]">
          <ProfileInfoRow
            label="Full Name"
            value={`${profile.firstName} ${profile.lastName}`}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          />
          <ProfileInfoRow
            label="Email"
            value={profile.email}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="2" y="4" width="20" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M22 7l-10 7L2 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          />
          <ProfileInfoRow
            label="Phone Number"
            value={formatPhone(profile.phoneNumber)}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          />
          <ProfileInfoRow
            label="Date of Birth"
            value={formatDate(profile.birthday)}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
                <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" />
                <line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" />
              </svg>
            }
          />
        </div>
      </div>

      {/* Language Preference */}
      <div className="lux-card-outline p-5">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)] mb-3">
          Language Preference
        </h3>
        <div className="flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-background-alt)]/72 w-fit">
          <button className={`rounded-full px-4 py-2 text-xs font-medium ${
            profile.preferredLanguage === 'en'
              ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]'
              : 'text-[var(--color-text-tertiary)]'
          }`}>
            English
          </button>
          <button className={`rounded-full px-4 py-2 text-xs font-medium ${
            profile.preferredLanguage === 'es'
              ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]'
              : 'text-[var(--color-text-tertiary)]'
          }`}>
            Espa&ntilde;ol
          </button>
        </div>
      </div>

      <button disabled className="lux-button-primary px-5 py-2 text-sm font-semibold opacity-50" title="Coming soon">
        Edit Profile
      </button>
    </div>
  );
}

function BillingTab() {
  const { totalTokens } = useAgent();
  const { mode } = useUserProfile();
  const planLimit = 50000;
  const usedPct = Math.min((totalTokens / planLimit) * 100, 100);
  const isLow = usedPct > 90;

  const plans = [
    { name: 'Free', price: '$0', period: '/mo', desc: '2,000 tokens per session', active: true },
    { name: 'Standard', price: '$9', period: '/mo', desc: '50,000 tokens/month', active: false },
    { name: 'Treprenuer', price: '$19', period: '/mo', desc: '200K tokens + bookkeeping + invoicing', active: false },
  ];

  const packs = [
    { name: 'Starter', tokens: '5,000', price: '$4.99' },
    { name: 'Standard', tokens: '25,000', price: '$19.99' },
    { name: 'Power Pack', tokens: '100,000', price: '$49.99' },
  ];

  return (
    <div className="space-y-10">
      {/* ── Current Plan ─────────────────────────────────── */}
      <section>
        <h3 className="lux-field-label mb-4">Subscription</h3>
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
        <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">
          Federal e-file: $19.99 per return · State e-file: $9.99 per return (coming soon)
        </p>
      </section>

      {/* ── Token Usage ──────────────────────────────────── */}
      <section>
        <h3 className="lux-field-label mb-4">Token Usage</h3>
        <div className="lux-card-outline p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-semibold tabular-nums text-[var(--color-text-primary)]">
              {totalTokens.toLocaleString()}
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              of {planLimit.toLocaleString()} (free tier)
            </p>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--color-overlay)]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isLow ? 'bg-amber-500' : 'bg-[var(--color-brand-strong)]'
              }`}
              style={{ width: `${usedPct}%` }}
            />
          </div>
        </div>
      </section>

      {/* ── Token Packs ──────────────────────────────────── */}
      <section>
        <h3 className="lux-field-label mb-4">Buy Tokens</h3>
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
      </section>

      {/* ── Bank / Stripe Connect (business mode only) ───── */}
      {mode === 'business' && (
        <section>
          <h3 className="lux-field-label mb-4">Bank Connection</h3>
          <div className="lux-card-outline p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Connect your bank to receive invoice payments
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
        </section>
      )}
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
