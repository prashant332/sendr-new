"use client";

import { AuthType, RequestAuth } from "@/lib/db";

interface AuthEditorProps {
  auth: RequestAuth;
  onChange: (auth: RequestAuth) => void;
}

const AUTH_TYPES: { value: AuthType; label: string }[] = [
  { value: "none", label: "No Auth" },
  { value: "bearer", label: "Bearer Token" },
  { value: "basic", label: "Basic Auth" },
  { value: "apikey", label: "API Key" },
];

export function AuthEditor({ auth, onChange }: AuthEditorProps) {
  const handleTypeChange = (type: AuthType) => {
    onChange({ ...auth, type });
  };

  const handleBearerChange = (field: keyof RequestAuth["bearer"], value: string) => {
    onChange({
      ...auth,
      bearer: { ...auth.bearer, [field]: value },
    });
  };

  const handleBasicChange = (field: keyof RequestAuth["basic"], value: string) => {
    onChange({
      ...auth,
      basic: { ...auth.basic, [field]: value },
    });
  };

  const handleApiKeyChange = (
    field: keyof RequestAuth["apikey"],
    value: string | "header" | "query"
  ) => {
    onChange({
      ...auth,
      apikey: { ...auth.apikey, [field]: value },
    });
  };

  return (
    <div className="space-y-4">
      {/* Type Selector */}
      <div>
        <label className="block text-sm text-zinc-400 mb-2">Type</label>
        <select
          value={auth.type}
          onChange={(e) => handleTypeChange(e.target.value as AuthType)}
          className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm w-48"
        >
          {AUTH_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* No Auth */}
      {auth.type === "none" && (
        <div className="text-zinc-500 text-sm py-4">
          This request does not use any authentication.
        </div>
      )}

      {/* Bearer Token */}
      {auth.type === "bearer" && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Token</label>
            <input
              type="text"
              value={auth.bearer.token}
              onChange={(e) => handleBearerChange("token", e.target.value)}
              placeholder="Enter token or {{variable}}"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Header Name</label>
              <input
                type="text"
                value={auth.bearer.headerKey}
                onChange={(e) => handleBearerChange("headerKey", e.target.value)}
                placeholder="Authorization"
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Prefix</label>
              <input
                type="text"
                value={auth.bearer.prefix}
                onChange={(e) => handleBearerChange("prefix", e.target.value)}
                placeholder="Bearer"
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="text-xs text-zinc-500">
            Header will be: <code className="bg-zinc-800 px-1 rounded">{auth.bearer.headerKey || "Authorization"}: {auth.bearer.prefix ? `${auth.bearer.prefix} ` : ""}{"<token>"}</code>
          </div>
        </div>
      )}

      {/* Basic Auth */}
      {auth.type === "basic" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Username</label>
              <input
                type="text"
                value={auth.basic.username}
                onChange={(e) => handleBasicChange("username", e.target.value)}
                placeholder="Username or {{variable}}"
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Password</label>
              <input
                type="password"
                value={auth.basic.password}
                onChange={(e) => handleBasicChange("password", e.target.value)}
                placeholder="Password or {{variable}}"
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Header Name</label>
            <input
              type="text"
              value={auth.basic.headerKey}
              onChange={(e) => handleBasicChange("headerKey", e.target.value)}
              placeholder="Authorization"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm max-w-xs"
            />
          </div>
          <div className="text-xs text-zinc-500">
            Header will be: <code className="bg-zinc-800 px-1 rounded">{auth.basic.headerKey || "Authorization"}: Basic {"<base64(username:password)>"}</code>
          </div>
        </div>
      )}

      {/* API Key */}
      {auth.type === "apikey" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Key</label>
              <input
                type="text"
                value={auth.apikey.key}
                onChange={(e) => handleApiKeyChange("key", e.target.value)}
                placeholder="X-API-Key"
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Value</label>
              <input
                type="text"
                value={auth.apikey.value}
                onChange={(e) => handleApiKeyChange("value", e.target.value)}
                placeholder="Value or {{variable}}"
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Add to</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="apikey-location"
                  checked={auth.apikey.addTo === "header"}
                  onChange={() => handleApiKeyChange("addTo", "header")}
                  className="text-blue-500"
                />
                <span className="text-sm text-zinc-300">Header</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="apikey-location"
                  checked={auth.apikey.addTo === "query"}
                  onChange={() => handleApiKeyChange("addTo", "query")}
                  className="text-blue-500"
                />
                <span className="text-sm text-zinc-300">Query Params</span>
              </label>
            </div>
          </div>
          <div className="text-xs text-zinc-500">
            {auth.apikey.addTo === "header" ? (
              <>Header will be: <code className="bg-zinc-800 px-1 rounded">{auth.apikey.key || "X-API-Key"}: {"<value>"}</code></>
            ) : (
              <>Query param will be: <code className="bg-zinc-800 px-1 rounded">?{auth.apikey.key || "api_key"}={"<value>"}</code></>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to create default auth config
export function createDefaultAuth(): RequestAuth {
  return {
    type: "none",
    bearer: {
      token: "",
      headerKey: "Authorization",
      prefix: "Bearer",
    },
    basic: {
      username: "",
      password: "",
      headerKey: "Authorization",
    },
    apikey: {
      key: "X-API-Key",
      value: "",
      addTo: "header",
    },
  };
}

// Helper to apply auth to headers/params
export function applyAuth(
  auth: RequestAuth,
  headers: Record<string, string>,
  variables: Record<string, string>,
  interpolate: (text: string, vars: Record<string, string>) => string
): { headers: Record<string, string>; queryParams?: Record<string, string> } {
  const result = { headers: { ...headers }, queryParams: undefined as Record<string, string> | undefined };

  if (auth.type === "none") {
    return result;
  }

  if (auth.type === "bearer") {
    const token = interpolate(auth.bearer.token, variables);
    const headerKey = interpolate(auth.bearer.headerKey || "Authorization", variables);
    // Only use "Bearer" default if prefix is undefined, not if explicitly empty
    const rawPrefix = auth.bearer.prefix !== undefined ? auth.bearer.prefix : "Bearer";
    const prefix = interpolate(rawPrefix, variables);
    if (token) {
      result.headers[headerKey] = prefix ? `${prefix} ${token}` : token;
    }
  }

  if (auth.type === "basic") {
    const username = interpolate(auth.basic.username, variables);
    const password = interpolate(auth.basic.password, variables);
    const headerKey = interpolate(auth.basic.headerKey || "Authorization", variables);
    if (username || password) {
      const encoded = btoa(`${username}:${password}`);
      result.headers[headerKey] = `Basic ${encoded}`;
    }
  }

  if (auth.type === "apikey") {
    const key = interpolate(auth.apikey.key, variables);
    const value = interpolate(auth.apikey.value, variables);
    if (key && value) {
      if (auth.apikey.addTo === "header") {
        result.headers[key] = value;
      } else {
        result.queryParams = { [key]: value };
      }
    }
  }

  return result;
}
