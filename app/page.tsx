'use client';

import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const router = useRouter();

  return (
    <main className="lux-shell flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <section className="w-full max-w-2xl">
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.42em] text-[var(--color-text-tertiary)]">
          PaisaTax
        </p>
        <h1
          className="text-center text-5xl leading-[0.94] tracking-tight text-[var(--color-text-primary)] sm:text-6xl"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Tax filing,
          <br />
          reduced to a conversation.
        </h1>
        <p className="mx-auto mt-5 max-w-lg text-center text-base leading-7 text-[var(--color-text-secondary)] sm:text-lg">
          Upload your documents. Answer only what matters. Download your return.
        </p>
        <div className="mt-10 flex justify-center">
          <button
            onClick={() => router.push('/chat')}
            className="lux-button-primary px-8 py-3.5 text-sm font-semibold uppercase tracking-[0.18em]"
          >
            Start
          </button>
        </div>
      </section>
    </main>
  );
}
