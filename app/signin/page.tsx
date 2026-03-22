'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, fetchAuthSession } from 'aws-amplify/auth';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { configureAmplify } from '@/lib/aws-config';

// Dev mode: skip Cognito when no pool ID configured
const IS_DEV = !process.env.NEXT_PUBLIC_USER_POOL_ID;

export default function SignInPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // If already authenticated, redirect to home
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/home');
    }
  }, [isAuthenticated, router]);

  // Dev mode: auto-fill dummy credentials
  useEffect(() => {
    if (IS_DEV) {
      setEmail('dev@paisatax.com');
      setPassword('dev12345');
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Dev mode: skip Cognito, login with dummy user
    if (IS_DEV) {
      try {
        await login({ username: email });
        router.push('/home');
      } catch {
        setError('Dev login failed');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      configureAmplify();

      const signInResult = await signIn({
        username: email,
        password,
        options: { authFlowType: 'USER_PASSWORD_AUTH' },
      });

      if (signInResult.isSignedIn) {
        const session = await fetchAuthSession();
        const newIdToken = session.tokens?.idToken?.toString();

        if (!newIdToken) {
          throw new Error('No token received after sign in');
        }

        await login({
          username: email,
          tokens: { idToken: newIdToken },
        });

        router.push('/home');
      } else if (
        signInResult.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED'
      ) {
        setError('Please set a new password. Contact support for assistance.');
      }
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setError(err.message || 'Check your credentials and try again');
    } finally {
      setIsLoading(false);
    }
  };

  const logoSrc = mounted && theme === 'dark'
    ? '/paisatax_logo2.png'
    : '/paisatax_logo_light.png';

  return (
    <div className="lux-shell flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <img
            src={logoSrc}
            alt="PaisaTax"
            width={180}
            className="h-auto"
          />
        </div>

        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Welcome back</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Sign in to your account
          </p>
        </div>

        <div className="lux-card-outline p-8">
          {/* Dev mode banner */}
          {IS_DEV && (
            <div className="mb-5 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-soft)] px-4 py-3 text-xs font-medium text-[var(--color-brand-strong)]">
              Dev mode — click Sign In to continue with dummy credentials
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium text-[var(--color-text-primary)]"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={IS_DEV}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background-alt)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-strong)] disabled:opacity-60"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-[var(--color-text-primary)]"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={IS_DEV}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background-alt)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-strong)] disabled:opacity-60"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] px-4 py-3 text-xs font-medium text-[var(--color-danger-text)]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="lux-button-primary w-full py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Theme toggle */}
        <div className="mt-6 flex justify-center">
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
        </div>
      </div>
    </div>
  );
}
