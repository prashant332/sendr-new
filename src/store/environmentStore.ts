import { create } from "zustand";
import { db, Environment } from "@/lib/db";

export type { Environment };

interface EnvironmentState {
  environments: Environment[];
  activeEnvironmentId: string | null;
  isLoaded: boolean;
  isInitializing: boolean;

  // Initialize the store - must be called from useEffect
  initialize: () => Promise<void>;

  addEnvironment: (name: string) => Promise<void>;
  updateEnvironment: (id: string, updates: Partial<Omit<Environment, "id">>) => Promise<void>;
  deleteEnvironment: (id: string) => Promise<void>;
  setActiveEnvironment: (id: string | null) => Promise<void>;
  getActiveVariables: () => Record<string, string>;
  setVariable: (key: string, value: string) => Promise<void>;
  setVariables: (variables: Record<string, string>) => Promise<void>;
}

const SETTINGS_ID = "app-settings";

// Promise to track initialization completion
let initializationPromise: Promise<void> | null = null;

export const useEnvironmentStore = create<EnvironmentState>((set, get) => ({
  environments: [],
  activeEnvironmentId: null,
  isLoaded: false,
  isInitializing: false,

  initialize: async () => {
    const state = get();
    // If already loaded, return immediately
    if (state.isLoaded) return;

    // If initialization is in progress, wait for it
    if (state.isInitializing && initializationPromise) {
      return initializationPromise;
    }

    set({ isInitializing: true });

    initializationPromise = (async () => {
      try {
        // Ensure database is open
        await db.open();
        const environments = await db.environments.toArray();
        const settings = await db.settings.get(SETTINGS_ID);
        set({
          environments,
          activeEnvironmentId: settings?.activeEnvironmentId ?? null,
          isLoaded: true,
          isInitializing: false,
        });
      } catch (error) {
        console.error("Failed to initialize environment store:", error);
        set({ isInitializing: false, isLoaded: true });
      }
    })();

    return initializationPromise;
  },

  addEnvironment: async (name: string) => {
    // Wait for initialization to complete
    const state = get();
    if (!state.isLoaded) {
      console.log("Waiting for environment store initialization...");
      await get().initialize();
    }

    try {
      // Ensure database is open
      await db.open();

      const newEnv: Environment = {
        id: crypto.randomUUID(),
        name,
        variables: {},
      };
      await db.environments.add(newEnv);
      set((state) => ({
        environments: [...state.environments, newEnv],
      }));
      console.log("Environment added successfully:", name);
    } catch (error) {
      console.error("Failed to add environment:", error);
      throw error;
    }
  },

  updateEnvironment: async (id: string, updates: Partial<Omit<Environment, "id">>) => {
    await db.environments.update(id, updates);
    set((state) => ({
      environments: state.environments.map((env) =>
        env.id === id ? { ...env, ...updates } : env
      ),
    }));
  },

  deleteEnvironment: async (id: string) => {
    await db.environments.delete(id);
    const state = get();
    const newActiveId = state.activeEnvironmentId === id ? null : state.activeEnvironmentId;
    if (state.activeEnvironmentId === id) {
      await db.settings.put({ id: SETTINGS_ID, activeEnvironmentId: null });
    }
    set((s) => ({
      environments: s.environments.filter((env) => env.id !== id),
      activeEnvironmentId: newActiveId,
    }));
  },

  setActiveEnvironment: async (id: string | null) => {
    await db.settings.put({ id: SETTINGS_ID, activeEnvironmentId: id });
    set({ activeEnvironmentId: id });
  },

  getActiveVariables: () => {
    const state = get();
    const activeEnv = state.environments.find(
      (env) => env.id === state.activeEnvironmentId
    );
    return activeEnv?.variables ?? {};
  },

  setVariable: async (key: string, value: string) => {
    const state = get();
    if (!state.activeEnvironmentId) return;

    const activeEnv = state.environments.find(
      (env) => env.id === state.activeEnvironmentId
    );
    if (!activeEnv) return;

    const newVariables = { ...activeEnv.variables, [key]: value };
    await db.environments.update(state.activeEnvironmentId, { variables: newVariables });

    set((s) => ({
      environments: s.environments.map((env) =>
        env.id === s.activeEnvironmentId
          ? { ...env, variables: newVariables }
          : env
      ),
    }));
  },

  setVariables: async (variables: Record<string, string>) => {
    const state = get();
    if (!state.activeEnvironmentId) return;

    const activeEnv = state.environments.find(
      (env) => env.id === state.activeEnvironmentId
    );
    if (!activeEnv) return;

    const newVariables = { ...activeEnv.variables, ...variables };
    await db.environments.update(state.activeEnvironmentId, { variables: newVariables });

    set((s) => ({
      environments: s.environments.map((env) =>
        env.id === s.activeEnvironmentId
          ? { ...env, variables: newVariables }
          : env
      ),
    }));
  },
}));

// Note: Initialize must be called from a useEffect in the main component
// to ensure proper client-side initialization in all build modes
