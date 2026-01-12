"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ResponseTemplate,
  TemplateColumn,
  TemplateViewType,
} from "@/lib/db";

interface ResponseVisualizerProps {
  data: unknown;
  template?: ResponseTemplate;
  onTemplateChange?: (template: ResponseTemplate) => void;
}

// Helper to get value at a JSON path
function getValueAtPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

// Detect the type of a value
function detectType(value: unknown): TemplateColumn["type"] {
  if (value === null || value === undefined) return "string";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "object") return "object";
  if (typeof value === "string") {
    // Check for URL
    if (value.match(/^https?:\/\//i)) {
      // Check for image URL
      if (value.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i)) {
        return "image";
      }
      return "url";
    }
    // Check for date
    if (value.match(/^\d{4}-\d{2}-\d{2}/) || !isNaN(Date.parse(value))) {
      const date = new Date(value);
      if (!isNaN(date.getTime()) && value.length > 8) {
        return "date";
      }
    }
  }
  return "string";
}

// Convert key to readable label
function keyToLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

// Auto-generate template from data
export function generateTemplate(data: unknown): ResponseTemplate {
  const template: ResponseTemplate = {
    enabled: true,
    viewType: "auto",
    rootPath: "",
    columns: [],
  };

  if (data === null || data === undefined) {
    return template;
  }

  // Find the best root path (look for arrays)
  let targetData = data;
  let rootPath = "";

  if (Array.isArray(data)) {
    targetData = data;
    rootPath = "";
  } else if (typeof data === "object") {
    // Look for array properties
    const obj = data as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 0) {
        targetData = obj[key];
        rootPath = key;
        break;
      }
    }
  }

  template.rootPath = rootPath;

  // Determine view type and extract columns
  if (Array.isArray(targetData) && targetData.length > 0) {
    const firstItem = targetData[0];
    if (typeof firstItem === "object" && firstItem !== null) {
      // Array of objects -> Table or Cards
      template.viewType = "table";
      const keys = Object.keys(firstItem as Record<string, unknown>);
      template.columns = keys.slice(0, 10).map((key) => ({
        key,
        label: keyToLabel(key),
        visible: true,
        type: detectType((firstItem as Record<string, unknown>)[key]),
      }));

      // Set card fields if we have id/name/title fields
      const titleField = keys.find((k) =>
        ["name", "title", "label", "username", "email"].includes(k.toLowerCase())
      );
      const subtitleField = keys.find((k) =>
        ["description", "subtitle", "status", "type", "role"].includes(k.toLowerCase())
      );
      if (titleField) template.cardTitleField = titleField;
      if (subtitleField) template.cardSubtitleField = subtitleField;
    } else {
      // Array of primitives -> List
      template.viewType = "list";
    }
  } else if (typeof targetData === "object" && targetData !== null) {
    // Single object -> Key-Value
    template.viewType = "keyvalue";
    const keys = Object.keys(targetData as Record<string, unknown>);
    template.columns = keys.map((key) => ({
      key,
      label: keyToLabel(key),
      visible: true,
      type: detectType((targetData as Record<string, unknown>)[key]),
    }));
  }

  return template;
}

// Create default template
export function createDefaultTemplate(): ResponseTemplate {
  return {
    enabled: false,
    viewType: "auto",
    rootPath: "",
    columns: [],
  };
}

