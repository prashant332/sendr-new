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
    // gRPC-specific response fields
    grpcMetadata?: Record<string, string>;
    grpcTrailers?: Record<string, string>;
    grpcStatus?: {
      code: number;
      details: string;
    };
  };
}

/**
 * Creates a Chai-style expect assertion object
 */
function createExpect(value: unknown) {
  const assertion = {
    to: {
      equal: (expected: unknown) => {
        if (value !== expected) {
          throw new Error(`Expected ${JSON.stringify(value)} to equal ${JSON.stringify(expected)}`);
        }
      },
      eql: (expected: unknown) => {
        if (JSON.stringify(value) !== JSON.stringify(expected)) {
          throw new Error(`Expected ${JSON.stringify(value)} to deeply equal ${JSON.stringify(expected)}`);
        }
      },
      be: {
        true: (() => {
          if (value !== true) {
            throw new Error(`Expected ${JSON.stringify(value)} to be true`);
          }
        }) as unknown as boolean,
        false: (() => {
          if (value !== false) {
            throw new Error(`Expected ${JSON.stringify(value)} to be false`);
          }
        }) as unknown as boolean,
        null: (() => {
          if (value !== null) {
            throw new Error(`Expected ${JSON.stringify(value)} to be null`);
          }
        }) as unknown as null,
        undefined: (() => {
          if (value !== undefined) {
            throw new Error(`Expected ${JSON.stringify(value)} to be undefined`);
          }
        }) as unknown as undefined,
        a: (type: string) => {
          const actualType = Array.isArray(value) ? "array" : typeof value;
          if (actualType !== type.toLowerCase()) {
            throw new Error(`Expected ${JSON.stringify(value)} to be a ${type}, but got ${actualType}`);
          }
        },
        an: (type: string) => {
          const actualType = Array.isArray(value) ? "array" : typeof value;
          if (actualType !== type.toLowerCase()) {
            throw new Error(`Expected ${JSON.stringify(value)} to be an ${type}, but got ${actualType}`);
          }
        },
        above: (num: number) => {
          if (typeof value !== "number" || value <= num) {
            throw new Error(`Expected ${value} to be above ${num}`);
          }
        },
        greaterThan: (num: number) => {
          if (typeof value !== "number" || value <= num) {
            throw new Error(`Expected ${value} to be greater than ${num}`);
          }
        },
        below: (num: number) => {
          if (typeof value !== "number" || value >= num) {
            throw new Error(`Expected ${value} to be below ${num}`);
          }
        },
        lessThan: (num: number) => {
          if (typeof value !== "number" || value >= num) {
            throw new Error(`Expected ${value} to be less than ${num}`);
          }
        },
        at: {
          least: (num: number) => {
            if (typeof value !== "number" || value < num) {
              throw new Error(`Expected ${value} to be at least ${num}`);
            }
          },
          most: (num: number) => {
            if (typeof value !== "number" || value > num) {
              throw new Error(`Expected ${value} to be at most ${num}`);
            }
          },
        },
        ok: (() => {
          if (!value) {
            throw new Error(`Expected ${JSON.stringify(value)} to be truthy`);
          }
        }) as unknown as boolean,
        empty: (() => {
          if (Array.isArray(value) && value.length > 0) {
            throw new Error(`Expected array to be empty but has ${value.length} items`);
          }
          if (typeof value === "string" && value.length > 0) {
            throw new Error(`Expected string to be empty but has ${value.length} characters`);
          }
          if (typeof value === "object" && value !== null && Object.keys(value).length > 0) {
            throw new Error(`Expected object to be empty but has ${Object.keys(value).length} keys`);
          }
        }) as unknown as boolean,
      },
      have: {
        property: (key: string, expectedValue?: unknown) => {
          if (typeof value !== "object" || value === null) {
            throw new Error(`Expected ${JSON.stringify(value)} to be an object with property "${key}"`);
          }
          if (!(key in value)) {
            throw new Error(`Expected object to have property "${key}"`);
          }
          if (expectedValue !== undefined && (value as Record<string, unknown>)[key] !== expectedValue) {
            throw new Error(`Expected property "${key}" to equal ${JSON.stringify(expectedValue)}`);
          }
        },
        length: (len: number) => {
          const actualLen = Array.isArray(value) ? value.length : typeof value === "string" ? value.length : -1;
          if (actualLen !== len) {
            throw new Error(`Expected length ${len} but got ${actualLen}`);
          }
        },
        lengthOf: (len: number) => {
          const actualLen = Array.isArray(value) ? value.length : typeof value === "string" ? value.length : -1;
          if (actualLen !== len) {
            throw new Error(`Expected length ${len} but got ${actualLen}`);
          }
        },
        status: (code: number) => {
          if ((value as { status?: number })?.status !== code) {
            throw new Error(`Expected status ${code} but got ${(value as { status?: number })?.status}`);
          }
        },
      },
      include: (item: unknown) => {
        if (Array.isArray(value)) {
          if (!value.includes(item)) {
            throw new Error(`Expected array to include ${JSON.stringify(item)}`);
          }
        } else if (typeof value === "string") {
          if (!value.includes(String(item))) {
            throw new Error(`Expected string to include "${item}"`);
          }
        } else if (typeof value === "object" && value !== null) {
          if (typeof item === "object" && item !== null) {
            for (const [k, v] of Object.entries(item)) {
              if ((value as Record<string, unknown>)[k] !== v) {
                throw new Error(`Expected object to include ${JSON.stringify(item)}`);
              }
            }
          }
        }
      },
      match: (regex: RegExp) => {
        if (typeof value !== "string") {
          throw new Error(`Expected ${JSON.stringify(value)} to be a string for regex match`);
        }
        if (!regex.test(value)) {
          throw new Error(`Expected "${value}" to match ${regex}`);
        }
      },
      exist: (() => {
        if (value === null || value === undefined) {
          throw new Error(`Expected value to exist but got ${value}`);
        }
      }) as unknown as boolean,
      not: {
        equal: (expected: unknown) => {
          if (value === expected) {
            throw new Error(`Expected ${JSON.stringify(value)} to not equal ${JSON.stringify(expected)}`);
          }
        },
        be: {
          null: (() => {
            if (value === null) {
              throw new Error(`Expected value to not be null`);
            }
          }) as unknown as null,
          undefined: (() => {
            if (value === undefined) {
              throw new Error(`Expected value to not be undefined`);
            }
          }) as unknown as undefined,
          empty: (() => {
            if (Array.isArray(value) && value.length === 0) {
              throw new Error(`Expected array to not be empty`);
            }
            if (typeof value === "string" && value.length === 0) {
              throw new Error(`Expected string to not be empty`);
            }
          }) as unknown as boolean,
        },
        have: {
          property: (key: string) => {
            // If value is null or undefined, it doesn't have the property (assertion passes)
            if (value === null || value === undefined) {
              return; // Pass - null/undefined don't have any properties
            }
            if (typeof value !== "object") {
              return; // Pass - non-objects don't have properties in the expected sense
            }
            if (key in value) {
              throw new Error(`Expected object to not have property "${key}"`);
            }
          },
        },
        include: (item: unknown) => {
          if (Array.isArray(value) && value.includes(item)) {
            throw new Error(`Expected array to not include ${JSON.stringify(item)}`);
          }
          if (typeof value === "string" && value.includes(String(item))) {
            throw new Error(`Expected string to not include "${item}"`);
          }
        },
        exist: (() => {
          if (value !== null && value !== undefined) {
            throw new Error(`Expected value to not exist but got ${JSON.stringify(value)}`);
          }
        }) as unknown as boolean,
      },
    },
  };

  // Make be.true, be.false, etc. callable as properties (Chai style)
  Object.defineProperty(assertion.to.be, "true", {
    get: () => {
      if (value !== true) {
        throw new Error(`Expected ${JSON.stringify(value)} to be true`);
      }
    },
  });
  Object.defineProperty(assertion.to.be, "false", {
    get: () => {
      if (value !== false) {
        throw new Error(`Expected ${JSON.stringify(value)} to be false`);
      }
    },
  });
  Object.defineProperty(assertion.to.be, "ok", {
    get: () => {
      if (!value) {
        throw new Error(`Expected ${JSON.stringify(value)} to be truthy`);
      }
    },
  });
  Object.defineProperty(assertion.to.be, "empty", {
    get: () => {
      if (Array.isArray(value) && value.length > 0) {
        throw new Error(`Expected array to be empty`);
      }
      if (typeof value === "string" && value.length > 0) {
        throw new Error(`Expected string to be empty`);
      }
    },
  });
  Object.defineProperty(assertion.to, "exist", {
    get: () => {
      if (value === null || value === undefined) {
        throw new Error(`Expected value to exist`);
      }
    },
  });
  Object.defineProperty(assertion.to.not, "exist", {
    get: () => {
      if (value !== null && value !== undefined) {
        throw new Error(`Expected value to not exist`);
      }
    },
  });

  return assertion;
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
      code: context.response?.status,
      status: context.response?.statusText,
      headers: context.response?.headers,
      // gRPC-specific response methods
      metadata: (key?: string): Record<string, string> | string | undefined => {
        if (!context.response) {
          throw new Error("pm.response is not available in pre-request scripts");
        }
        const metadata = context.response.grpcMetadata || {};
        if (key) {
          return metadata[key];
        }
        return metadata;
      },
      trailers: (key?: string): Record<string, string> | string | undefined => {
        if (!context.response) {
          throw new Error("pm.response is not available in pre-request scripts");
        }
        const trailers = context.response.grpcTrailers || {};
        if (key) {
          return trailers[key];
        }
        return trailers;
      },
      // gRPC status object (code and details)
      grpcStatus: context.response?.grpcStatus,
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
    expect: createExpect,
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
