'use client';

import type { AgentMessageBlock, ChatMessage, QuickReplyOption } from '@/lib/types';
import QuickReply from './QuickReply';
import QuickReplyGroup from './QuickReplyGroup';
import ConfirmationCard from './ConfirmationCard';
import SummaryCard from './SummaryCard';
import UploadZone from './UploadZone';
import DocumentReview from './DocumentReview';
import PaymentCard from './PaymentCard';
import DownloadLink from './DownloadLink';
import OnboardingBasicsBlock from './OnboardingBasicsBlock';
import OnboardingFilesBlock from './OnboardingFilesBlock';
import OnboardingProfilesBlock from './OnboardingProfilesBlock';
import OnboardingIdentityBlock from './OnboardingIdentityBlock';

const INLINE_BLOCK_REGEX = /```(\w+)\s*\n([\s\S]*?)```/g;

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text.trim());
  } catch {
    return null;
  }
}

function toQuickReplyOptions(value: unknown): QuickReplyOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (option): option is QuickReplyOption =>
        typeof option === 'object' &&
        option !== null &&
        'label' in option &&
        'value' in option &&
        typeof option.label === 'string' &&
        typeof option.value === 'string',
    );
}

function normalizeTextBlock(content: string): AgentMessageBlock[] {
  const normalized: AgentMessageBlock[] = [];
  let lastIndex = 0;

  INLINE_BLOCK_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = INLINE_BLOCK_REGEX.exec(content)) !== null) {
    const textBefore = content.slice(lastIndex, match.index).trim();
    if (textBefore) normalized.push({ type: 'text', content: textBefore });

    const blockType = match[1].toLowerCase();
    const blockBody = match[2];

    if (blockType === 'quick_reply') {
      const parsed = tryParseJson(blockBody) as { content?: unknown; options?: unknown } | null;
      const options = toQuickReplyOptions(parsed?.options);
      if (typeof parsed?.content === 'string' && options.length > 0) {
        normalized.push({ type: 'quick_reply', content: parsed.content, options });
      } else if (blockBody.trim()) {
        normalized.push({ type: 'text', content: blockBody.trim() });
      }
    } else if (blockType === 'confirmation') {
      const parsed = tryParseJson(blockBody) as { content?: string; fields?: unknown[] } | null;
      if (parsed?.fields && Array.isArray(parsed.fields)) {
        normalized.push({
          type: 'confirmation',
          content: parsed.content ?? 'Please confirm these values',
          fields: parsed.fields as any,
        });
      } else if (blockBody.trim()) {
        normalized.push({ type: 'text', content: blockBody.trim() });
      }
    } else if (blockType === 'summary') {
      const parsed = tryParseJson(blockBody) as Record<string, unknown> | null;
      if (parsed) {
        normalized.push({
          type: 'summary',
          ...parsed,
        } as any);
      } else if (blockBody.trim()) {
        normalized.push({ type: 'text', content: blockBody.trim() });
      }
    } else if (blockType === 'document_review') {
      const parsed = tryParseJson(blockBody) as { content?: string; documents?: unknown[] } | null;
      if (parsed?.documents && Array.isArray(parsed.documents)) {
        normalized.push({
          type: 'document_review',
          content: parsed.content ?? 'Documents processed',
          documents: parsed.documents as any,
        });
      } else if (blockBody.trim()) {
        normalized.push({ type: 'text', content: blockBody.trim() });
      }
    } else if (blockType === 'upload_prompt') {
      normalized.push({ type: 'upload_prompt', content: blockBody.trim() || 'Upload your documents' });
    } else if (blockType === 'download') {
      normalized.push({ type: 'download', content: blockBody.trim() || 'Download your tax return' });
    } else if (blockBody.trim()) {
      normalized.push({ type: 'text', content: blockBody.trim() });
    }

    lastIndex = match.index + match[0].length;
  }

  const remaining = content.slice(lastIndex).trim();
  if (remaining) normalized.push({ type: 'text', content: remaining });

  return normalized.length > 0 ? normalized : [{ type: 'text', content }];
}

function normalizeBlocks(blocks: AgentMessageBlock[]): AgentMessageBlock[] {
  return blocks.flatMap((block) =>
    block.type === 'text' ? normalizeTextBlock(block.content) : [block],
  );
}

