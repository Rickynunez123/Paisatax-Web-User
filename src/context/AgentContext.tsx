'use client';

/**
 * paisatax-web-user/src/context/AgentContext.tsx
 *
 * Global state for the chat agent session.
 */

import {
  createContext,
  useContext,
  useCallback,
  useState,
  type ReactNode,
} from 'react';
import type {
  AgentPhase,
  AgentMessageBlock,
  ChatMessage,
  QuickReplyOption,
  ConfirmedFieldValue,
  DocumentMetadata,
  DuplicateWarning,
} from '@/lib/types';
import * as api from '@/lib/api';
import type { StreamEvent, ConverseParams } from '@/lib/api';

interface AgentState {
  sessionKey: string | null;
  phase: AgentPhase;
  progress: number;
  messages: ChatMessage[];
  isLoading: boolean;
  /** Real-time status text shown while the agent is working (e.g. "Thinking...", "Using calculate_tax..."). */
  statusText: string | null;
  error: string | null;
  totalTokens: number;
  documents: DocumentMetadata[];
  duplicateWarnings: DuplicateWarning[];
}

interface AgentActions {
  startSession: (filingStatus: string, label?: string, taxYear?: string, hasDependents?: boolean, prefill?: { profiles?: string[]; identity?: Record<string, string> }) => Promise<void>;
  loadSession: (sessionKey: string) => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  selectOption: (option: QuickReplyOption) => Promise<void>;
  reviewFields: (confirmedFields: ConfirmedFieldValue[], rejectedFields: string[]) => Promise<void>;
  confirmFields: (fields: ConfirmedFieldValue[]) => Promise<void>;
  rejectFields: (nodeIds: string[]) => Promise<void>;
  uploadFiles: (files: File[], message?: string) => Promise<void>;
  downloadPdf: () => Promise<void>;
  refreshDocuments: () => Promise<void>;
  clearError: () => void;
  resetSession: () => void;
  addUserMessage: (text: string) => void;
  addAssistantBlocks: (blocks: AgentMessageBlock[]) => void;
}

type AgentContextValue = AgentState & AgentActions;

const AgentContext = createContext<AgentContextValue | null>(null);

export function useAgent(): AgentContextValue {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error('useAgent must be used within AgentProvider');
  return ctx;
}

