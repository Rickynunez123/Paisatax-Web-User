'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

// Pages that don't require authentication
const PUBLIC_PATHS = ['/signin'];

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicPage = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isPublicPage) {
      router.replace('/signin');
    }
  }, [isAuthenticated, isLoading, isPublicPage, router]);

  // Public pages always render
  if (isPublicPage) return <>{children}</>;

  // While checking auth, show nothing (prevents flash)
  if (isLoading) {
    return (
      <div className="lux-shell flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-brand-strong)] border-t-transparent" />
      </div>
    );
  }

  // Not authenticated → redirect is happening
  if (!isAuthenticated) return null;

  return <>{children}</>;
}