function renderStructuredBlock(block: AgentMessageBlock, index: number) {
  switch (block.type) {
    case 'quick_reply':
      return <QuickReply key={index} content={block.content} options={block.options} />;

    case 'confirmation':
      return <ConfirmationCard key={index} content={block.content} fields={block.fields} />;

    case 'summary':
      return (
        <SummaryCard
          key={index}
          refund={block.refund}
          owed={block.owed}
          progress={block.progress}
          phase={block.phase}
          agi={block.agi}
          totalIncome={block.totalIncome}
          totalTax={block.totalTax}
        />
      );

    case 'upload_prompt':
      return (
        <div key={index} className="lux-panel-soft space-y-3 px-4 py-4 sm:px-5">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{block.content}</p>
          <UploadZone />
        </div>
      );

    case 'document_review':
      return <DocumentReview key={index} content={block.content} documents={block.documents} />;

    case 'payment':
      return <PaymentCard key={index} content={block.content} />;

    case 'download':
      return (
        <DownloadLink
          key={index}
          content={block.content}
          refund={block.refund}
          amountOwed={block.amountOwed}
          primaryName={block.primaryName}
          filingStatus={block.filingStatus}
          forms={block.forms}
        />
      );

    case 'onboarding_basics':
      return <OnboardingBasicsBlock key={index} isReturning={block.isReturning} prefilled={block.prefilled} />;

    case 'onboarding_files':
      return <OnboardingFilesBlock key={index} files={block.files} />;

    case 'onboarding_profiles':
      return <OnboardingProfilesBlock key={index} isReturning={block.isReturning} preselected={block.preselected} />;

    case 'onboarding_identity':
      return (
        <OnboardingIdentityBlock
          key={index}
          isReturning={block.isReturning}
          showSpouse={block.showSpouse}
          showDependents={block.showDependents}
          prefilled={block.prefilled}
        />
      );

    default:
      return null;
  }
}

export default function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const normalizedBlocks = normalizeBlocks(message.blocks);
  const textBlocks = normalizedBlocks.filter(
    (block): block is Extract<AgentMessageBlock, { type: 'text' }> => block.type === 'text',
  );
  const otherBlocks = normalizedBlocks.filter((block) => block.type !== 'text');

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[85%] rounded-[26px] rounded-br-[10px] px-4 py-3 text-sm font-medium text-white shadow-[var(--shadow-brand)] sm:max-w-[70%]"
          style={{
            background:
              'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-strong) 100%)',
          }}
        >
          <div className="space-y-3">
            {textBlocks.map((block, index) => (
              <p key={index} className="whitespace-pre-wrap leading-6">
                {block.content}
              </p>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start gap-3">
      <div className="mt-1 hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-brand-soft)] text-sm font-semibold text-[var(--color-brand-strong)] sm:flex">
        PT
      </div>
      <div className="min-w-0 max-w-full flex-1 space-y-3">
        {textBlocks.length > 0 && (
          <div className="rounded-[28px] border border-[var(--color-soft-border)] bg-[var(--color-surface)]/92 px-5 py-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
            <div className="space-y-3">
              {textBlocks.map((block, index) => (
                <p
                  key={index}
                  className="whitespace-pre-wrap text-[15px] leading-7 text-[var(--color-text-primary)]"
                >
                  {block.content}
                </p>
              ))}
            </div>
          </div>
        )}

        {renderOtherBlocks(otherBlocks)}
      </div>
    </div>
  );
}

/**
 * Groups quick_reply blocks into a QuickReplyGroup (batched) when:
 * - There are 2+ quick_reply blocks, OR
 * - There's a quick_reply alongside a confirmation block
 *
 * This prevents quick_reply clicks from auto-sending while the user
 * is still reviewing/confirming other interactive blocks in the same message.
 */
function renderOtherBlocks(blocks: AgentMessageBlock[]) {
  const quickReplyBlocks = blocks.filter((b) => b.type === 'quick_reply');
  const hasConfirmation = blocks.some((b) => b.type === 'confirmation');

  // Batch quick_replies when 2+ OR when alongside a confirmation card
  if (quickReplyBlocks.length >= 2 || (quickReplyBlocks.length >= 1 && hasConfirmation)) {
    const questions = quickReplyBlocks.map((b) => ({
      content: (b as any).content,
      options: (b as any).options,
    }));
    const nonQuickReply = blocks.filter((b) => b.type !== 'quick_reply');

    return (
      <>
        {nonQuickReply.map((block, index) => renderStructuredBlock(block, index))}
        <QuickReplyGroup key="qr-group" questions={questions} />
      </>
    );
  }

  // Otherwise render each block individually
  return blocks.map((block, index) => renderStructuredBlock(block, index));
}
