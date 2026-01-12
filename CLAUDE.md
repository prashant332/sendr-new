# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sendr is a browser-based API testing tool (similar to Postman) that uses a "Passthrough Proxy" architecture to bypass CORS restrictions. The client handles UI and scripting, while a Node.js server acts as the HTTP agent for making actual API calls.

## Tech Stack

- **Frontend:** Next.js (App Router), React, TypeScript
- **Styling:** Tailwind CSS
- **State Management:** Zustand
- **Code Editor:** @monaco-editor/react
- **HTTP Client:** axios (server-side)

## Development Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Architecture

### Passthrough Proxy Pattern
All API requests from the browser go through `/api/proxy` on the backend. The frontend never makes direct `fetch` calls to target APIs. The proxy:
1. Receives resolved request details (method, url, headers, body)
2. Strips browser-restricted headers (Host, Origin, Referer)
3. Executes the HTTP call server-side with axios
4. Returns the response with timing and size metadata

### Scripting Sandbox
User scripts (pre-request and test scripts) run in a sandboxed Function constructor. The `pm` object API mimics Postman:
- `pm.environment.get(key)` / `pm.environment.set(key, value)`
- `pm.response.json()` (test scripts only)
- `pm.test(testName, callback)`

### Variable Interpolation
Variables use `{{variable_name}}` syntax and are resolved from the active Environment before sending requests. Interpolation applies to URL, headers, params, and body.

## Key Files

- `src/app/api/proxy/route.ts` - Proxy API endpoint
- `src/app/page.tsx` - Main UI component
- `src/store/environmentStore.ts` - Zustand store for environments
- `src/lib/interpolate.ts` - Variable interpolation utility
- `src/lib/scriptRunner.ts` - Script execution with pm API
- `src/components/` - Reusable UI components

## Core Data Models

See `PRODUCT.MD` for TypeScript interfaces: `Environment`, `ApiRequest`, `ApiResponse`.
