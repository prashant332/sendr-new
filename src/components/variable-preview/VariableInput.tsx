"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  KeyboardEvent,
  ChangeEvent,
  FocusEvent,
  MouseEvent,
} from "react";
import { useVariableContextSafe } from "./VariableContextProvider";
import { VariableAutocomplete } from "./VariableAutocomplete";
import { VariableHoverPreview } from "./VariableHoverPreview";
import {
  getAutocompleteContext,
  insertVariable,
  findAllVariables,
  AutocompleteContext,
  VariableMatch,
} from "./useVariableDetection";

interface VariableInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  type?: "text" | "password";
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  onOpenEnvManager?: () => void;
}

export function VariableInput({
  value,
  onChange,
  placeholder,
  className = "",
  disabled = false,
  type = "text",
  onKeyDown: externalOnKeyDown,
  onFocus: externalOnFocus,
  onBlur: externalOnBlur,
  onOpenEnvManager,
}: VariableInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const variableContext = useVariableContextSafe();

  // Autocomplete state
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [autocompleteContext, setAutocompleteContext] = useState<AutocompleteContext>({
    isActive: false,
    searchQuery: "",
    replaceStart: 0,
    replaceEnd: 0,
  });
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const lastSearchQueryRef = useRef<string>("");

  // Hover preview state
  const [hoveredVariable, setHoveredVariable] = useState<VariableMatch | null>(null);
  const [hoverPosition, setHoverPosition] = useState({ top: 0, left: 0 });
  const [isHoverPreviewVisible, setIsHoverPreviewVisible] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get filtered variables based on search query (memoized)
  const filteredVariables = useMemo(() => {
    return variableContext
      ? variableContext.getFilteredVariables(autocompleteContext.searchQuery)
      : [];
  }, [variableContext, autocompleteContext.searchQuery]);

  // Update autocomplete context when value or cursor changes
  const updateAutocompleteContext = useCallback(() => {
    if (!inputRef.current) return;

    const pos = inputRef.current.selectionStart ?? 0;
    const context = getAutocompleteContext(value, pos);
    setAutocompleteContext(context);

    // Reset selected index when search query changes
    if (context.searchQuery !== lastSearchQueryRef.current) {
      setSelectedIndex(0);
      lastSearchQueryRef.current = context.searchQuery;
    }

    // Open autocomplete if we have a trigger
    if (context.isActive && variableContext) {
      setIsAutocompleteOpen(true);
      setSelectedIndex(0);

      // Calculate dropdown position
      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: containerRect.height + 4,
          left: 0,
        });
      }
    } else {
      setIsAutocompleteOpen(false);
    }
  }, [value, variableContext]);

  // Handle input change
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
      // Update context on next tick after value updates
      setTimeout(updateAutocompleteContext, 0);
    },
    [onChange, updateAutocompleteContext]
  );

  // Handle variable selection from autocomplete
  const handleSelectVariable = useCallback(
    (variableName: string) => {
      const result = insertVariable(value, variableName, autocompleteContext);
      onChange(result.newText);
      setIsAutocompleteOpen(false);

      // Set cursor position after insertion
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(
            result.newCursorPosition,
            result.newCursorPosition
          );
          inputRef.current.focus();
        }
      }, 0);
    },
    [value, autocompleteContext, onChange]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (isAutocompleteOpen && filteredVariables.length > 0) {
        switch (e.key) {
          case "ArrowDown":
            e.preventDefault();
            setSelectedIndex((prev) =>
              prev < filteredVariables.length - 1 ? prev + 1 : 0
            );
            return;

          case "ArrowUp":
            e.preventDefault();
            setSelectedIndex((prev) =>
              prev > 0 ? prev - 1 : filteredVariables.length - 1
            );
            return;

          case "Enter":
            e.preventDefault();
            if (filteredVariables[selectedIndex]) {
              handleSelectVariable(filteredVariables[selectedIndex].name);
            }
            return;

          case "Tab":
            e.preventDefault();
            if (filteredVariables[selectedIndex]) {
              handleSelectVariable(filteredVariables[selectedIndex].name);
            }
            return;

          case "Escape":
            e.preventDefault();
            setIsAutocompleteOpen(false);
            return;
        }
      }

      // If autocomplete is open but no items, still handle escape
      if (isAutocompleteOpen && e.key === "Escape") {
        e.preventDefault();
        setIsAutocompleteOpen(false);
        return;
      }

      // Pass through to external handler
      externalOnKeyDown?.(e);
    },
    [
      isAutocompleteOpen,
      filteredVariables,
      selectedIndex,
      handleSelectVariable,
      externalOnKeyDown,
    ]
  );

  // Handle focus
  const handleFocus = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      updateAutocompleteContext();
      externalOnFocus?.(e);
    },
    [updateAutocompleteContext, externalOnFocus]
  );

  // Handle blur
  const handleBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      // Delay close to allow click on autocomplete
      setTimeout(() => {
        setIsAutocompleteOpen(false);
      }, 150);
      externalOnBlur?.(e);
    },
    [externalOnBlur]
  );

  // Handle click to update cursor position
  const handleClick = useCallback(() => {
    updateAutocompleteContext();
  }, [updateAutocompleteContext]);

  // Handle navigation from autocomplete component
  const handleNavigate = useCallback((direction: "up" | "down") => {
    setSelectedIndex((prev) => {
      if (direction === "down") {
        return prev < filteredVariables.length - 1 ? prev + 1 : 0;
      } else {
        return prev > 0 ? prev - 1 : filteredVariables.length - 1;
      }
    });
  }, [filteredVariables.length]);

  // Find all variables in the current value
  const variables = findAllVariables(value);

  // Handle variable hover
  const handleVariableMouseEnter = useCallback(
    (variable: VariableMatch, event: MouseEvent<HTMLSpanElement>) => {
      // Clear any existing timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }

      // Capture rect immediately (event.currentTarget will be null after async)
      const rect = event.currentTarget.getBoundingClientRect();
      const position = {
        top: rect.bottom + 8,
        left: rect.left,
      };

      // Delay showing tooltip slightly to avoid flickering
      hoverTimeoutRef.current = setTimeout(() => {
        setHoveredVariable(variable);
        setHoverPosition(position);
        setIsHoverPreviewVisible(true);
      }, 200);
    },
    []
  );

  const handleVariableMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    // Delay hiding to allow moving to tooltip
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHoverPreviewVisible(false);
      setHoveredVariable(null);
    }, 300); // Increased delay to allow moving to tooltip
  }, []);

  // Called when mouse enters the tooltip - cancel the close timeout
  const handleTooltipMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  // Called when mouse leaves the tooltip - close it
  const handleHoverPreviewClose = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setIsHoverPreviewVisible(false);
    setHoveredVariable(null);
  }, []);

  const handleCopyValue = useCallback(() => {
    // Copy is handled in the tooltip component
  }, []);

  const handleEditVariable = useCallback(() => {
    setIsHoverPreviewVisible(false);
    setHoveredVariable(null);
    onOpenEnvManager?.();
  }, [onOpenEnvManager]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Render text with hoverable variable spans
  const renderOverlayContent = () => {
    if (variables.length === 0) {
      return <span className="invisible">{value || placeholder || " "}</span>;
    }

    const parts: React.ReactNode[] = [];
    let lastEnd = 0;

    variables.forEach((variable, index) => {
      // Add text before this variable
      if (variable.start > lastEnd) {
        parts.push(
          <span key={`text-${index}`} className="invisible">
            {value.slice(lastEnd, variable.start)}
          </span>
        );
      }

      // Add the variable span (visible for hover detection)
      const isDefined = variableContext?.isDefined(variable.name) ?? false;
      parts.push(
        <span
          key={`var-${index}`}
          className={`cursor-pointer rounded px-0.5 -mx-0.5 ${
            isDefined
              ? "hover:bg-blue-500/20"
              : "hover:bg-yellow-500/20"
          }`}
          onMouseEnter={(e) => handleVariableMouseEnter(variable, e)}
          onMouseLeave={handleVariableMouseLeave}
        >
          {variable.fullMatch}
        </span>
      );

      lastEnd = variable.end;
    });

    // Add remaining text
    if (lastEnd < value.length) {
      parts.push(
        <span key="text-end" className="invisible">
          {value.slice(lastEnd)}
        </span>
      );
    }

    return parts;
  };

  // Extract flex-related classes for the container, keep rest for input
  const containerClasses = className
    .split(" ")
    .filter((c) => c.startsWith("flex-") || c === "flex" || c.startsWith("w-") || c === "w-full")
    .join(" ");

  return (
    <div ref={containerRef} className={`relative ${containerClasses}`}>
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={handleClick}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full ${className}`}
        autoComplete="off"
        spellCheck={false}
      />

      {/* Overlay for hover detection - mirrors input text positioning */}
      {variables.length > 0 && type !== "password" && (
        <div
          ref={overlayRef}
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{
            // Match input padding - adjust these values to match your input styling
            padding: "0.5rem 0.75rem",
            fontSize: "0.875rem",
            lineHeight: "1.25rem",
            fontFamily: "inherit",
            whiteSpace: "nowrap",
          }}
        >
          <div className="pointer-events-auto inline">
            {renderOverlayContent()}
          </div>
        </div>
      )}

      <VariableAutocomplete
        isOpen={isAutocompleteOpen}
        items={filteredVariables}
        selectedIndex={selectedIndex}
        onSelect={handleSelectVariable}
        onClose={() => setIsAutocompleteOpen(false)}
        onNavigate={handleNavigate}
        position={dropdownPosition}
        activeEnvironmentName={variableContext?.activeEnvironmentName}
      />

      {/* Hover Preview Tooltip */}
      {isHoverPreviewVisible && hoveredVariable && (
        <VariableHoverPreview
          variableName={hoveredVariable.name}
          value={variableContext?.getValue(hoveredVariable.name)}
          isDefined={variableContext?.isDefined(hoveredVariable.name) ?? false}
          position={hoverPosition}
          onClose={handleHoverPreviewClose}
          onMouseEnter={handleTooltipMouseEnter}
          onCopyValue={handleCopyValue}
          onEditVariable={handleEditVariable}
          onCreateVariable={onOpenEnvManager}
        />
      )}
    </div>
  );
}
