import { create } from "zustand";

export interface Environment {
  id: string;
  name: string;
  variables: Record<string, string>;
}

interface EnvironmentState {
  environments: Environment[];
  activeEnvironmentId: string | null;

  addEnvironment: (name: string) => void;
  updateEnvironment: (id: string, updates: Partial<Omit<Environment, "id">>) => void;
  deleteEnvironment: (id: string) => void;
  setActiveEnvironment: (id: string | null) => void;
  getActiveVariables: () => Record<string, string>;
  setVariable: (key: string, value: string) => void;
  setVariables: (variables: Record<string, string>) => void;
}

export const useEnvironmentStore = create<EnvironmentState>((set, get) => ({
  environments: [],
  activeEnvironmentId: null,

  addEnvironment: (name: string) => {
    const newEnv: Environment = {
      id: crypto.randomUUID(),
      name,
      variables: {},
    };
    set((state) => ({
      environments: [...state.environments, newEnv],
    }));
  },

  updateEnvironment: (id: string, updates: Partial<Omit<Environment, "id">>) => {
    set((state) => ({
      environments: state.environments.map((env) =>
        env.id === id ? { ...env, ...updates } : env
      ),
    }));
  },

  deleteEnvironment: (id: string) => {
    set((state) => ({
      environments: state.environments.filter((env) => env.id !== id),
      activeEnvironmentId:
        state.activeEnvironmentId === id ? null : state.activeEnvironmentId,
    }));
  },

  setActiveEnvironment: (id: string | null) => {
    set({ activeEnvironmentId: id });
  },

  getActiveVariables: () => {
    const state = get();
    const activeEnv = state.environments.find(
      (env) => env.id === state.activeEnvironmentId
    );
    return activeEnv?.variables ?? {};
  },

  setVariable: (key: string, value: string) => {
    const state = get();
    if (!state.activeEnvironmentId) return;

    set((s) => ({
      environments: s.environments.map((env) =>
        env.id === s.activeEnvironmentId
          ? { ...env, variables: { ...env.variables, [key]: value } }
          : env
      ),
    }));
  },

  setVariables: (variables: Record<string, string>) => {
    const state = get();
    if (!state.activeEnvironmentId) return;

    set((s) => ({
      environments: s.environments.map((env) =>
        env.id === s.activeEnvironmentId
          ? { ...env, variables: { ...env.variables, ...variables } }
          : env
      ),
    }));
  },
}));
