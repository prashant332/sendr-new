/**
 * Proto file parser using protobufjs
 * Parses .proto files and extracts services, methods, and messages
 */

import * as protobuf from "protobufjs";
import type { ParsedService, ParsedMethod } from "@/lib/db";

export interface ProtoParseResult {
  success: boolean;
  services: ParsedService[];
  messages: string[];
  enums: string[];
  errors: string[];
  packageName: string | null;
  imports: string[];
}

/**
 * Parse a .proto file content and extract services, methods, and messages
 */
export function parseProtoContent(content: string): ProtoParseResult {
  const result: ProtoParseResult = {
    success: false,
    services: [],
    messages: [],
    enums: [],
    errors: [],
    packageName: null,
    imports: [],
  };

  try {
    // Parse the proto content
    const root = protobuf.parse(content, { keepCase: true });

    if (root.package) {
      result.packageName = root.package;
    }

    // Extract imports from the content using regex
    // protobufjs doesn't expose imports directly
    const importRegex = /import\s+["']([^"']+)["']/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      result.imports.push(match[1]);
    }

    // Process the root object
    processNamespace(root.root, "", result);

    result.success = true;
  } catch (err) {
    result.errors.push(`Parse error: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}

/**
 * Recursively process a namespace/type to extract services and messages
 */
function processNamespace(
  namespace: protobuf.NamespaceBase,
  prefix: string,
  result: ProtoParseResult
): void {
  if (!namespace.nested) return;

  for (const [name, nested] of Object.entries(namespace.nested)) {
    const fullName = prefix ? `${prefix}.${name}` : name;

    if (nested instanceof protobuf.Service) {
      // Extract service with its methods
      const service: ParsedService = {
        name,
        fullName,
        methods: [],
      };

      if (nested.methods) {
        for (const [methodName, method] of Object.entries(nested.methods)) {
          const parsedMethod: ParsedMethod = {
            name: methodName,
            inputType: method.requestType,
            outputType: method.responseType,
            clientStreaming: method.requestStream || false,
            serverStreaming: method.responseStream || false,
          };
          service.methods.push(parsedMethod);
        }
      }

      result.services.push(service);
    } else if (nested instanceof protobuf.Type) {
      // It's a message type
      result.messages.push(fullName);
    } else if (nested instanceof protobuf.Enum) {
      // It's an enum
      result.enums.push(fullName);
    } else if (nested instanceof protobuf.Namespace) {
      // Recurse into nested namespace
      processNamespace(nested, fullName, result);
    }
  }
}

/**
 * Get method type description (Unary, Server Streaming, etc.)
 */
export function getMethodType(method: ParsedMethod): string {
  if (method.clientStreaming && method.serverStreaming) {
    return "Bidirectional Streaming";
  } else if (method.clientStreaming) {
    return "Client Streaming";
  } else if (method.serverStreaming) {
    return "Server Streaming";
  }
  return "Unary";
}

/**
 * Get method type short code
 */
export function getMethodTypeCode(method: ParsedMethod): string {
  if (method.clientStreaming && method.serverStreaming) {
    return "BiDi";
  } else if (method.clientStreaming) {
    return "CS";
  } else if (method.serverStreaming) {
    return "SS";
  }
  return "U";
}

// Debug flag - set to true to enable console logging
const DEBUG_PROTO_PARSER = false;

function debugLog(...args: unknown[]) {
  if (DEBUG_PROTO_PARSER) {
    console.log('[ProtoParser]', ...args);
  }
}

/**
 * Result of generating a sample message
 */
export interface GenerateSampleResult {
  sample: Record<string, unknown> | null;
  warnings: string[];
  errors: string[];
}

/**
 * Generate a sample JSON message for a message type
 * @param protoContent - The proto file content (or primary proto content)
 * @param messageType - The message type name to generate
 * @param maxDepth - Maximum recursion depth to prevent infinite loops (default: 5)
 * @param additionalProtoContents - Additional proto file contents (for imports)
 * @returns Object with sample, warnings, and errors
 */
export function generateSampleMessage(
  protoContent: string,
  messageType: string,
  maxDepth: number = 5,
  additionalProtoContents: string[] = []
): GenerateSampleResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  debugLog('=== generateSampleMessage START ===');
  debugLog('messageType:', messageType);
  debugLog('mainProtoContent length:', protoContent.length);
  debugLog('additionalProtoContents count:', additionalProtoContents.length);
  additionalProtoContents.forEach((c, i) => {
    debugLog(`  additional[${i}] length:`, c.length);
  });

  try {
    // Create a single Root to hold all types from all files
    const root = new protobuf.Root();

    // Track packages we've seen for type lookup later
    const packages: string[] = [];

    // Parse additional proto contents first (dependencies)
    for (let i = 0; i < additionalProtoContents.length; i++) {
      const content = additionalProtoContents[i];
      try {
        const parsed = protobuf.parse(content, root, { keepCase: true });
        if (parsed.package && !packages.includes(parsed.package)) {
          packages.push(parsed.package);
        }
        debugLog(`Parsed additional[${i}] successfully, package: ${parsed.package || '(none)'}`);
      } catch (parseErr) {
        const errMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
        debugLog(`Failed to parse additional[${i}]:`, errMsg);
        warnings.push(`Failed to parse imported proto file: ${errMsg}`);
        // Continue with other files - don't fail completely
      }
    }

    // Parse the main proto content last
    let mainPackage: string | null = null;
    try {
      const parsed = protobuf.parse(protoContent, root, { keepCase: true });
      mainPackage = parsed.package || null;
      if (mainPackage && !packages.includes(mainPackage)) {
        packages.push(mainPackage);
      }
      debugLog('Parsed main proto successfully, package:', mainPackage || '(none)');
    } catch (parseErr) {
      const errMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      debugLog('Failed to parse main proto:', errMsg);
      errors.push(`Failed to parse main proto file: ${errMsg}`);
      return { sample: null, warnings, errors };
    }

    debugLog('All packages:', packages);

    // IMPORTANT: Resolve all type references before generating samples
    // Without this, field.resolvedType will be null for nested message types
    try {
      root.resolveAll();
      debugLog('resolveAll() successful');
    } catch (resolveErr) {
      const errMsg = resolveErr instanceof Error ? resolveErr.message : String(resolveErr);
      debugLog('resolveAll() FAILED:', errMsg);
      warnings.push(`Type resolution warning: ${errMsg}`);
      // Don't throw - continue and see what we can generate
    }

    // List all types found in root
    const allTypes = listAllTypes(root);
    debugLog('All types found:', allTypes);

    // Try to find the type - it might be a simple name or fully qualified
    let Type: protobuf.Type | null = null;

    // First try direct lookup
    try {
      Type = root.lookupType(messageType);
      debugLog('Direct lookup SUCCESS for:', messageType);
    } catch (e) {
      debugLog('Direct lookup failed for:', messageType, e instanceof Error ? e.message : e);
    }

    // Try with each known package prefix
    if (!Type) {
      for (const pkg of packages) {
        try {
          const fullyQualified = `${pkg}.${messageType}`;
          Type = root.lookupType(fullyQualified);
          debugLog('Package-prefixed lookup SUCCESS for:', fullyQualified);
          break;
        } catch {
          debugLog(`Package-prefixed lookup failed for ${pkg}.${messageType}`);
        }
      }
    }

    // If still not found, search through all nested types
    if (!Type) {
      debugLog('Trying findTypeByName...');
      Type = findTypeByName(root, messageType);
      if (Type) {
        debugLog('findTypeByName SUCCESS, found:', Type.fullName);
      } else {
        debugLog('findTypeByName returned null');
      }
    }

    if (!Type) {
      debugLog('=== generateSampleMessage END (Type not found) ===');
      errors.push(`Message type "${messageType}" not found in proto definitions`);
      return { sample: null, warnings, errors };
    }

    debugLog('Using Type:', Type.fullName);
    debugLog('Type fields:', Type.fieldsArray.map(f => ({
      name: f.name,
      type: f.type,
      repeated: f.repeated,
      resolvedType: f.resolvedType ? f.resolvedType.fullName : null
    })));

    // Check for unresolved field types and add warnings
    for (const field of Type.fieldsArray) {
      if (!isPrimitiveType(field.type) && !field.resolvedType) {
        warnings.push(`Field "${field.name}" has unresolved type "${field.type}". Check if the proto file defining this type is uploaded with the correct path.`);
      }
    }

    // Track visited types to prevent infinite recursion on self-referential messages
    const visited = new Set<string>();

    const sample = generateSampleForType(Type, maxDepth, visited);
    debugLog('Generated sample:', JSON.stringify(sample, null, 2));
    debugLog('=== generateSampleMessage END (success) ===');
    return { sample, warnings, errors };
  } catch (err) {
    debugLog('=== generateSampleMessage END (error) ===');
    debugLog('Error:', err);
    const errMsg = err instanceof Error ? err.message : String(err);
    errors.push(`Unexpected error: ${errMsg}`);
    return { sample: null, warnings, errors };
  }
}

/**
 * Check if a type is a primitive protobuf type
 */
function isPrimitiveType(type: string): boolean {
  const primitives = [
    'double', 'float', 'int32', 'int64', 'uint32', 'uint64',
    'sint32', 'sint64', 'fixed32', 'fixed64', 'sfixed32', 'sfixed64',
    'bool', 'string', 'bytes'
  ];
  return primitives.includes(type);
}

/**
 * List all type names in a namespace (for debugging)
 */
function listAllTypes(namespace: protobuf.NamespaceBase, prefix: string = ''): string[] {
  const types: string[] = [];
  if (!namespace.nested) return types;

  for (const [name, nested] of Object.entries(namespace.nested)) {
    const fullName = prefix ? `${prefix}.${name}` : name;
    if (nested instanceof protobuf.Type) {
      types.push(fullName);
      // Also list nested types within this type
      types.push(...listAllTypes(nested, fullName));
    } else if (nested instanceof protobuf.Namespace) {
      types.push(...listAllTypes(nested, fullName));
    }
  }
  return types;
}

/**
 * Recursively search for a type by its simple name
 */
function findTypeByName(namespace: protobuf.NamespaceBase, typeName: string): protobuf.Type | null {
  if (!namespace.nested) return null;

  for (const nested of Object.values(namespace.nested)) {
    if (nested instanceof protobuf.Type) {
      if (nested.name === typeName) {
        return nested;
      }
      // Also search nested types within this type
      const found = findTypeByName(nested, typeName);
      if (found) return found;
    } else if (nested instanceof protobuf.Namespace) {
      const found = findTypeByName(nested, typeName);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Generate a sample object for a protobuf Type
 */
function generateSampleForType(
  type: protobuf.Type,
  depth: number,
  visited: Set<string>
): Record<string, unknown> {
  debugLog(`generateSampleForType: ${type.fullName}, depth=${depth}, visited=[${[...visited].join(', ')}]`);

  if (depth <= 0) {
    debugLog(`  -> returning {} (depth exhausted)`);
    return {};
  }
  if (visited.has(type.fullName)) {
    debugLog(`  -> returning {} (cycle detected)`);
    return {};
  }

  visited.add(type.fullName);
  const sample: Record<string, unknown> = {};

  for (const field of type.fieldsArray) {
    debugLog(`  Processing field: ${field.name}, type=${field.type}, repeated=${field.repeated}, resolvedType=${field.resolvedType?.fullName || 'null'}`);
    sample[field.name] = getDefaultValueForField(field, depth - 1, visited);
    debugLog(`  Field ${field.name} = ${JSON.stringify(sample[field.name])}`);
  }

  visited.delete(type.fullName);
  return sample;
}

/**
 * Get default value for a protobuf field
 * @param field - The protobuf field
 * @param depth - Remaining recursion depth
 * @param visited - Set of visited type names to prevent cycles
 */
function getDefaultValueForField(
  field: protobuf.Field,
  depth: number,
  visited: Set<string>
): unknown {
  // Handle repeated fields - provide one sample item if nested type
  if (field.repeated) {
    debugLog(`    getDefaultValueForField(${field.name}): repeated field`);
    if (field.resolvedType instanceof protobuf.Type && depth > 0) {
      debugLog(`    -> generating array with one sample of ${field.resolvedType.fullName}`);
      return [generateSampleForType(field.resolvedType, depth, visited)];
    }
    debugLog(`    -> returning empty array (resolvedType=${field.resolvedType?.fullName || 'null'}, depth=${depth})`);
    return [];
  }

  // Handle maps
  if (field.map) {
    debugLog(`    getDefaultValueForField(${field.name}): map field, returning {}`);
    return {};
  }

  // Handle different types
  switch (field.type) {
    case "double":
    case "float":
      return 0.0;
    case "int32":
    case "int64":
    case "uint32":
    case "uint64":
    case "sint32":
    case "sint64":
    case "fixed32":
    case "fixed64":
    case "sfixed32":
    case "sfixed64":
      return 0;
    case "bool":
      return false;
    case "string":
      return "";
    case "bytes":
      return "";
    default:
      // Likely a message type or enum
      debugLog(`    getDefaultValueForField(${field.name}): custom type "${field.type}"`);
      debugLog(`      resolvedType: ${field.resolvedType ? field.resolvedType.fullName : 'NULL'}`);
      debugLog(`      resolvedType instanceof Type: ${field.resolvedType instanceof protobuf.Type}`);
      debugLog(`      resolvedType instanceof Enum: ${field.resolvedType instanceof protobuf.Enum}`);

      if (field.resolvedType instanceof protobuf.Enum) {
        const enumValues = Object.values(field.resolvedType.values);
        debugLog(`      -> enum, returning first value: ${enumValues[0]}`);
        return enumValues[0] ?? 0;
      }
      // For nested messages, recursively generate sample
      if (field.resolvedType instanceof protobuf.Type && depth > 0) {
        debugLog(`      -> nested message, recursing into ${field.resolvedType.fullName}`);
        return generateSampleForType(field.resolvedType, depth, visited);
      }
      // Fallback for unresolved types or depth exceeded
      debugLog(`      -> FALLBACK returning {} (resolvedType=${field.resolvedType?.fullName || 'null'}, depth=${depth})`);
      return {};
  }
}

/**
 * Validate proto syntax without fully parsing
 */
export function validateProtoSyntax(content: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    protobuf.parse(content, { keepCase: true });
    return { valid: true, errors: [] };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { valid: false, errors };
  }
}

/**
 * Extract package name from proto content
 */
export function extractPackageName(content: string): string | null {
  const match = /package\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s*;/.exec(content);
  return match ? match[1] : null;
}

/**
 * Extract syntax version from proto content
 */
export function extractSyntaxVersion(content: string): string {
  const match = /syntax\s*=\s*["']([^"']+)["']/.exec(content);
  return match ? match[1] : "proto2"; // Default to proto2 if not specified
}