// Render a cell value based on type
function CellValue({ value, type }: { value: unknown; type: TemplateColumn["type"] }) {
  if (value === null || value === undefined) {
    return <span className="text-zinc-500">-</span>;
  }

  switch (type) {
    case "boolean":
      return (
        <span className={value ? "text-green-400" : "text-red-400"}>
          {value ? "Yes" : "No"}
        </span>
      );
    case "number":
      return <span className="text-blue-400 font-mono">{String(value)}</span>;
    case "date":
      try {
        const date = new Date(value as string);
        return (
          <span className="text-purple-400">
            {date.toLocaleDateString()} {date.toLocaleTimeString()}
          </span>
        );
      } catch {
        return <span>{String(value)}</span>;
      }
    case "url":
      return (
        <a
          href={value as string}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline truncate block max-w-xs"
        >
          {value as string}
        </a>
      );
    case "image":
      return (
        <img
          src={value as string}
          alt=""
          className="h-8 w-8 object-cover rounded"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      );
    case "object":
      return (
        <span className="text-zinc-400 font-mono text-xs">
          {JSON.stringify(value).slice(0, 50)}...
        </span>
      );
    default:
      return <span className="truncate block max-w-xs">{String(value)}</span>;
  }
}

// Table View
function TableView({
  data,
  columns,
}: {
  data: unknown[];
  columns: TemplateColumn[];
}) {
  const visibleColumns = columns.filter((c) => c.visible);

  if (data.length === 0) {
    return <div className="text-zinc-500 text-sm p-4">No data to display</div>;
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-zinc-900">
          <tr className="border-b border-zinc-700">
            {visibleColumns.map((col) => (
              <th
                key={col.key}
                className="text-left py-2 px-3 text-zinc-400 font-medium whitespace-nowrap"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={index} className="border-b border-zinc-800 hover:bg-zinc-800/50">
              {visibleColumns.map((col) => (
                <td key={col.key} className="py-2 px-3">
                  <CellValue
                    value={(item as Record<string, unknown>)[col.key]}
                    type={col.type}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Cards View
function CardsView({
  data,
  columns,
  titleField,
  subtitleField,
}: {
  data: unknown[];
  columns: TemplateColumn[];
  titleField?: string;
  subtitleField?: string;
}) {
  const visibleColumns = columns.filter((c) => c.visible && c.key !== titleField && c.key !== subtitleField);

  if (data.length === 0) {
    return <div className="text-zinc-500 text-sm p-4">No data to display</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
      {data.map((item, index) => {
        const obj = item as Record<string, unknown>;
        return (
          <div key={index} className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
            {titleField && (
              <div className="font-medium text-zinc-100 mb-1">
                {String(obj[titleField] || `Item ${index + 1}`)}
              </div>
            )}
            {subtitleField && obj[subtitleField] !== undefined && obj[subtitleField] !== null && (
              <div className="text-sm text-zinc-400 mb-3">
                {String(obj[subtitleField])}
              </div>
            )}
            <div className="space-y-1">
              {visibleColumns.slice(0, 5).map((col) => (
                <div key={col.key} className="flex text-sm">
                  <span className="text-zinc-500 w-24 flex-shrink-0">{col.label}:</span>
                  <CellValue value={obj[col.key]} type={col.type} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// List View (for arrays of primitives)
function ListView({ data }: { data: unknown[] }) {
  if (data.length === 0) {
    return <div className="text-zinc-500 text-sm p-4">No data to display</div>;
  }

  return (
    <div className="p-3">
      <ul className="space-y-1">
        {data.map((item, index) => (
          <li key={index} className="text-sm py-1 px-2 bg-zinc-800 rounded">
            {String(item)}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Key-Value View (for single objects)
function KeyValueView({
  data,
  columns,
}: {
  data: Record<string, unknown>;
  columns: TemplateColumn[];
}) {
  const visibleColumns = columns.filter((c) => c.visible);

  return (
    <div className="p-3">
      <table className="w-full text-sm">
        <tbody>
          {visibleColumns.map((col) => (
            <tr key={col.key} className="border-b border-zinc-800">
              <td className="py-2 pr-4 text-zinc-400 font-medium w-48">{col.label}</td>
              <td className="py-2">
                <CellValue value={data[col.key]} type={col.type} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Template Configuration Panel
function TemplateConfig({
  template,
  onChange,
}: {
  template: ResponseTemplate;
  onChange: (template: ResponseTemplate) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-zinc-800">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 text-left text-xs text-zinc-400 hover:bg-zinc-800/50 flex items-center justify-between"
      >
        <span>Template Settings</span>
        <span>{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="px-3 py-3 space-y-3 bg-zinc-800/30">
          {/* View Type */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">View Type</label>
            <select
              value={template.viewType}
              onChange={(e) =>
                onChange({ ...template, viewType: e.target.value as TemplateViewType })
              }
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs w-32"
            >
              <option value="auto">Auto</option>
              <option value="table">Table</option>
              <option value="cards">Cards</option>
              <option value="list">List</option>
              <option value="keyvalue">Key-Value</option>
            </select>
          </div>

          {/* Root Path */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Data Path</label>
            <input
              type="text"
              value={template.rootPath}
              onChange={(e) => onChange({ ...template, rootPath: e.target.value })}
              placeholder="e.g., data.items"
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs w-full"
            />
          </div>

          {/* Column Visibility */}
          {template.columns.length > 0 && (
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Visible Columns</label>
              <div className="flex flex-wrap gap-1">
                {template.columns.map((col, index) => (
                  <button
                    key={col.key}
                    onClick={() => {
                      const newColumns = [...template.columns];
                      newColumns[index] = { ...col, visible: !col.visible };
                      onChange({ ...template, columns: newColumns });
                    }}
                    className={`px-2 py-1 text-xs rounded ${
                      col.visible
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-700 text-zinc-400"
                    }`}
                  >
                    {col.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ResponseVisualizer({
  data,
  template: externalTemplate,
  onTemplateChange,
}: ResponseVisualizerProps) {
  // Generate template from data if not provided
  const [internalTemplate, setInternalTemplate] = useState<ResponseTemplate>(() =>
    externalTemplate || generateTemplate(data)
  );

  const template = externalTemplate || internalTemplate;

  // Regenerate template when data changes (if no external template)
  useEffect(() => {
    if (!externalTemplate && data) {
      const newTemplate = generateTemplate(data);
      setInternalTemplate(newTemplate);
    }
  }, [data, externalTemplate]);

  const handleTemplateChange = (newTemplate: ResponseTemplate) => {
    if (onTemplateChange) {
      onTemplateChange(newTemplate);
    } else {
      setInternalTemplate(newTemplate);
    }
  };

  // Get data at root path
  const targetData = useMemo(() => {
    return getValueAtPath(data, template.rootPath);
  }, [data, template.rootPath]);

  // Determine effective view type
  const effectiveViewType = useMemo(() => {
    if (template.viewType !== "auto") return template.viewType;
    if (Array.isArray(targetData)) {
      if (targetData.length > 0 && typeof targetData[0] === "object") {
        return "table";
      }
      return "list";
    }
    if (typeof targetData === "object" && targetData !== null) {
      return "keyvalue";
    }
    return "keyvalue";
  }, [template.viewType, targetData]);

  // If no valid data
  if (targetData === undefined || targetData === null) {
    return (
      <div className="h-full flex flex-col">
        <TemplateConfig template={template} onChange={handleTemplateChange} />
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
          No data at path: {template.rootPath || "(root)"}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <TemplateConfig template={template} onChange={handleTemplateChange} />
      <div className="flex-1 overflow-auto">
        {effectiveViewType === "table" && Array.isArray(targetData) && (
          <TableView data={targetData} columns={template.columns} />
        )}
        {effectiveViewType === "cards" && Array.isArray(targetData) && (
          <CardsView
            data={targetData}
            columns={template.columns}
            titleField={template.cardTitleField}
            subtitleField={template.cardSubtitleField}
          />
        )}
        {effectiveViewType === "list" && Array.isArray(targetData) && (
          <ListView data={targetData} />
        )}
        {effectiveViewType === "keyvalue" && typeof targetData === "object" && (
          <KeyValueView
            data={targetData as Record<string, unknown>}
            columns={template.columns}
          />
        )}
      </div>
    </div>
  );
}
