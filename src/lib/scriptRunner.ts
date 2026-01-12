export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export interface ScriptResult {
  updatedVariables: Record<string, string>;
  testResults: TestResult[];
  logs: string[];
  error?: string;
}

export interface ScriptContext {
  variables: Record<string, string>;
  response?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    data: unknown;
  };
}

/**
 * Runs a script in a sandboxed environment with a Postman-compatible pm API.
 */
export function runScript(code: string, context: ScriptContext): ScriptResult {
  const updatedVariables: Record<string, string> = { ...context.variables };
  const testResults: TestResult[] = [];
  const logs: string[] = [];

  // Build the pm object
  const pm = {
    environment: {
      get: (key: string): string | undefined => {
        return updatedVariables[key];
      },
      set: (key: string, value: string): void => {
        updatedVariables[key] = String(value);
      },
    },
    response: {
      json: (): unknown => {
        if (!context.response) {
          throw new Error("pm.response is not available in pre-request scripts");
        }
        return context.response.data;
      },
    },
    test: (name: string, fn: () => void): void => {
      try {
        fn();
        testResults.push({ name, passed: true });
      } catch (err) {
        testResults.push({
          name,
          passed: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };

  // Create console mock to capture logs
  const console = {
    log: (...args: unknown[]) => {
      logs.push(args.map((a) => String(a)).join(" "));
    },
    error: (...args: unknown[]) => {
      logs.push("[ERROR] " + args.map((a) => String(a)).join(" "));
    },
    warn: (...args: unknown[]) => {
      logs.push("[WARN] " + args.map((a) => String(a)).join(" "));
    },
  };

  try {
    // Create and execute the function with pm and console in scope
    const fn = new Function("pm", "console", code);
    fn(pm, console);

    return {
      updatedVariables,
      testResults,
      logs,
    };
  } catch (err) {
    return {
      updatedVariables,
      testResults,
      logs,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
