'use client';

import { useRef, useEffect } from 'react';

export function useAutoScroll(deps: unknown[]) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, deps);

  return endRef;
}