export function AgentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AgentState>({
    sessionKey: null,
    phase: 'intake',
    progress: 0,
    messages: [],
    isLoading: false,
    statusText: null,
    error: null,
    totalTokens: 0,
    documents: [],
    duplicateWarnings: [],
  });

  const createInitialState = useCallback(
    (messages: ChatMessage[] = [], isLoading = false): AgentState => ({
      sessionKey: null,
      phase: 'intake',
      progress: 0,
      messages,
      isLoading,
      statusText: null,
      error: null,
      totalTokens: 0,
      documents: [],
      duplicateWarnings: [],
    }),
    [],
  );

  const addUserMessage = useCallback((text: string) => {
    const msg: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      blocks: [{ type: 'text', content: text }],
      timestamp: new Date().toISOString(),
    };
    setState((s) => ({ ...s, messages: [...s.messages, msg] }));
  }, []);

  const addAssistantBlocks = useCallback((blocks: AgentMessageBlock[]) => {
    const msg: ChatMessage = {
      id: `msg_${Date.now()}_assistant`,
      role: 'assistant',
      blocks,
      timestamp: new Date().toISOString(),
    };
    setState((s) => ({ ...s, messages: [...s.messages, msg] }));
  }, []);

  const handleResponse = useCallback(
    (response: { messages: AgentMessageBlock[]; phase: AgentPhase; progress: number; usage?: { totalSessionTokens: number } }) => {
      addAssistantBlocks(response.messages);
      setState((s) => ({
        ...s,
        phase: response.phase,
        progress: response.progress,
        isLoading: false,
        totalTokens: response.usage?.totalSessionTokens ?? s.totalTokens,
      }));
    },
    [addAssistantBlocks],
  );

  const handleError = useCallback((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Something went wrong';
    setState((s) => ({ ...s, error: message, isLoading: false }));
  }, []);

  /**
   * Streaming converse — shows text token-by-token as the LLM generates it.
   * Creates a placeholder assistant message, appends text_delta events to it,
   * then replaces with the final response blocks on completion.
   */
  const converseStreaming = useCallback(
    async (params: ConverseParams) => {
      const streamMsgId = `msg_${Date.now()}_stream`;

      // Add a placeholder assistant message for streaming text
      const placeholder: ChatMessage = {
        id: streamMsgId,
        role: 'assistant',
        blocks: [{ type: 'text', content: '' }],
        timestamp: new Date().toISOString(),
      };
      setState((s) => ({ ...s, messages: [...s.messages, placeholder] }));

      const response = await api.converseStream(params, (event: StreamEvent) => {
        if (event.type === 'thinking') {
          setState((s) => ({ ...s, statusText: 'Thinking...' }));
        } else if (event.type === 'tool_use') {
          // Humanize tool names: send_input → "Sending input", finalize_return → "Finalizing return"
          const friendly = event.name
            .replace(/_/g, ' ')
            .replace(/^\w/, (c: string) => c.toUpperCase());
          setState((s) => ({ ...s, statusText: `${friendly}...` }));
        } else if (event.type === 'text_delta') {
          // Clear status once text starts streaming, append to placeholder
          setState((s) => ({
            ...s,
            statusText: null,
            messages: s.messages.map((m) =>
              m.id === streamMsgId
                ? {
                    ...m,
                    blocks: m.blocks.map((b, i) =>
                      i === m.blocks.length - 1 && b.type === 'text'
                        ? { ...b, content: b.content + event.text }
                        : b,
                    ),
                  }
                : m,
            ),
          }));
        }
      });

      // Replace streaming placeholder with the final response blocks
      setState((s) => ({
        ...s,
        messages: s.messages
          .filter((m) => m.id !== streamMsgId)
          .concat({
            id: `msg_${Date.now()}_assistant`,
            role: 'assistant',
            blocks: response.messages,
            timestamp: new Date().toISOString(),
          }),
        phase: response.phase,
        progress: response.progress,
        isLoading: false,
        statusText: null,
        totalTokens: response.usage?.totalSessionTokens ?? s.totalTokens,
      }));

      return response;
    },
    [],
  );

  const startSession = useCallback(
    async (filingStatus: string, label?: string, taxYear?: string, hasDependents?: boolean, prefill?: { profiles?: string[]; identity?: Record<string, string> }) => {
      const initialUserMessage: ChatMessage = {
        id: `msg_${Date.now()}_user`,
        role: 'user',
        blocks: [{ type: 'text', content: label ?? filingStatus.replace(/_/g, ' ') }],
        timestamp: new Date().toISOString(),
      };
      setState(createInitialState([initialUserMessage], true));
      try {
        const { sessionKey } = await api.createSession(filingStatus, taxYear, hasDependents, prefill);
        setState((s) => ({ ...s, sessionKey }));

        // Build a context-aware initial message
        const dependentsNote = hasDependents ? ' I have dependents.' : '';
        const yearNote = taxYear && taxYear !== '2025' ? ` for tax year ${taxYear}` : '';
        const profileNote = prefill?.profiles?.length
          ? ` My income types: ${prefill.profiles.join(', ')}.`
          : '';
        const identityNote = prefill?.identity?.firstName
          ? ` My name is ${prefill.identity.firstName}${prefill.identity.lastName ? ' ' + prefill.identity.lastName : ''}.`
          : '';
        const prefillNote = prefill
          ? ' My info and profiles have been pre-loaded. Please review what documents I should upload or ask any remaining questions.'
          : '';

        await converseStreaming({
          sessionKey,
          message: `I want to file my taxes${yearNote}. My filing status is ${label ?? filingStatus.replace(/_/g, ' ')}.${dependentsNote}${identityNote}${profileNote}${prefillNote}`,
        });
      } catch (err) {
        handleError(err);
      }
    },
    [createInitialState, handleError, handleResponse],
  );

  const loadSession = useCallback(
    async (sessionKey: string) => {
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const { messages } = await api.getChatHistory(sessionKey);
        setState((s) => ({
          ...s,
          sessionKey,
          messages,
          isLoading: false,
        }));
      } catch (err) {
        handleError(err);
      }
    },
    [handleError],
  );

  const sendMessage = useCallback(
    async (message: string) => {
      if (!state.sessionKey || !message.trim()) return;
      addUserMessage(message);
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        await converseStreaming({ sessionKey: state.sessionKey, message });
      } catch (err) {
        handleError(err);
      }
    },
    [state.sessionKey, addUserMessage, converseStreaming, handleError],
  );

  const selectOption = useCallback(
    async (option: QuickReplyOption) => {
      if (!state.sessionKey) return;
      addUserMessage(option.label);
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        await converseStreaming({
          sessionKey: state.sessionKey,
          selectedOption: option.value,
        });
      } catch (err) {
        handleError(err);
      }
    },
    [state.sessionKey, addUserMessage, converseStreaming, handleError],
  );

  const reviewFields = useCallback(
    async (confirmedFields: ConfirmedFieldValue[], rejectedFields: string[]) => {
      if (!state.sessionKey) return;
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        await converseStreaming({
          sessionKey: state.sessionKey,
          confirmedFields,
          rejectedFields,
          message: 'I reviewed the extracted values.',
        });
      } catch (err) {
        handleError(err);
      }
    },
    [state.sessionKey, converseStreaming, handleError],
  );

  const confirmFields = useCallback(
    async (fields: ConfirmedFieldValue[]) => {
      if (!state.sessionKey) return;
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        await converseStreaming({
          sessionKey: state.sessionKey,
          confirmedFields: fields,
          message: 'I confirmed the extracted values.',
        });
      } catch (err) {
        handleError(err);
      }
    },
    [state.sessionKey, converseStreaming, handleError],
  );

  const rejectFields = useCallback(
    async (nodeIds: string[]) => {
      if (!state.sessionKey) return;
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        await converseStreaming({
          sessionKey: state.sessionKey,
          rejectedFields: nodeIds,
          message: 'I rejected some extracted values.',
        });
      } catch (err) {
        handleError(err);
      }
    },
    [state.sessionKey, converseStreaming, handleError],
  );

  const refreshDocuments = useCallback(async () => {
    if (!state.sessionKey) return;
    try {
      const docs = await api.getDocuments(state.sessionKey);
      setState((s) => ({ ...s, documents: docs }));
    } catch {
      // silent — documents are supplementary
    }
  }, [state.sessionKey]);

  const doUploadFiles = useCallback(
    async (files: File[], message?: string) => {
      if (!state.sessionKey) return;
      addUserMessage(message ?? `I uploaded ${files.length} file(s).`);
      setState((s) => ({ ...s, isLoading: true, error: null, duplicateWarnings: [] }));
      try {
        const response = await api.uploadFiles(state.sessionKey, files, message);
        // Track duplicate content warnings (soft, non-blocking)
        if (response.duplicateWarnings?.length) {
          setState((s) => ({ ...s, duplicateWarnings: response.duplicateWarnings! }));
        }
        handleResponse(response);
        // Refresh document list after upload completes
        await refreshDocuments();
      } catch (err) {
        handleError(err);
      }
    },
    [state.sessionKey, addUserMessage, handleResponse, handleError, refreshDocuments],
  );

  const doDownloadPdf = useCallback(async () => {
    if (!state.sessionKey) return;
    try {
      const blob = await api.downloadPdf(state.sessionKey);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tax-return-2025.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      handleError(err);
    }
  }, [state.sessionKey, handleError]);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  const resetSession = useCallback(() => {
    setState(createInitialState());
  }, [createInitialState]);

  const value: AgentContextValue = {
    ...state,
    startSession,
    loadSession,
    sendMessage,
    selectOption,
    reviewFields,
    confirmFields,
    rejectFields,
    uploadFiles: doUploadFiles,
    downloadPdf: doDownloadPdf,
    refreshDocuments,
    clearError,
    resetSession,
    addUserMessage,
    addAssistantBlocks,
  };

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}
