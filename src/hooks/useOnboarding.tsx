'use client';

/**
 * paisatax-web-user/src/hooks/useOnboarding.tsx
 *
 * In-chat onboarding state machine. Injects synthetic assistant messages
 * into the chat so the user feels like they're talking to the AI from the start.
 * No LLM tokens are spent until the user completes (or skips) onboarding.
 */

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAgent } from '@/context/AgentContext';
import { useAuth } from '@/context/AuthContext';
import {
  fetchAccountProfile,
  fetchUserSkills,
  listUserFiles,
  updateAccountProfile,
} from '@/lib/files-api';
import type { AgentMessageBlock, DocumentMetadata } from '@/lib/types';
import {
  FILING_STATUSES,
  extractProfilesFromSkills,
  extractFilingStatusFromSkills,
  extractDependentsFromSkills,
  userRecordToIdentity,
  statusHasSpouse,
} from '@/lib/onboarding-constants';

// ─── Types ──────────────────────────────────────────────────────────────────

export type OnboardingStep =
  | 'idle'
  | 'loading'
  | 'step_basics'
  | 'step_files'
  | 'step_profiles'
  | 'step_identity'
  | 'completing'
  | 'done';

interface OnboardingState {
  step: OnboardingStep;
  isReturningUser: boolean;
  // Collected data
  taxYear: string;
  filingStatus: string;
  filingStatusLabel: string;
  hasDependents: boolean | null;
  selectedProfiles: string[];
  identity: Record<string, string>;
  spouse: Record<string, string>;
  dependents: Array<Record<string, string>>;
  // Pre-loaded data
  userFiles: DocumentMetadata[];
  selectedFileIds: Set<string>;
}

interface OnboardingActions {
  startOnboarding: () => void;
  handleBasicsComplete: (year: string, status: string, statusLabel: string, deps: boolean) => void;
  handleFilesComplete: (selectedIds: Set<string>) => void;
  handleProfilesComplete: (profiles: string[]) => void;
  handleIdentityComplete: (
    identity: Record<string, string>,
    spouse: Record<string, string>,
    dependents: Array<Record<string, string>>,
  ) => void;
  skipOnboarding: (message?: string) => void;
  resetOnboarding: () => void;
}

type OnboardingContextValue = OnboardingState & OnboardingActions & { isOnboarding: boolean };

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}

// ─── Provider ───────────────────────────────────────────────────────────────

