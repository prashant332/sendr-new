"use client";

export interface KeyValuePair {
  key: string;
  value: string;
  active: boolean;
}

interface KeyValueEditorProps {
  pairs: KeyValuePair[];
  onChange: (pairs: KeyValuePair[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

export function KeyValueEditor({
  pairs,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
}: KeyValueEditorProps) {
  const updatePair = (index: number, field: keyof KeyValuePair, value: string | boolean) => {
    const updated = [...pairs];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const deletePair = (index: number) => {
    onChange(pairs.filter((_, i) => i !== index));
  };

  const addPair = () => {
    onChange([...pairs, { key: "", value: "", active: true }]);
  };

  return (
    <div className="space-y-2">
      {pairs.map((pair, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={pair.active}
            onChange={(e) => updatePair(index, "active", e.target.checked)}
            className="w-4 h-4 rounded border-zinc-600 bg-zinc-800"
          />
          <input
            type="text"
            value={pair.key}
            onChange={(e) => updatePair(index, "key", e.target.value)}
            placeholder={keyPlaceholder}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm"
          />
          <input
            type="text"
            value={pair.value}
            onChange={(e) => updatePair(index, "value", e.target.value)}
            placeholder={valuePlaceholder}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm"
          />
          <button
            onClick={() => deletePair(index)}
            className="text-zinc-500 hover:text-red-400 px-2 py-1"
          >
            ×
          </button>
        </div>
      ))}
      <button
        onClick={addPair}
        className="text-sm text-zinc-400 hover:text-zinc-200"
      >
        + Add
      </button>
    </div>
  );
}
