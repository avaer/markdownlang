import * as fs from "node:fs";
import * as path from "node:path";
import * as yaml from "js-yaml";
import type { MarkdownlangProgram } from "./types.js";

/**
 * Parse a .mdlang file into a MarkdownlangProgram.
 *
 * The file format is:
 *   ---
 *   <YAML frontmatter>
 *   ---
 *   <Markdown body>
 *
 * The frontmatter must contain: name, description, input (JSON Schema), output (JSON Schema).
 * Optionally: imports (array of file paths to other .mdlang programs).
 */
export function parse(filePath: string): MarkdownlangProgram {
  const absolutePath = path.resolve(filePath);
  const content = fs.readFileSync(absolutePath, "utf-8");
  return parseSource(content, absolutePath);
}

/**
 * Parse markdownlang source text directly (useful for testing without files).
 */
export function parseSource(
  source: string,
  sourcePath = "<inline>"
): MarkdownlangProgram {
  const trimmed = source.trim();

  // The file must start with '---'
  if (!trimmed.startsWith("---")) {
    throw new Error(
      `Invalid markdownlang file (${sourcePath}): must start with YAML frontmatter delimited by ---`
    );
  }

  // Find the closing '---'
  const secondDash = trimmed.indexOf("---", 3);
  if (secondDash === -1) {
    throw new Error(
      `Invalid markdownlang file (${sourcePath}): missing closing --- for frontmatter`
    );
  }

  const frontmatterRaw = trimmed.slice(3, secondDash).trim();
  const body = trimmed.slice(secondDash + 3).trim();

  // Parse YAML frontmatter
  const frontmatter = yaml.load(frontmatterRaw) as Record<string, any>;

  if (!frontmatter || typeof frontmatter !== "object") {
    throw new Error(
      `Invalid markdownlang file (${sourcePath}): frontmatter is not a valid YAML object`
    );
  }

  // Validate required fields
  for (const field of ["name", "description", "input", "output"]) {
    if (!(field in frontmatter)) {
      throw new Error(
        `Invalid markdownlang file (${sourcePath}): missing required field "${field}" in frontmatter`
      );
    }
  }

  return {
    name: String(frontmatter.name),
    description: String(frontmatter.description),
    input: frontmatter.input,
    output: frontmatter.output,
    imports: Array.isArray(frontmatter.imports)
      ? frontmatter.imports.map(String)
      : undefined,
    body,
    sourcePath,
  };
}

/**
 * Render template variables in the body.
 * Supports Go-style {{ .variableName }} syntax.
 */
export function renderTemplate(
  template: string,
  data: Record<string, any>
): string {
  return template.replace(/\{\{\s*\.(\w+)\s*\}\}/g, (match, key: string) => {
    if (key in data) {
      const value = data[key];
      return typeof value === "object" ? JSON.stringify(value) : String(value);
    }
    return match; // Leave unresolved variables as-is
  });
}
