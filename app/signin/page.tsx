'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, fetchAuthSession } from 'aws-amplify/auth';
import { useAuth } from '@/context/AuthContext';
import { configureAmplify } from '@/lib/aws-config';

export default function SignInPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

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

  return (
    <div className="lux-shell flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">PaisaTax</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Sign in to your account
          </p>
        </div>

        <div className="lux-card-outline p-8">
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
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background-alt)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-strong)]"
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
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background-alt)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-strong)]"
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
      </div>
    </div>
  );
}
