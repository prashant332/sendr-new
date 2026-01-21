# Variable Interpolation Live Preview

[Back to main documentation](../CLAUDE.md)

---

## Status

**Implemented** - Core variable preview features are fully implemented.

| Feature | Status |
|---------|--------|
| VariableInput Component | Implemented |
| Autocomplete Dropdown | Implemented |
| Hover Preview | Implemented |
| Monaco Editor Integration | Implemented |
| Inline Preview | Implemented |
| Undefined Variable Warnings | Implemented |

---

## Overview

Real-time assistance when working with environment variables (`{{variable}}`) across all input fields.

**Key Features:**
1. **Autocomplete** - Suggest available variables when typing `{{`
2. **Hover Preview** - Show resolved value when hovering over `{{variable}}`
3. **Inline Hints** - Show resolved values below inputs (toggleable)
4. **Validation Indicators** - Visual feedback for undefined/empty variables
5. **Quick Actions** - Open environment manager from any input

---

## Applicable Locations

| Location | Features |
|----------|----------|
| URL Bar | Autocomplete, Hover, Inline Preview, Validation |
| Headers (Key/Value) | Autocomplete, Hover, Validation |
| Params (Key/Value) | Autocomplete, Hover, Validation |
| Body Editor (Monaco) | Autocomplete, Hover |
| Auth Fields | Autocomplete, Hover, Validation |
| Script Editors (Monaco) | Autocomplete for `pm.environment.get()` |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Variable Context Provider                        │
│  • Subscribes to environmentStore                                   │
│  • Provides: variables, activeEnvName, getVariable()                │
│  • Memoized for performance                                         │
└─────────────────────────────────────────────────────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            ▼                       ▼                       ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│   VariableInput   │   │ Monaco Integration│   │  VariableTooltip  │
│ (Enhanced Input)  │   │ (Body/Scripts)    │   │ (Hover Component) │
├───────────────────┤   ├───────────────────┤   ├───────────────────┤
│ • Detects {{      │   │ • Completion      │   │ • Position calc   │
│ • Shows dropdown  │   │   provider        │   │ • Renders preview │
│ • Inserts variable│   │ • Hover provider  │   │ • Quick actions   │
└───────────────────┘   └───────────────────┘   └───────────────────┘
```

---

## Components

### VariableInput

Enhanced input component with variable support:

```typescript
interface VariableInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onOpenEnvManager?: () => void;
}
```

**Features:**
- Detects `{{` typing and shows autocomplete dropdown
- Keyboard navigation (↑↓ to select, Enter to insert, Esc to close)
- Hover detection for variable tooltips
- Click on variable to see preview

### VariableAutocomplete

Dropdown showing available variables:

```
┌─────────────────────────────────────┐
│ 🔍 Search variables...              │
├─────────────────────────────────────┤
│ ▸ baseUrl                           │
│   https://api.example.com           │
├─────────────────────────────────────┤
│   authToken                         │
│   eyJhbGciOiJIUzI1NiIs...           │
├─────────────────────────────────────┤
│ ⚡ Active: Production               │
│ [Manage Environments]               │
└─────────────────────────────────────┘
```

**Features:**
- Fuzzy search/filter as user types
- Shows variable name and truncated value
- Indicates active environment
- Quick link to environment manager

### VariableInlinePreview

Shows resolved value below input:

```
┌─────────────────────────────────────────────────────────────────┐
│ https://{{baseUrl}}/api/{{version}}/users                       │
└─────────────────────────────────────────────────────────────────┘
  → https://api.example.com/api/v2/users
```

Toggle with the eye icon button in the request bar.

### VariableHoverPreview

Tooltip showing variable value on hover:

**Defined Variable:**
```
┌────────────────────────────────────┐
│ {{baseUrl}}                        │
├────────────────────────────────────┤
│ Value:                             │
│ https://api.example.com            │
├────────────────────────────────────┤
│ Environment: Production            │
└────────────────────────────────────┘
```

**Undefined Variable:**
```
┌────────────────────────────────────┐
│ ⚠️ {{missingVar}}                  │
├────────────────────────────────────┤
│ Variable not defined in active     │
│ environment "Production"           │
└────────────────────────────────────┘
```

---

## Monaco Editor Integration

### Completion Provider

Triggers on `{{` to show variable suggestions:

```typescript
monaco.languages.registerCompletionItemProvider('json', {
  triggerCharacters: ['{'],
  provideCompletionItems: (model, position) => {
    // Check if cursor is after {{
    // Return list of available variables
  }
});
```

### Hover Provider

Shows variable value when hovering:

```typescript
monaco.languages.registerHoverProvider('json', {
  provideHover: (model, position) => {
    // Detect if hovering over {{variable}}
    // Return hover content with resolved value
  }
});
```

### Script Editor Integration

For script editors, also provides completion for:
- `pm.environment.get("` - suggests variable names
- `pm.environment.set("` - suggests variable names

---

## Usage

### Toggle Inline Preview

Click the eye icon in the request bar to toggle inline previews:

- **Eye open** - Shows resolved values below inputs
- **Eye closed** - Hides resolved values

### Trigger Autocomplete

Type `{{` in any supported input field to see available variables.

### View Variable Value

Hover over any `{{variable}}` to see its resolved value.

### Undefined Variables

Undefined variables are indicated with visual feedback. Click to open the environment manager and create the variable.

---

## Files

| File | Purpose |
|------|---------|
| `src/components/variable-preview/index.tsx` | Main exports |
| `src/components/variable-preview/VariableContextProvider.tsx` | Context provider |
| `src/components/variable-preview/VariableInput.tsx` | Enhanced input |
| `src/components/variable-preview/VariableAutocomplete.tsx` | Dropdown component |
| `src/components/variable-preview/VariableHoverPreview.tsx` | Hover tooltip |
| `src/components/variable-preview/VariableInlinePreview.tsx` | Inline preview |
| `src/lib/monaco.ts` | Monaco variable support setup |

---

## Implementation Phases

### Phase 24: Context Provider ✅
- [x] Create VariableContextProvider
- [x] Subscribe to environment store
- [x] Memoize for performance

### Phase 25: VariableInput Component ✅
- [x] Enhanced input wrapper
- [x] Autocomplete trigger detection
- [x] Keyboard navigation

### Phase 26: Autocomplete Dropdown ✅
- [x] Variable list with values
- [x] Fuzzy search filtering
- [x] Environment indicator

### Phase 27: Monaco Integration ✅
- [x] Completion provider
- [x] Hover provider
- [x] Script editor integration

### Phase 28: Inline Preview ✅
- [x] VariableInlinePreview component
- [x] Toggle button
- [x] State persistence

### Phase 29: Validation ✅
- [x] Undefined variable warnings
- [x] Visual indicators
- [x] Quick actions
