"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  KeyboardEvent,
  ChangeEvent,
  FocusEvent,
} from "react";
import { useVariableContextSafe } from "./VariableContextProvider";
import { VariableAutocomplete } from "./VariableAutocomplete";
import {
  getAutocompleteContext,
  insertVariable,
  AutocompleteContext,
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
}: VariableInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const variableContext = useVariableContextSafe();

  // Autocomplete state
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [autocompleteContext, setAutocompleteContext] = useState<AutocompleteContext>({
    isActive: false,
    searchQuery: "",
    replaceStart: 0,
    replaceEnd: 0,
  });
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // Get filtered variables based on search query
  const filteredVariables = variableContext
    ? variableContext.getFilteredVariables(autocompleteContext.searchQuery)
    : [];

  // Update autocomplete context when value or cursor changes
  const updateAutocompleteContext = useCallback(() => {
    if (!inputRef.current) return;

    const pos = inputRef.current.selectionStart ?? 0;
    setCursorPosition(pos);

    const context = getAutocompleteContext(value, pos);
    setAutocompleteContext(context);

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

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [autocompleteContext.searchQuery]);

  return (
    <div ref={containerRef} className="relative">
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
        className={className}
        autoComplete="off"
        spellCheck={false}
      />

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
    </div>
  );
}
