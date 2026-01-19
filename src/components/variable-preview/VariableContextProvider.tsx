"use client";

import React, { createContext, useContext, useMemo, ReactNode } from "react";
import { useEnvironmentStore } from "@/store/environmentStore";

interface VariableContextValue {
  // Current variables from active environment
  variables: Record<string, string>;
  activeEnvironmentName: string | null;
  activeEnvironmentId: string | null;

  // Helper functions
  isDefined: (variableName: string) => boolean;
  getValue: (variableName: string) => string | undefined;
  getAllVariableNames: () => string[];
  getFilteredVariables: (search: string) => Array<{ name: string; value: string }>;
}

const VariableContext = createContext<VariableContextValue | null>(null);

interface VariableContextProviderProps {
  children: ReactNode;
}

export function VariableContextProvider({ children }: VariableContextProviderProps) {
  const environments = useEnvironmentStore((state) => state.environments);
  const activeEnvironmentId = useEnvironmentStore((state) => state.activeEnvironmentId);

  const contextValue = useMemo<VariableContextValue>(() => {
    const activeEnv = environments.find((env) => env.id === activeEnvironmentId);
    const variables = activeEnv?.variables ?? {};
    const activeEnvironmentName = activeEnv?.name ?? null;

    return {
      variables,
      activeEnvironmentName,
      activeEnvironmentId,

      isDefined: (variableName: string) => variableName in variables,

      getValue: (variableName: string) => variables[variableName],

      getAllVariableNames: () => Object.keys(variables),

      getFilteredVariables: (search: string) => {
        const searchLower = search.toLowerCase();
        return Object.entries(variables)
          .filter(([name]) => name.toLowerCase().includes(searchLower))
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => {
            // Prioritize names that start with the search term
            const aStarts = a.name.toLowerCase().startsWith(searchLower);
            const bStarts = b.name.toLowerCase().startsWith(searchLower);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return a.name.localeCompare(b.name);
          });
      },
    };
  }, [environments, activeEnvironmentId]);

  return (
    <VariableContext.Provider value={contextValue}>
      {children}
    </VariableContext.Provider>
  );
}

export function useVariableContext(): VariableContextValue {
  const context = useContext(VariableContext);
  if (!context) {
    throw new Error("useVariableContext must be used within a VariableContextProvider");
  }
  return context;
}

// Safe version that doesn't throw - useful for components that may render outside provider
export function useVariableContextSafe(): VariableContextValue | null {
  return useContext(VariableContext);
}
