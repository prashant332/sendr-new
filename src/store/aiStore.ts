import { create } from "zustand";
import { db, AISettings, LLMProvider, AIProviderType } from "@/lib/db";

const AI_SETTINGS_ID = "ai-settings";

interface AIState {
  settings: AISettings;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  addProvider: (provider: Omit<LLMProvider, "id" | "createdAt">) => Promise<void>;
  updateProvider: (id: string, updates: Partial<LLMProvider>) => Promise<void>;
  deleteProvider: (id: string) => Promise<void>;
  setDefaultProvider: (id: string | null) => Promise<void>;
  updateSettings: (updates: Partial<Omit<AISettings, "id" | "providers">>) => Promise<void>;
  getDefaultProvider: () => LLMProvider | null;
  getProviderById: (id: string) => LLMProvider | null;
}

const defaultSettings: AISettings = {
  id: AI_SETTINGS_ID,
  providers: [],
  defaultProviderId: null,
  enableAutoSuggestions: true,
  includeResponseSample: true,
  maxTokens: 1500,
  temperature: 0.2,
};

export const useAIStore = create<AIState>((set, get) => ({
  settings: defaultSettings,
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    if (get().isInitialized) return;

    set({ isLoading: true });
    try {
      const stored = await db.aiSettings.get(AI_SETTINGS_ID);
      if (stored) {
        set({ settings: stored, isInitialized: true });
      } else {
        // Create default settings
        await db.aiSettings.put(defaultSettings);
        set({ settings: defaultSettings, isInitialized: true });
      }
    } catch (error) {
      console.error("Failed to initialize AI settings:", error);
      set({ settings: defaultSettings, isInitialized: true });
    } finally {
      set({ isLoading: false });
    }
  },

  addProvider: async (providerData) => {
    const newProvider: LLMProvider = {
      ...providerData,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };

    const { settings } = get();
    const updatedProviders = [...settings.providers, newProvider];

    // If this is the first provider, make it default
    const newDefaultId = settings.providers.length === 0 ? newProvider.id : settings.defaultProviderId;

    const updatedSettings: AISettings = {
      ...settings,
      providers: updatedProviders,
      defaultProviderId: newDefaultId,
    };

    await db.aiSettings.put(updatedSettings);
    set({ settings: updatedSettings });
  },

  updateProvider: async (id, updates) => {
    const { settings } = get();
    const updatedProviders = settings.providers.map((p) =>
      p.id === id ? { ...p, ...updates } : p
    );

    const updatedSettings: AISettings = {
      ...settings,
      providers: updatedProviders,
    };

    await db.aiSettings.put(updatedSettings);
    set({ settings: updatedSettings });
  },

  deleteProvider: async (id) => {
    const { settings } = get();
    const updatedProviders = settings.providers.filter((p) => p.id !== id);

    // If we deleted the default provider, set a new one or null
    let newDefaultId = settings.defaultProviderId;
    if (settings.defaultProviderId === id) {
      newDefaultId = updatedProviders.length > 0 ? updatedProviders[0].id : null;
    }

    const updatedSettings: AISettings = {
      ...settings,
      providers: updatedProviders,
      defaultProviderId: newDefaultId,
    };

    await db.aiSettings.put(updatedSettings);
    set({ settings: updatedSettings });
  },

  setDefaultProvider: async (id) => {
    const { settings } = get();
    const updatedSettings: AISettings = {
      ...settings,
      defaultProviderId: id,
    };

    await db.aiSettings.put(updatedSettings);
    set({ settings: updatedSettings });
  },

  updateSettings: async (updates) => {
    const { settings } = get();
    const updatedSettings: AISettings = {
      ...settings,
      ...updates,
    };

    await db.aiSettings.put(updatedSettings);
    set({ settings: updatedSettings });
  },

  getDefaultProvider: () => {
    const { settings } = get();
    if (!settings.defaultProviderId) return null;
    return settings.providers.find((p) => p.id === settings.defaultProviderId) || null;
  },

  getProviderById: (id) => {
    const { settings } = get();
    return settings.providers.find((p) => p.id === id) || null;
  },
}));

// Provider configuration helpers
export const DEFAULT_PROVIDER_CONFIG: Record<AIProviderType, { baseUrl: string; model: string }> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4-turbo",
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.0-flash",
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-3-opus-20240229",
  },
  ollama: {
    baseUrl: "http://localhost:11434",
    model: "llama3:8b",
  },
  custom: {
    baseUrl: "",
    model: "",
  },
};

export const PROVIDER_MODELS: Record<AIProviderType, string[]> = {
  openai: ["gpt-4-turbo", "gpt-4", "gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
  gemini: ["gemini-2.0-flash", "gemini-1.5-pro-latest", "gemini-1.5-flash-latest", "gemini-pro"],
  anthropic: ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"],
  ollama: ["llama3:8b", "llama3:70b", "codellama:7b", "mistral:7b", "mixtral:8x7b"],
  custom: [],
};
