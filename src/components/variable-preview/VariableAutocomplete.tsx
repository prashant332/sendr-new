"use client";

import { useEffect, useRef, useCallback } from "react";

interface VariableItem {
  name: string;
  value: string;
}

interface VariableAutocompleteProps {
  isOpen: boolean;
  items: VariableItem[];
  selectedIndex: number;
  onSelect: (variableName: string) => void;
  onClose: () => void;
  onNavigate: (direction: "up" | "down") => void;
  position: { top: number; left: number };
  maxHeight?: number;
  activeEnvironmentName?: string | null;
}

export function VariableAutocomplete({
  isOpen,
  items,
  selectedIndex,
  onSelect,
  onClose,
  onNavigate,
  position,
  maxHeight = 250,
  activeEnvironmentName,
}: VariableAutocompleteProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedItemRef.current && listRef.current) {
      selectedItemRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay adding listener to avoid immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const truncateValue = useCallback((value: string, maxLength: number = 40) => {
    if (value.length <= maxLength) return value;
    return value.slice(0, maxLength) + "...";
  }, []);

  if (!isOpen) return null;

  return (
    <div
      ref={listRef}
      className="absolute z-50 bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl overflow-hidden"
      style={{
        top: position.top,
        left: position.left,
        minWidth: "280px",
        maxWidth: "400px",
      }}
    >
      {/* Header */}
      <div className="px-3 py-2 bg-zinc-750 border-b border-zinc-700 text-xs text-zinc-400">
        {items.length > 0 ? (
          <span>Variables ({items.length})</span>
        ) : (
          <span>No matching variables</span>
        )}
      </div>

      {/* List */}
      <div
        className="overflow-y-auto"
        style={{ maxHeight: maxHeight - 70 }}
      >
        {items.length === 0 ? (
          <div className="px-3 py-4 text-sm text-zinc-500 text-center">
            No variables found.
            <br />
            <span className="text-xs">
              Create variables in the Environment Manager.
            </span>
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={item.name}
              ref={index === selectedIndex ? selectedItemRef : null}
              className={`px-3 py-2 cursor-pointer transition-colors ${
                index === selectedIndex
                  ? "bg-blue-600 text-white"
                  : "hover:bg-zinc-700 text-zinc-200"
              }`}
              onClick={() => onSelect(item.name)}
              onMouseEnter={() => {
                // Could optionally update selectedIndex on hover
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-medium">
                  {item.name}
                </span>
                {index === selectedIndex && (
                  <span className="text-xs opacity-70">Enter to select</span>
                )}
              </div>
              <div
                className={`text-xs mt-0.5 font-mono truncate ${
                  index === selectedIndex ? "text-blue-100" : "text-zinc-400"
                }`}
              >
                {item.value ? truncateValue(item.value) : <em>(empty)</em>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 bg-zinc-750 border-t border-zinc-700 flex items-center justify-between text-xs text-zinc-500">
        <span>
          {activeEnvironmentName ? (
            <>
              <span className="text-green-400">●</span> {activeEnvironmentName}
            </>
          ) : (
            <span className="text-yellow-400">● No environment selected</span>
          )}
        </span>
        <span className="flex gap-2">
          <kbd className="px-1 bg-zinc-700 rounded">↑↓</kbd>
          <kbd className="px-1 bg-zinc-700 rounded">Enter</kbd>
          <kbd className="px-1 bg-zinc-700 rounded">Esc</kbd>
        </span>
      </div>
    </div>
  );
}
