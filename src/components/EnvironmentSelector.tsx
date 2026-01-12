"use client";

import { useEnvironmentStore } from "@/store/environmentStore";

interface EnvironmentSelectorProps {
  onManageClick: () => void;
}

export function EnvironmentSelector({ onManageClick }: EnvironmentSelectorProps) {
  const { environments, activeEnvironmentId, setActiveEnvironment } =
    useEnvironmentStore();

  return (
    <div className="flex items-center gap-2">
      <select
        value={activeEnvironmentId ?? ""}
        onChange={(e) => setActiveEnvironment(e.target.value || null)}
        className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm"
      >
        <option value="">No Environment</option>
        {environments.map((env) => (
          <option key={env.id} value={env.id}>
            {env.name}
          </option>
        ))}
      </select>
      <button
        onClick={onManageClick}
        className="text-sm text-zinc-400 hover:text-zinc-200 px-2 py-1"
      >
        Manage
      </button>
    </div>
  );
}
