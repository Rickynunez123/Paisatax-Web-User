'use client';

import ModalPortal from '@/components/ui/ModalPortal';

type UserMode = 'personal' | 'business';

interface HowItWorksModalProps {
  open: boolean;
  mode: UserMode;
  onClose: () => void;
}

const MODAL_CONTENT: Record<UserMode, { subtitle: string; points: { title: string; description: string }[] }> = {
  personal: {
    subtitle: 'Your AI tax preparer can work from your uploads and the conversation to build your return with you.',
    points: [
      {
        title: 'Upload anywhere',
        description: 'Upload tax forms in Files or directly during the conversation. We extract the values and use them in your return.',
      },
      {
        title: 'The agent guides the process',
        description: 'The agent works like a preparer: reviewing documents, asking follow-up questions, and moving your return forward step by step.',
      },
      {
        title: 'We ask when something is unclear',
        description: 'If a number, form value, or match looks uncertain, we ask for your input before using it.',
      },
      {
        title: 'We help avoid duplicates',
        description: 'We check for repeated forms and overlapping values so the same income or document is not counted twice.',
      },
      {
        title: 'You can always come back',
        description: 'Saved sessions stay available so you can return to your conversation and continue where you left off.',
      },
    ],
  },
  business: {
    subtitle: 'Your AI tax preparer can work across the app to turn business activity into a cleaner, more complete return.',
    points: [
      {
        title: 'Upload anywhere',
        description: 'Upload tax forms, receipts, and other documents in Files or directly during the conversation. We extract values and organize them automatically.',
      },
      {
        title: 'Books feed the return',
        description: 'Receipts, invoices, contractor payments, mileage, and home office setup can all flow into Books and be summarized by year and quarter.',
      },
      {
        title: 'The agent works across the app',
        description: 'The agent can use your uploads, books, invoices, and contractor activity together, like a preparer building your business return.',
      },
      {
        title: 'We ask when something needs judgment',
        description: 'If a category, amount, or tax treatment is uncertain, we ask for your input before finalizing it.',
      },
      {
        title: 'We check for repeated transactions',
        description: 'We try to prevent duplicate income and expense entries so the same payment or document is not counted twice.',
      },
      {
        title: 'You can review everything',
        description: 'You can track what was used, see summaries in Books, and return to saved conversations anytime.',
      },
    ],
  },
};

export default function HowItWorksModal({ open, mode, onClose }: HowItWorksModalProps) {
  if (!open) return null;

  const content = MODAL_CONTENT[mode];

  return (
    <ModalPortal>
      <div className="lux-modal-shell">
        <div className="lux-modal-backdrop" onClick={onClose} />

        <div className="lux-modal-card lux-modal-card-lg">
          <div className="lux-modal-header">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">How it works</h2>
              <p className="lux-modal-subtitle">{content.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="lux-icon-button"
              aria-label="Close"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="lux-modal-body">
            <div className="space-y-4 text-left">
              {content.points.map((point, index) => (
                <div
                  key={point.title}
                  className={`${index === 0 ? '' : 'border-t border-[var(--color-soft-border)] pt-4'}`}
                >
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{point.title}</p>
                  <p className="mt-1.5 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {point.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="lux-modal-actions">
            <button type="button" onClick={onClose} className="lux-button-primary px-5 py-2 text-sm font-semibold">
              Got it
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
