'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAgent } from '@/context/AgentContext';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useUserProfile } from '@/context/UserProfileContext';

const PHASE_LABELS: Record<string, string> = {
  intake: 'Getting Started',
  documents: 'Documents',
  qa: 'Questions',
  review: 'Review',
};

const PERSONAL_TABS = [
  { label: 'Home', href: '/home' },
  { label: 'Returns', href: '/returns' },
  { label: 'Files', href: '/files' },
  { label: 'Account', href: '/account' },
] as const;

const BUSINESS_TABS = [
  { label: 'Home', href: '/home' },
  { label: 'Books', href: '/books' },
  { label: 'Invoices', href: '/invoices' },
  { label: 'Returns', href: '/returns' },
  { label: 'Files', href: '/files' },
  { label: 'Account', href: '/account' },
] as const;

const TOKEN_WARNING_THRESHOLD = 5000;

function formatTokenCount(n: number): string {
  return n.toLocaleString('en-US');
}

export default function Header() {
  const { phase, progress, sessionKey, messages, totalTokens } = useAgent();
  const { user, logout, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { mode } = useUserProfile();
  const pathname = usePathname();
  const [hasScrolled, setHasScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handleScroll = () => setHasScrolled(window.scrollY > 10);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const hasSessionActivity = Boolean(sessionKey || messages.length > 0);
  const tabs = mode === 'business' ? BUSINESS_TABS : PERSONAL_TABS;
  const tokenWarning = totalTokens >= TOKEN_WARNING_THRESHOLD;

  const logoSrc = mounted && theme === 'dark'
    ? '/paisatax_logo2.png'
    : '/paisatax_logo_light.png';

  return (
    <header
      className={`sticky z-50 flex justify-center transition-all duration-300 ${
        hasScrolled ? 'top-4 mx-4' : 'top-0 mx-0'
      }`}
    >
      <div
        className={`w-full transition-all duration-300 ${
          hasScrolled ? 'max-w-[800px]' : 'max-w-[70rem]'
        }`}
      >
        <div
          className={`mx-auto rounded-2xl transition-all duration-300 ${
            hasScrolled
              ? 'border border-[var(--color-border)] bg-[var(--color-surface)]/85 px-2 backdrop-blur-xl'
              : 'px-4 sm:px-7'
          }`}
        >
          {/* Main row */}
          <div className="flex h-14 items-center justify-between px-3">
            {/* Logo */}
            <Link href="/home" className="flex shrink-0 items-center">
              <img
                src={logoSrc}
                alt="PaisaTax"
                width={140}
                className="h-auto"
              />
            </Link>

            {/* Center — Nav tabs (desktop) */}
            <nav className="hidden items-center gap-1 md:flex">
              {tabs.map((tab) => {
                const isActive = pathname === tab.href;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`relative flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                      isActive
                        ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)] border border-[var(--color-border-strong)]'
                        : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right side */}
            <div className="flex shrink-0 items-center gap-2">
              {/* Phase pill */}
              {hasSessionActivity && (
                <div className="hidden items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-3 py-1.5 sm:flex">
                  <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                    {PHASE_LABELS[phase] ?? phase}
                  </span>
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--color-overlay)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-brand-strong)] transition-all duration-500"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Token badge */}
              {totalTokens > 0 && (
                <Link
                  href="/account?tab=tokens"
                  className={`hidden text-xs tabular-nums sm:block ${
                    tokenWarning
                      ? 'text-[var(--color-warning-text)]'
                      : 'text-[var(--color-text-tertiary)]'
                  } hover:text-[var(--color-text-secondary)]`}
                >
                  {formatTokenCount(totalTokens)}
                </Link>
              )}

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="lux-icon-button"
                aria-label="Toggle theme"
              >
                {theme === 'light' ? (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2.2M12 19.8V22M4.93 4.93l1.56 1.56M17.51 17.51l1.56 1.56M2 12h2.2M19.8 12H22M4.93 19.07l1.56-1.56M17.51 6.49l1.56-1.56" strokeLinecap="round" />
                  </svg>
                )}
              </button>

              {/* Sign out */}
              {isAuthenticated && (
                <button
                  onClick={logout}
                  className="lux-icon-button"
                  aria-label="Sign out"
                  title={user?.username ?? 'Sign out'}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points="16 17 21 12 16 7" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Mobile nav — horizontal scroll */}
          <div className="overflow-x-auto px-3 pb-2 md:hidden">
            <nav className="flex gap-1.5">
              {tabs.map((tab) => {
                const isActive = pathname === tab.href;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)] border border-[var(--color-border-strong)]'
                        : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
