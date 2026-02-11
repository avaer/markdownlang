/**
 * JSON Schema definition (subset relevant to markdownlang).
 */
export interface JsonSchema {
  type: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  description?: string;
  enum?: any[];
  minimum?: number;
  maximum?: number;
  additionalProperties?: boolean;
  [key: string]: any;
}

/**
 * A parsed markdownlang program.
 */
export interface MarkdownlangProgram {
  /** Program name (from frontmatter) */
  name: string;
  /** Human-readable description */
  description: string;
  /** JSON Schema for the program's input */
  input: JsonSchema;
  /** JSON Schema for the program's output */
  output: JsonSchema;
  /** Optional list of imported .mdlang file paths (other programs used as tools) */
  imports?: string[];
  /** The markdown body — the actual "code" / prompt template */
  body: string;
  /** The raw source file path (set by the parser) */
  sourcePath?: string;
}
