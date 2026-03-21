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

interface AgentState {
  sessionKey: string | null;
  phase: AgentPhase;
  progress: number;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  totalTokens: number;
  documents: DocumentMetadata[];
  duplicateWarnings: DuplicateWarning[];
}

interface AgentActions {
  startSession: (filingStatus: string, label?: string, taxYear?: string, hasDependents?: boolean) => Promise<void>;
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
    error: null,
    totalTokens: 0,
    documents: [],
    duplicateWarnings: [],
  });

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

  const startSession = useCallback(
    async (filingStatus: string, label?: string, taxYear?: string, hasDependents?: boolean) => {
      addUserMessage(label ?? filingStatus.replace(/_/g, ' '));
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const { sessionKey } = await api.createSession(filingStatus, taxYear, hasDependents);
        setState((s) => ({ ...s, sessionKey }));

        const dependentsNote = hasDependents ? ' I have dependents.' : '';
        const yearNote = taxYear && taxYear !== '2025' ? ` for tax year ${taxYear}` : '';
        const response = await api.converse({
          sessionKey,
          message: `I want to file my taxes${yearNote}. My filing status is ${label ?? filingStatus.replace(/_/g, ' ')}.${dependentsNote}`,
        });
        handleResponse(response);
      } catch (err) {
        handleError(err);
      }
    },
    [addUserMessage, handleError, handleResponse],
  );

  const sendMessage = useCallback(
    async (message: string) => {
      if (!state.sessionKey || !message.trim()) return;
      addUserMessage(message);
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const response = await api.converse({ sessionKey: state.sessionKey, message });
        handleResponse(response);
      } catch (err) {
        handleError(err);
      }
    },
    [state.sessionKey, addUserMessage, handleResponse, handleError],
  );

  const selectOption = useCallback(
    async (option: QuickReplyOption) => {
      if (!state.sessionKey) return;
      addUserMessage(option.label);
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const response = await api.converse({
          sessionKey: state.sessionKey,
          selectedOption: option.value,
        });
        handleResponse(response);
      } catch (err) {
        handleError(err);
      }
    },
    [state.sessionKey, addUserMessage, handleResponse, handleError],
  );

  const reviewFields = useCallback(
    async (confirmedFields: ConfirmedFieldValue[], rejectedFields: string[]) => {
      if (!state.sessionKey) return;
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const response = await api.converse({
          sessionKey: state.sessionKey,
          confirmedFields,
          rejectedFields,
          message: 'I reviewed the extracted values.',
        });
        handleResponse(response);
      } catch (err) {
        handleError(err);
      }
    },
    [state.sessionKey, handleResponse, handleError],
  );

  const confirmFields = useCallback(
    async (fields: ConfirmedFieldValue[]) => {
      if (!state.sessionKey) return;
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const response = await api.converse({
          sessionKey: state.sessionKey,
          confirmedFields: fields,
          message: 'I confirmed the extracted values.',
        });
        handleResponse(response);
      } catch (err) {
        handleError(err);
      }
    },
    [state.sessionKey, handleResponse, handleError],
  );

  const rejectFields = useCallback(
    async (nodeIds: string[]) => {
      if (!state.sessionKey) return;
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const response = await api.converse({
          sessionKey: state.sessionKey,
          rejectedFields: nodeIds,
          message: 'I rejected some extracted values.',
        });
        handleResponse(response);
      } catch (err) {
        handleError(err);
      }
    },
    [state.sessionKey, handleResponse, handleError],
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
    setState({
      sessionKey: null,
      phase: 'intake',
      progress: 0,
      messages: [],
      isLoading: false,
      error: null,
      totalTokens: 0,
      documents: [],
      duplicateWarnings: [],
    });
  }, []);

  const value: AgentContextValue = {
    ...state,
    startSession,
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
  };

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}
