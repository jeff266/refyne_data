'use client';

/**
 * Normalization Settings Context - Phase 9
 *
 * React context for managing normalization settings with Supabase persistence.
 * Falls back to localStorage when Supabase is not configured.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import type { NormalizationMode, PipelineRow } from '../db/types';
import {
  getSettings,
  setMode as setModeDb,
  getPipelines,
  getDefaultPipeline,
  createPipeline,
  updatePipeline,
  deletePipeline,
  setDefaultPipeline,
  isSupabaseConfigured,
} from '../db';

// Default org ID for development/demo
const DEFAULT_ORG_ID = 'demo-org';

/**
 * Context value interface with settings and operations.
 */
interface NormalizationContextValue {
  /** Current org ID */
  orgId: string;
  /** Current normalization mode */
  mode: NormalizationMode;
  /** Whether settings are still loading */
  isLoading: boolean;
  /** Whether Supabase is configured */
  isSupabaseEnabled: boolean;

  // Mode operations
  setMode: (mode: NormalizationMode) => Promise<void>;

  // Pipeline operations
  pipelines: PipelineRow[];
  defaultPipeline: PipelineRow | null;
  loadPipelines: () => Promise<void>;
  createNewPipeline: (name: string, harmonyIds: string[]) => Promise<PipelineRow | null>;
  updateExistingPipeline: (id: string, harmonyIds: string[]) => Promise<boolean>;
  deleteExistingPipeline: (id: string) => Promise<boolean>;
  setAsDefaultPipeline: (id: string) => Promise<boolean>;
}

const NormalizationContext = createContext<NormalizationContextValue | null>(null);

// LocalStorage fallback key
const LOCAL_STORAGE_KEY = 'enrichment-switcher:normalization-settings';

/**
 * Provider component for normalization settings.
 */
export function NormalizationProvider({ children }: { children: React.ReactNode }) {
  const [orgId] = useState(DEFAULT_ORG_ID);
  const [mode, setModeState] = useState<NormalizationMode>('explicit');
  const [isLoading, setIsLoading] = useState(true);
  const [pipelines, setPipelines] = useState<PipelineRow[]>([]);
  const [defaultPipeline, setDefaultPipelineState] = useState<PipelineRow | null>(null);

  const isSupabaseEnabled = isSupabaseConfigured();

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        if (isSupabaseEnabled) {
          const settings = await getSettings(orgId);
          setModeState(settings.mode);
        } else {
          // Fallback to localStorage
          const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            setModeState(parsed.mode || 'explicit');
          }
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [orgId, isSupabaseEnabled]);

  // Load pipelines
  const loadPipelines = useCallback(async () => {
    try {
      const [allPipelines, defaultPipe] = await Promise.all([
        getPipelines(orgId),
        getDefaultPipeline(orgId),
      ]);
      setPipelines(allPipelines);
      setDefaultPipelineState(defaultPipe);
    } catch (err) {
      console.error('Failed to load pipelines:', err);
    }
  }, [orgId]);

  useEffect(() => {
    loadPipelines();
  }, [loadPipelines]);

  // Set mode
  const setMode = useCallback(async (newMode: NormalizationMode) => {
    setModeState(newMode);

    if (isSupabaseEnabled) {
      await setModeDb(orgId, newMode);
    } else {
      // Fallback to localStorage
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      const current = stored ? JSON.parse(stored) : {};
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...current, mode: newMode }));
    }
  }, [orgId, isSupabaseEnabled]);

  // Pipeline operations
  const createNewPipeline = useCallback(async (name: string, harmonyIds: string[]) => {
    const pipeline = await createPipeline({
      org_id: orgId,
      name,
      harmony_ids: harmonyIds,
      is_default: pipelines.length === 0,
    });
    if (pipeline) {
      await loadPipelines();
    }
    return pipeline;
  }, [orgId, pipelines.length, loadPipelines]);

  const updateExistingPipeline = useCallback(async (id: string, harmonyIds: string[]) => {
    const success = await updatePipeline(id, { harmony_ids: harmonyIds });
    if (success) {
      await loadPipelines();
    }
    return success;
  }, [loadPipelines]);

  const deleteExistingPipeline = useCallback(async (id: string) => {
    const success = await deletePipeline(id);
    if (success) {
      await loadPipelines();
    }
    return success;
  }, [loadPipelines]);

  const setAsDefaultPipeline = useCallback(async (id: string) => {
    const success = await setDefaultPipeline(id);
    if (success) {
      await loadPipelines();
    }
    return success;
  }, [loadPipelines]);

  const contextValue = useMemo<NormalizationContextValue>(() => ({
    orgId,
    mode,
    isLoading,
    isSupabaseEnabled,
    setMode,
    pipelines,
    defaultPipeline,
    loadPipelines,
    createNewPipeline,
    updateExistingPipeline,
    deleteExistingPipeline,
    setAsDefaultPipeline,
  }), [
    orgId,
    mode,
    isLoading,
    isSupabaseEnabled,
    setMode,
    pipelines,
    defaultPipeline,
    loadPipelines,
    createNewPipeline,
    updateExistingPipeline,
    deleteExistingPipeline,
    setAsDefaultPipeline,
  ]);

  return (
    <NormalizationContext.Provider value={contextValue}>
      {children}
    </NormalizationContext.Provider>
  );
}

/**
 * Hook to access normalization settings.
 */
export function useNormalizationSettings(): NormalizationContextValue {
  const context = useContext(NormalizationContext);
  if (!context) {
    throw new Error('useNormalizationSettings must be used within NormalizationProvider');
  }
  return context;
}

/**
 * Standalone function to get current mode (for non-React code).
 */
export function getNormalizationMode(): NormalizationMode {
  if (typeof window === 'undefined') {
    return 'explicit';
  }
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored).mode || 'explicit';
    }
  } catch {
    // Ignore
  }
  return 'explicit';
}
