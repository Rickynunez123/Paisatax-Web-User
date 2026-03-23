'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type OverflowMenuProps = {
  align?: 'left' | 'right';
  label?: string;
  children: (controls: { close: () => void }) => ReactNode;
};

export default function OverflowMenu({
  align = 'right',
  label = 'More actions',
  children,
}: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  return (
    <div ref={rootRef} className="lux-menu">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="lux-icon-button !h-8 !w-8"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {open && (
        <div className={`lux-menu-panel ${align === 'left' ? 'is-left' : 'is-right'}`}>
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  );
}
