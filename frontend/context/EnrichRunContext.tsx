'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface EnrichRunState {
  isRunning: boolean;
  processed: number;
  total: number;
  arrangementId: string | null;
  runId: string | null;
}

interface EnrichRunContextType extends EnrichRunState {
  setRunState: (state: Partial<EnrichRunState>) => void;
  clearRunState: () => void;
}

const defaultState: EnrichRunState = {
  isRunning: false,
  processed: 0,
  total: 0,
  arrangementId: null,
  runId: null,
};

const EnrichRunContext = createContext<EnrichRunContextType>({
  ...defaultState,
  setRunState: () => {},
  clearRunState: () => {},
});

export function EnrichRunProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EnrichRunState>(defaultState);

  const setRunState = (updates: Partial<EnrichRunState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const clearRunState = () => {
    setState(defaultState);
  };

  return (
    <EnrichRunContext.Provider value={{ ...state, setRunState, clearRunState }}>
      {children}
    </EnrichRunContext.Provider>
  );
}

export function useEnrichRun() {
  return useContext(EnrichRunContext);
}
