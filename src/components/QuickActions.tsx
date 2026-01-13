"use client";

import { useEffect, useState } from "react";
import { useAIStore } from "@/store/aiStore";
import { suggestQuickActions } from "@/lib/ai";
import { QuickAction, ScriptType } from "@/lib/ai/types";

interface QuickActionsProps {
  response: unknown;
  onSelectAction: (prompt: string, scriptType: ScriptType) => void;
  scriptType: ScriptType;
}

export default function QuickActions({
  response,
  onSelectAction,
  scriptType,
}: QuickActionsProps) {
  const { settings, isInitialized, initialize } = useAIStore();
  const [actions, setActions] = useState<QuickAction[]>([]);

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  useEffect(() => {
    if (response && settings.enableAutoSuggestions) {
      const suggested = suggestQuickActions(response);
      // Filter by script type
      const filtered = suggested.filter((a) => a.scriptType === scriptType);
      setActions(filtered);
    } else {
      setActions([]);
    }
  }, [response, settings.enableAutoSuggestions, scriptType]);

  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {actions.slice(0, 4).map((action) => (
        <button
          key={action.id}
          onClick={() => onSelectAction(action.prompt, action.scriptType)}
          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
          title={action.prompt}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
