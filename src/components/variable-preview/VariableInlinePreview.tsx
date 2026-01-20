"use client";

import { useMemo } from "react";
import { useVariableContextSafe } from "./VariableContextProvider";
import { findAllVariables } from "./useVariableDetection";
import { interpolate } from "@/lib/interpolate";

interface VariableInlinePreviewProps {
  value: string;
  className?: string;
  showWhenNoVariables?: boolean;
}

/**
 * Shows the resolved/interpolated value of a string containing {{variables}}
 * Highlights the resolved parts that came from variables
 */
export function VariableInlinePreview({
  value,
  className = "",
  showWhenNoVariables = false,
}: VariableInlinePreviewProps) {
  const variableContext = useVariableContextSafe();

  // Find all variables in the text
  const variables = useMemo(() => findAllVariables(value), [value]);

  // Build the resolved preview with highlighted segments
  const previewContent = useMemo(() => {
    if (!variableContext || variables.length === 0) {
      return showWhenNoVariables ? { text: value, hasVariables: false, parts: [] } : null;
    }

    const parts: Array<{
      type: "text" | "resolved" | "undefined";
      content: string;
      variableName?: string;
    }> = [];

    let lastEnd = 0;

    variables.forEach((variable) => {
      // Add text before this variable
      if (variable.start > lastEnd) {
        parts.push({
          type: "text",
          content: value.slice(lastEnd, variable.start),
        });
      }

      // Add the resolved variable value
      const rawValue = variableContext.getValue(variable.name);
      const isDefined = variableContext.isDefined(variable.name);

      if (isDefined) {
        // Recursively resolve nested variables in the value
        const resolvedValue = interpolate(rawValue ?? "", variableContext.variables);
        parts.push({
          type: "resolved",
          content: resolvedValue,
          variableName: variable.name,
        });
      } else {
        parts.push({
          type: "undefined",
          content: variable.fullMatch, // Keep original {{var}} for undefined
          variableName: variable.name,
        });
      }

      lastEnd = variable.end;
    });

    // Add remaining text
    if (lastEnd < value.length) {
      parts.push({
        type: "text",
        content: value.slice(lastEnd),
      });
    }

    // Build the full resolved text
    const resolvedText = parts.map((p) => p.content).join("");

    return {
      text: resolvedText,
      hasVariables: true,
      parts,
    };
  }, [value, variables, variableContext, showWhenNoVariables]);

  // Don't render if no variables and showWhenNoVariables is false
  if (!previewContent || (!previewContent.hasVariables && !showWhenNoVariables)) {
    return null;
  }

  // Don't render if the resolved text is the same as the original (no variables resolved)
  if (previewContent.text === value && previewContent.hasVariables) {
    // All variables are undefined, still show the preview
  }

  return (
    <div
      className={`text-xs text-zinc-500 font-mono truncate ${className}`}
      title={previewContent.text}
    >
      <span className="text-zinc-600 mr-1">→</span>
      {previewContent.parts.length > 0 ? (
        previewContent.parts.map((part, index) => {
          if (part.type === "text") {
            return <span key={index}>{part.content}</span>;
          }
          if (part.type === "resolved") {
            return (
              <span
                key={index}
                className="text-blue-400"
                title={`{{${part.variableName}}}`}
              >
                {part.content}
              </span>
            );
          }
          // undefined
          return (
            <span
              key={index}
              className="text-yellow-500"
              title={`${part.variableName} is not defined`}
            >
              {part.content}
            </span>
          );
        })
      ) : (
        <span>{previewContent.text}</span>
      )}
    </div>
  );
}
