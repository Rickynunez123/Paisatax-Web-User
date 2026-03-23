'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const BOOK_TABS = [
  { label: 'Overview', href: '/books' },
  { label: 'Analytics', href: '/books/analytics' },
] as const;

export default function BooksSectionNav() {
  const pathname = usePathname();

  return (
    <div className="overflow-x-auto">
      <div className="lux-local-tabs w-max min-w-full sm:min-w-0">
      {BOOK_TABS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`lux-local-tab ${isActive ? 'is-active' : ''}`}
          >
            {tab.label}
          </Link>
        );
      })}
      </div>
    </div>
  );
}
