/**
 * Well-known Google Protocol Buffer types bundled for Sendr
 * These are commonly imported in proto files
 */

export const WELL_KNOWN_PROTOS: Record<string, string> = {
  "google/protobuf/empty.proto": `
syntax = "proto3";

package google.protobuf;

option java_package = "com.google.protobuf";
option java_outer_classname = "EmptyProto";
option java_multiple_files = true;

// A generic empty message that you can re-use to avoid defining duplicated
// empty messages in your APIs.
message Empty {}
`,

  "google/protobuf/timestamp.proto": `
syntax = "proto3";

package google.protobuf;

option java_package = "com.google.protobuf";
option java_outer_classname = "TimestampProto";
option java_multiple_files = true;

// A Timestamp represents a point in time independent of any time zone or local
// calendar, encoded as a count of seconds and fractions of seconds at
// nanosecond resolution.
message Timestamp {
  // Represents seconds of UTC time since Unix epoch
  int64 seconds = 1;

  // Non-negative fractions of a second at nanosecond resolution.
  int32 nanos = 2;
}
`,

  "google/protobuf/duration.proto": `
syntax = "proto3";

package google.protobuf;

option java_package = "com.google.protobuf";
option java_outer_classname = "DurationProto";
option java_multiple_files = true;

// A Duration represents a signed, fixed-length span of time represented
// as a count of seconds and fractions of seconds at nanosecond resolution.
message Duration {
  // Signed seconds of the span of time.
  int64 seconds = 1;

  // Signed fractions of a second at nanosecond resolution of the span of time.
  int32 nanos = 2;
}
`,

  "google/protobuf/wrappers.proto": `
syntax = "proto3";

package google.protobuf;

option java_package = "com.google.protobuf";
option java_outer_classname = "WrappersProto";
option java_multiple_files = true;

// Wrapper message for double.
message DoubleValue {
  double value = 1;
}

// Wrapper message for float.
message FloatValue {
  float value = 1;
}

// Wrapper message for int64.
message Int64Value {
  int64 value = 1;
}

// Wrapper message for uint64.
message UInt64Value {
  uint64 value = 1;
}

// Wrapper message for int32.
message Int32Value {
  int32 value = 1;
}

// Wrapper message for uint32.
message UInt32Value {
  uint32 value = 1;
}

// Wrapper message for bool.
message BoolValue {
  bool value = 1;
}

// Wrapper message for string.
message StringValue {
  string value = 1;
}

// Wrapper message for bytes.
message BytesValue {
  bytes value = 1;
}
`,

  "google/protobuf/any.proto": `
syntax = "proto3";

package google.protobuf;

option java_package = "com.google.protobuf";
option java_outer_classname = "AnyProto";
option java_multiple_files = true;

// Any contains an arbitrary serialized protocol buffer message along with a
// URL that describes the type of the serialized message.
message Any {
  // A URL/resource name that uniquely identifies the type of the serialized
  // protocol buffer message.
  string type_url = 1;

  // Must be a valid serialized protocol buffer of the above specified type.
  bytes value = 2;
}
`,

  "google/protobuf/struct.proto": `
syntax = "proto3";

package google.protobuf;

option java_package = "com.google.protobuf";
option java_outer_classname = "StructProto";
option java_multiple_files = true;

// Struct represents a structured data value, consisting of fields
// which map to dynamically typed values.
message Struct {
  // Unordered map of dynamically typed values.
  map<string, Value> fields = 1;
}

// Value represents a dynamically typed value which can be either
// null, a number, a string, a boolean, a recursive struct value, or a
// list of values.
message Value {
  oneof kind {
    NullValue null_value = 1;
    double number_value = 2;
    string string_value = 3;
    bool bool_value = 4;
    Struct struct_value = 5;
    ListValue list_value = 6;
  }
}

// NullValue is a singleton enumeration to represent the null value for the
// Value type union.
enum NullValue {
  NULL_VALUE = 0;
}

// ListValue is a wrapper around a repeated field of values.
message ListValue {
  repeated Value values = 1;
}
`,

  "google/protobuf/field_mask.proto": `
syntax = "proto3";

package google.protobuf;

option java_package = "com.google.protobuf";
option java_outer_classname = "FieldMaskProto";
option java_multiple_files = true;

// FieldMask represents a set of symbolic field paths.
message FieldMask {
  // The set of field mask paths.
  repeated string paths = 1;
}
`,
};

/**
 * Check if an import path is a well-known type
 */
export function isWellKnownType(importPath: string): boolean {
  return importPath in WELL_KNOWN_PROTOS;
}

/**
 * Get well-known proto content by path
 */
export function getWellKnownProto(importPath: string): string | null {
  return WELL_KNOWN_PROTOS[importPath] || null;
}

/**
 * Get all well-known proto paths
 */
export function getWellKnownProtoPaths(): string[] {
  return Object.keys(WELL_KNOWN_PROTOS);
}
