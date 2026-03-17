'use client';

import { useState, useCallback } from 'react';
import type { QuickReplyOption } from '@/lib/types';
import { useAgent } from '@/context/AgentContext';
import QuickReply from './QuickReply';

interface QuickReplyGroupProps {
  questions: Array<{ content: string; options: QuickReplyOption[] }>;
}

/**
 * Renders multiple quick_reply blocks as a batched group.
 * User answers all questions, then clicks "Continue" to send them all at once.
 */
export default function QuickReplyGroup({ questions }: QuickReplyGroupProps) {
  const { sendMessage, isLoading } = useAgent();
  const [answers, setAnswers] = useState<Map<string, QuickReplyOption>>(new Map());
  const [submitted, setSubmitted] = useState(false);

  const totalQuestions = questions.length;
  const answeredCount = answers.size;
  const allAnswered = answeredCount === totalQuestions;

  const handleSelect = useCallback((question: string, option: QuickReplyOption) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(question, option);
      return next;
    });
  }, []);

  const handleSubmit = async () => {
    if (!allAnswered || submitted || isLoading) return;
    setSubmitted(true);

    // Build a natural-language summary of all answers
    const lines = questions.map((q) => {
      const answer = answers.get(q.content);
      return `${q.content} → ${answer?.label ?? 'N/A'}`;
    });
    const message = lines.join('\n');

    await sendMessage(message);
  };

  return (
    <div className="space-y-2">
      {questions.map((q, i) => (
        <QuickReply
          key={i}
          content={q.content}
          options={q.options}
          standalone={false}
          onSelect={handleSelect}
        />
      ))}

      {!submitted && (
        <div className="px-4 sm:px-5">
          <button
            onClick={handleSubmit}
            disabled={!allAnswered || isLoading}
            className="lux-button-primary w-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {allAnswered
              ? `Continue (${answeredCount} answered)`
              : `Answer all questions (${answeredCount}/${totalQuestions})`}
          </button>
        </div>
      )}

      {submitted && (
        <div className="px-4 sm:px-5">
          <p className="rounded-2xl border border-[var(--color-success-border)] bg-[var(--color-success-soft)] px-4 py-3 text-center text-xs font-semibold text-[var(--color-success-text)]">
            Answers submitted
          </p>
        </div>
      )}
    </div>
  );
}
