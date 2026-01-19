"use client";

import { useRef, useCallback, useState, useMemo } from "react";

interface VariableHoverPreviewProps {
  variableName: string;
  value: string | undefined;
  isDefined: boolean;
  position: { top: number; left: number };
  onClose: () => void;
  onCopyValue: () => void;
  onEditVariable: () => void;
  onCreateVariable?: () => void;
}

export function VariableHoverPreview({
  variableName,
  value,
  isDefined,
  position,
  onClose,
  onCopyValue,
  onEditVariable,
  onCreateVariable,
}: VariableHoverPreviewProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Calculate adjusted position to avoid overflow (computed, not in effect)
  const adjustedPosition = useMemo(() => {
    // Use position directly initially, will be refined on render
    // Note: For a more precise adjustment, we'd need a layout effect,
    // but this approximation works well for most cases
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1920;
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 1080;
    const tooltipWidth = 350; // max-width estimate
    const tooltipHeight = 150; // approximate height

    let newTop = position.top;
    let newLeft = position.left;

    // Check right edge overflow
    if (newLeft + tooltipWidth > viewportWidth - 10) {
      newLeft = viewportWidth - tooltipWidth - 20;
    }

    // Check left edge overflow
    if (newLeft < 10) {
      newLeft = 10;
    }

    // Check bottom edge overflow - show above if needed
    if (newTop + tooltipHeight > viewportHeight - 10) {
      newTop = position.top - tooltipHeight - 30;
    }

    // Check top edge overflow
    if (newTop < 10) {
      newTop = 10;
    }

    return { top: newTop, left: newLeft };
  }, [position]);

  // Handle copy action
  const handleCopy = useCallback(async () => {
    if (value) {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = value;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    }
    onCopyValue();
  }, [value, onCopyValue]);

  // Truncate long values
  const truncateValue = (val: string, maxLength: number = 100): string => {
    if (val.length <= maxLength) return val;
    return val.slice(0, maxLength) + "...";
  };

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[100] bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl overflow-hidden"
      style={{
        top: adjustedPosition.top,
        left: adjustedPosition.left,
        minWidth: "200px",
        maxWidth: "350px",
      }}
      onMouseLeave={onClose}
    >
      {/* Header */}
      <div className="px-3 py-2 bg-zinc-750 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium text-blue-400">
            {"{{"}
            {variableName}
            {"}}"}
          </span>
          {!isDefined && (
            <span className="px-1.5 py-0.5 bg-yellow-600/30 text-yellow-400 text-xs rounded">
              undefined
            </span>
          )}
        </div>
      </div>

      {/* Value */}
      <div className="px-3 py-2">
        {isDefined ? (
          <div className="space-y-1">
            <div className="text-xs text-zinc-500">Current Value:</div>
            <div className="font-mono text-sm text-zinc-200 bg-zinc-900 px-2 py-1.5 rounded break-all">
              {value ? truncateValue(value) : <em className="text-zinc-500">(empty string)</em>}
            </div>
          </div>
        ) : (
          <div className="text-sm text-zinc-400">
            This variable is not defined in the current environment.
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-3 py-2 bg-zinc-750 border-t border-zinc-700 flex gap-2">
        {isDefined && value && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded transition-colors"
          >
            {copied ? (
              <>
                <CheckIcon />
                Copied!
              </>
            ) : (
              <>
                <CopyIcon />
                Copy Value
              </>
            )}
          </button>
        )}
        <button
          onClick={onEditVariable}
          className="flex items-center gap-1.5 px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded transition-colors"
        >
          <EditIcon />
          {isDefined ? "Edit" : "Manage Variables"}
        </button>
        {!isDefined && onCreateVariable && (
          <button
            onClick={onCreateVariable}
            className="flex items-center gap-1.5 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          >
            <PlusIcon />
            Create
          </button>
        )}
      </div>
    </div>
  );
}

// Simple icon components
function CopyIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