const INITIAL_STATE: OnboardingState = {
  step: 'idle',
  isReturningUser: false,
  taxYear: '2025',
  filingStatus: '',
  filingStatusLabel: '',
  hasDependents: null,
  selectedProfiles: [],
  identity: {},
  spouse: {},
  dependents: [],
  userFiles: [],
  selectedFileIds: new Set(),
};

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>(INITIAL_STATE);
  const { user, idToken } = useAuth();
  const { addAssistantBlocks, addUserMessage, startSession } = useAgent();

  // Prevent double-start
  const startingRef = useRef(false);

  const isOnboarding = state.step !== 'idle' && state.step !== 'done';

  // ─── startOnboarding ────────────────────────────────────────────────

  const startOnboarding = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;

    setState((s) => ({ ...s, step: 'loading' }));

    let isReturning = false;
    let prefilledIdentity: Record<string, string> = {};
    let prefilledSpouse: Record<string, string> = {};
    let prefilledDependents: Array<Record<string, string>> = [];
    let preFilingStatus = '';
    let preDependents: boolean | null = null;
    let preProfiles = new Set<string>();
    let files: DocumentMetadata[] = [];

    try {
      const userId = user?.userId;
      if (userId) {
        const [profileRecord, skills, userFiles] = await Promise.all([
          fetchAccountProfile(userId, idToken).catch(() => null),
          fetchUserSkills(userId, idToken).catch(() => []),
          listUserFiles(userId, idToken).catch(() => []),
        ]);

        files = userFiles;

        const hasProfile = profileRecord && Object.keys(profileRecord).length > 0;
        const hasSkills = skills.length > 0;

        if (hasProfile || hasSkills) isReturning = true;

        if (hasProfile) {
          prefilledIdentity = userRecordToIdentity(profileRecord);
          if (profileRecord.filingStatus) preFilingStatus = profileRecord.filingStatus;
          if (profileRecord.hasDependents != null) preDependents = Boolean(profileRecord.hasDependents);
          if (profileRecord.spouse) {
            prefilledSpouse = userRecordToIdentity(profileRecord.spouse);
          }
          if (Array.isArray(profileRecord.dependents)) {
            prefilledDependents = profileRecord.dependents.map((d: Record<string, any>) => ({
              firstName: d.firstName ?? '',
              lastName: d.lastName ?? '',
              ssn: d.ssn ?? '',
              birthday: d.birthday ?? '',
              relationship: d.relationship ?? '',
            }));
          }
        }

        if (hasSkills) {
          preProfiles = extractProfilesFromSkills(skills);
          const skillStatus = extractFilingStatusFromSkills(skills);
          if (skillStatus && !preFilingStatus) preFilingStatus = skillStatus;
          const skillDeps = extractDependentsFromSkills(skills);
          if (skillDeps !== null && preDependents === null) preDependents = skillDeps;
        }
      }
    } catch {
      // Non-fatal
    }

    const firstName = prefilledIdentity.firstName;
    const greeting = isReturning && firstName
      ? `Welcome back, ${firstName}! Let's set up your 2025 return.`
      : "Let's get started with your tax return.";

    setState({
      step: 'step_basics',
      isReturningUser: isReturning,
      taxYear: '2025',
      filingStatus: preFilingStatus,
      filingStatusLabel: FILING_STATUSES.find((s) => s.value === preFilingStatus)?.label ?? '',
      hasDependents: preDependents,
      selectedProfiles: Array.from(preProfiles),
      identity: prefilledIdentity,
      spouse: prefilledSpouse,
      dependents: prefilledDependents,
      userFiles: files,
      selectedFileIds: new Set(files.map((f) => f.fileId)), // all selected by default
    });

    const basicsBlock: AgentMessageBlock = {
      type: 'onboarding_basics',
      isReturning: isReturning,
      prefilled: { year: '2025', status: preFilingStatus, dependents: preDependents },
    };

    addAssistantBlocks([{ type: 'text', content: greeting }, basicsBlock]);
    startingRef.current = false;
  }, [user?.userId, idToken, addAssistantBlocks]);

  // ─── handleBasicsComplete ───────────────────────────────────────────

  const handleBasicsComplete = useCallback(
    async (year: string, status: string, statusLabel: string, deps: boolean) => {
      setState((s) => ({
        ...s,
        step: 'step_files',
        taxYear: year,
        filingStatus: status,
        filingStatusLabel: statusLabel,
        hasDependents: deps,
      }));

      // Save basics to DB
      const userId = user?.userId;
      if (userId) {
        updateAccountProfile(userId, { filingStatus: status, hasDependents: deps }, idToken).catch(() => {});
      }

      // Small delay so user message renders first
      await new Promise((r) => setTimeout(r, 150));

      // Read state to get files
      const currentState = await new Promise<OnboardingState>((resolve) => {
        setState((s) => { resolve(s); return s; });
      });

      // If no files, skip directly to profiles
      if (currentState.userFiles.length === 0) {
        setState((s) => ({ ...s, step: 'step_profiles' }));

        const profilesBlock: AgentMessageBlock = {
          type: 'onboarding_profiles',
          isReturning: currentState.isReturningUser,
          preselected: currentState.selectedProfiles,
        };

        addAssistantBlocks([
          { type: 'text', content: currentState.isReturningUser ? 'Has your income situation changed?' : 'What applies to your tax situation?' },
          profilesBlock,
        ]);
      } else {
        // Show file selection step
        const filesBlock: AgentMessageBlock = {
          type: 'onboarding_files',
          files: currentState.userFiles.map((f) => ({
            fileId: f.fileId,
            displayName: f.displayName ?? f.originalName,
            formId: f.formId,
          })),
        };

        addAssistantBlocks([
          { type: 'text', content: `You have ${currentState.userFiles.length} document${currentState.userFiles.length === 1 ? '' : 's'} uploaded. Which ones should I use for this return?` },
          filesBlock,
        ]);
      }
    },
    [addAssistantBlocks, user?.userId, idToken],
  );

  // ─── handleFilesComplete ──────────────────────────────────────────

  const handleFilesComplete = useCallback(
    async (selectedIds: Set<string>) => {
      const count = selectedIds.size;
      addUserMessage(count > 0 ? `Use ${count} document${count === 1 ? '' : 's'}` : 'Skip documents');

      setState((s) => ({
        ...s,
        step: 'step_profiles',
        selectedFileIds: selectedIds,
      }));

      await new Promise((r) => setTimeout(r, 150));

      const currentState = await new Promise<OnboardingState>((resolve) => {
        setState((s) => { resolve(s); return s; });
      });

      const profilesBlock: AgentMessageBlock = {
        type: 'onboarding_profiles',
        isReturning: currentState.isReturningUser,
        preselected: currentState.selectedProfiles,
      };

      addAssistantBlocks([
        { type: 'text', content: currentState.isReturningUser ? 'Has your income situation changed?' : 'What applies to your tax situation?' },
        profilesBlock,
      ]);
    },
    [addUserMessage, addAssistantBlocks],
  );

  // ─── handleProfilesComplete ─────────────────────────────────────────

  const handleProfilesComplete = useCallback(
    async (profiles: string[]) => {
      const labels = profiles.length > 0 ? profiles.join(', ') : 'No specific profiles';
      addUserMessage(labels);

      setState((s) => ({ ...s, step: 'step_identity', selectedProfiles: profiles }));

      await new Promise((r) => setTimeout(r, 150));

      const currentState = await new Promise<OnboardingState>((resolve) => {
        setState((s) => { resolve(s); return s; });
      });

      const identityBlock: AgentMessageBlock = {
        type: 'onboarding_identity',
        isReturning: currentState.isReturningUser,
        showSpouse: statusHasSpouse(currentState.filingStatus),
        showDependents: currentState.hasDependents === true,
        prefilled: {
          primary: currentState.identity,
          spouse: currentState.spouse,
          dependents: currentState.dependents,
        },
      };

      const text = currentState.isReturningUser
        ? "Here's your information on file. Everything look right?"
        : "Last step — tell me about yourself so I can fill out your forms.";

      addAssistantBlocks([{ type: 'text', content: text }, identityBlock]);
    },
    [addUserMessage, addAssistantBlocks],
  );

  // ─── handleIdentityComplete ─────────────────────────────────────────

  const handleIdentityComplete = useCallback(
    async (
      identity: Record<string, string>,
      spouse: Record<string, string>,
      dependents: Array<Record<string, string>>,
    ) => {
      const name = identity.firstName
        ? `${identity.firstName}${identity.lastName ? ' ' + identity.lastName : ''}`
        : 'Info confirmed';
      addUserMessage(name);

      setState((s) => ({
        ...s,
        step: 'completing',
        identity,
        spouse,
        dependents,
      }));

      // Save to DB
      const userId = user?.userId;
      if (userId) {
        const profileData: Record<string, unknown> = { ...identity };
        if (Object.values(spouse).some((v) => v)) {
          profileData.spouse = spouse;
        }
        if (dependents.length > 0) {
          profileData.dependents = dependents;
        }
        updateAccountProfile(userId, profileData, idToken).catch(() => {});
      }

      await new Promise((r) => setTimeout(r, 150));
      addAssistantBlocks([{ type: 'text', content: 'Setting up your return...' }]);

      // Read final state and create session
      const finalState = await new Promise<OnboardingState>((resolve) => {
        setState((s) => { resolve(s); return s; });
      });

      await createAndStartSession(finalState, identity, spouse, dependents);
    },
    [addUserMessage, addAssistantBlocks, user?.userId, idToken],
  );

  // ─── skipOnboarding ─────────────────────────────────────────────────

  const skipOnboarding = useCallback(
    async (message?: string) => {
      setState((s) => ({ ...s, step: 'completing' }));

      const currentState = await new Promise<OnboardingState>((resolve) => {
        setState((s) => { resolve(s); return s; });
      });

      const filingStatus = currentState.filingStatus || 'single';
      const label = FILING_STATUSES.find((s) => s.value === filingStatus)?.label ?? 'Single';

      await startSession(
        filingStatus,
        message ?? label,
        currentState.taxYear || '2025',
        currentState.hasDependents === true,
      );

      setState((s) => ({ ...s, step: 'done' }));
    },
    [startSession],
  );

  // ─── resetOnboarding ────────────────────────────────────────────────

  const resetOnboarding = useCallback(() => {
    setState(INITIAL_STATE);
    startingRef.current = false;
  }, []);

  // ─── createAndStartSession (internal) ───────────────────────────────

  const createAndStartSession = useCallback(
    async (
      finalState: OnboardingState,
      identity: Record<string, string>,
      spouse: Record<string, string>,
      dependents: Array<Record<string, string>>,
    ) => {
      const filingStatus = finalState.filingStatus || 'single';
      const label = FILING_STATUSES.find((s) => s.value === filingStatus)?.label ?? 'Single';

      const prefill: { profiles?: string[]; identity?: Record<string, string>; documentFormIds?: string[] } = {};

      if (finalState.selectedProfiles.length > 0) {
        prefill.profiles = finalState.selectedProfiles;
      }

      // Build identity payload with ALL fields
      const identityPayload: Record<string, string> = {};
      for (const [k, v] of Object.entries(identity)) {
        if (v) {
          const apiKey = k === 'birthday' ? 'dob' : k === 'phoneNumber' ? 'phone' : k;
          identityPayload[apiKey] = v;
        }
      }
      // Add spouse fields with spouse_ prefix
      for (const [k, v] of Object.entries(spouse)) {
        if (v) {
          const apiKey = k === 'birthday' ? 'dob' : k === 'phoneNumber' ? 'phone' : k;
          identityPayload[`spouse_${apiKey}`] = v;
        }
      }

      if (Object.keys(identityPayload).length > 0) {
        prefill.identity = identityPayload;
      }

      // Pass uploaded document form IDs so profiles only enable matching forms
      // (e.g., investor profile won't create 1099-B slots if no 1099-B was uploaded)
      const selectedFiles = finalState.userFiles.filter((f) => finalState.selectedFileIds.has(f.fileId));
      const docFormIds = selectedFiles
        .map((f) => f.formId)
        .filter((id): id is string => id != null);
      if (docFormIds.length > 0) {
        prefill.documentFormIds = docFormIds;
      }

      const hasPrefill = Object.keys(prefill).length > 0 ? prefill : undefined;
      let sessionLabel: string = label;
      if (selectedFiles.length > 0) {
        const fileNames = selectedFiles.map((f) => f.displayName ?? f.originalName).join(', ');
        sessionLabel = `${label}. I have ${selectedFiles.length} document${selectedFiles.length === 1 ? '' : 's'} to use: ${fileNames}`;
      }

      await startSession(
        filingStatus,
        sessionLabel,
        finalState.taxYear || '2025',
        finalState.hasDependents === true,
        hasPrefill,
      );

      setState((s) => ({ ...s, step: 'done' }));
    },
    [startSession],
  );

  const value: OnboardingContextValue = {
    ...state,
    isOnboarding,
    startOnboarding,
    handleBasicsComplete,
    handleFilesComplete,
    handleProfilesComplete,
    handleIdentityComplete,
    skipOnboarding,
    resetOnboarding,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}
