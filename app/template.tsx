import type { ReactNode } from 'react';

export default function RootTemplate({ children }: { children: ReactNode }) {
  return (
    <div className="lux-route-shell">
      <div className="lux-route-stage">{children}</div>
    </div>
  );
}
