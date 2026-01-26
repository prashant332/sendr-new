import { create } from "zustand";
import { db, Environment } from "@/lib/db";
import { generateUUID } from "@/lib/uuid";

export type { Environment };

interface EnvironmentState {
  environments: Environment[];
  activeEnvironmentId: string | null;
  showInlinePreview: boolean;
  isLoaded: boolean;
  isInitializing: boolean;

  // Initialize the store - must be called from useEffect
  initialize: () => Promise<void>;

  // Refresh environments from database (call after import)
  refreshEnvironments: () => Promise<void>;

  addEnvironment: (name: string) => Promise<void>;
  updateEnvironment: (id: string, updates: Partial<Omit<Environment, "id">>) => Promise<void>;
  deleteEnvironment: (id: string) => Promise<void>;
  setActiveEnvironment: (id: string | null) => Promise<void>;
  getActiveVariables: () => Record<string, string>;
  setVariable: (key: string, value: string) => Promise<void>;
  setVariables: (variables: Record<string, string>) => Promise<void>;
  setShowInlinePreview: (show: boolean) => Promise<void>;
}

const SETTINGS_ID = "app-settings";

// Helper to ensure database is ready with retry logic
async function ensureDbReady(maxRetries = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!db.isOpen()) {
        await db.open();
      }
      // Verify db is truly ready by doing a simple operation
      await db.environments.count();
      return;
    } catch (error) {
      console.warn(`Database open attempt ${attempt}/${maxRetries} failed:`, error);
      if (attempt === maxRetries) {
        throw new Error(`Failed to open database after ${maxRetries} attempts: ${error instanceof Error ? error.message : String(error)}`);
      }
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 100 * attempt));
    }
  }
}

// Store-level initialization tracking (more robust than module-level)
const initState = {
  promise: null as Promise<void> | null,
  initialized: false,
};

export const useEnvironmentStore = create<EnvironmentState>((set, get) => ({
  environments: [],
  activeEnvironmentId: null,
  showInlinePreview: true, // Default to showing inline preview
  isLoaded: false,
  isInitializing: false,

  initialize: async () => {
    // If already fully initialized, return immediately
    if (initState.initialized && get().isLoaded) {
      return;
    }

    // If initialization is in progress, wait for it
    if (initState.promise) {
      return initState.promise;
    }

    set({ isInitializing: true });

    initState.promise = (async () => {
      try {
        // Ensure database is ready with retry logic
        await ensureDbReady();

        const environments = await db.environments.toArray();
        const settings = await db.settings.get(SETTINGS_ID);

        set({
          environments,
          activeEnvironmentId: settings?.activeEnvironmentId ?? null,
          showInlinePreview: settings?.showInlinePreview ?? true,
          isLoaded: true,
          isInitializing: false,
        });

        initState.initialized = true;
      } catch (error) {
        console.error("Failed to initialize environment store:", error);
        set({ isInitializing: false });
        initState.promise = null; // Allow retry
        throw error; // Propagate error so caller can handle it
      }
    })();

    return initState.promise;
  },

  refreshEnvironments: async () => {
    try {
      await ensureDbReady();
      const environments = await db.environments.toArray();
      set({ environments });
    } catch (error) {
      console.error("Failed to refresh environments:", error);
      throw error;
    }
  },

  addEnvironment: async (name: string) => {
    // Ensure initialization is complete
    if (!get().isLoaded) {
      await get().initialize();
    }

    // Double-check we're loaded now
    if (!get().isLoaded) {
      throw new Error("Environment store failed to initialize");
    }

    try {
      // Ensure database is ready
      await ensureDbReady();

      const newEnv: Environment = {
        id: generateUUID(),
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
    await ensureDbReady();
    await db.environments.update(id, updates);
    set((state) => ({
      environments: state.environments.map((env) =>
        env.id === id ? { ...env, ...updates } : env
      ),
    }));
  },

  deleteEnvironment: async (id: string) => {
    await ensureDbReady();
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
    await ensureDbReady();
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

    await ensureDbReady();
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

    await ensureDbReady();
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

  setShowInlinePreview: async (show: boolean) => {
    await ensureDbReady();
    const state = get();
    await db.settings.put({
      id: SETTINGS_ID,
      activeEnvironmentId: state.activeEnvironmentId,
      showInlinePreview: show,
    });
    set({ showInlinePreview: show });
  },
}));

// Note: Initialize must be called from a useEffect in the main component
// to ensure proper client-side initialization in all build modes
