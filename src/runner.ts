import OpenAI from "openai";
import type { MarkdownlangProgram, JsonSchema } from "./types.js";
import { parse, renderTemplate } from "./parser.js";

/**
 * Prepare a JSON schema for OpenAI's strict structured output mode.
 *
 * Strict mode requires:
 *   - All object types have `additionalProperties: false`
 *   - All properties of every object are listed in `required`
 *   - Unsupported keywords (minimum, maximum, minLength, etc.) are stripped
 */
function prepareSchemaForStrictMode(schema: JsonSchema): JsonSchema {
  if (!schema || typeof schema !== "object") return schema;

  const result: Record<string, any> = {};

  // Copy only supported keys
  const supportedKeys = new Set([
    "type",
    "properties",
    "required",
    "items",
    "description",
    "enum",
    "const",
    "anyOf",
    "oneOf",
    "$ref",
    "$defs",
    "additionalProperties",
  ]);

  for (const [key, value] of Object.entries(schema)) {
    if (supportedKeys.has(key)) {
      result[key] = value;
    }
    // Silently strip unsupported keys like minimum, maximum, pattern, etc.
  }

  if (result.type === "object" && result.properties) {
    // Strict mode: all properties must be required
    result.required = Object.keys(result.properties);
    result.additionalProperties = false;

    // Recursively process nested properties
    const newProps: Record<string, any> = {};
    for (const [key, value] of Object.entries(
      result.properties as Record<string, JsonSchema>
    )) {
      newProps[key] = prepareSchemaForStrictMode(value);
    }
    result.properties = newProps;
  }

  if (result.type === "array" && result.items) {
    result.items = prepareSchemaForStrictMode(result.items as JsonSchema);
  }

  if (result.anyOf) {
    result.anyOf = (result.anyOf as JsonSchema[]).map(
      prepareSchemaForStrictMode
    );
  }

  return result as JsonSchema;
}

export interface RunOptions {
  /** Override the OpenAI model (default: gpt-4o-mini) */
  model?: string;
  /** Enable verbose/debug logging */
  verbose?: boolean;
}

/**
 * Run a markdownlang program with the given input data.
 *
 * This sends the rendered markdown prompt to OpenAI and returns
 * structured JSON matching the program's output schema.
 */
export async function run(
  program: MarkdownlangProgram,
  input: Record<string, any>,
  options: RunOptions = {}
): Promise<any> {
  const model = options.model ?? "gpt-4o-mini";
  const client = new OpenAI();

  // Render template variables
  const prompt = renderTemplate(program.body, input);

  // Prepare tools from imports (other markdownlang programs)
  const tools = await resolveImportedTools(program);

  const strictSchema = prepareSchemaForStrictMode(program.output);

  if (options.verbose) {
    console.error(`[markdownlang] Program: ${program.name}`);
    console.error(`[markdownlang] Model: ${model}`);
    console.error(`[markdownlang] Prompt:\n${prompt}\n`);
    console.error(
      `[markdownlang] Output schema: ${JSON.stringify(strictSchema, null, 2)}`
    );
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: [
        `You are executing a markdownlang program called "${program.name}".`,
        program.description,
        "Follow the instructions precisely and return the result as JSON matching the required output schema.",
        "Be precise and deterministic. Do not add extra commentary — just return valid JSON.",
      ].join(" "),
    },
    {
      role: "user",
      content: prompt,
    },
  ];

  // Agentic loop: handle tool calls if we have imported programs
  let maxIterations = 10;
  while (maxIterations-- > 0) {
    const response = await client.chat.completions.create({
      model,
      messages,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: program.name,
          schema: strictSchema,
          strict: true,
        },
      },
      ...(tools.length > 0 ? { tools } : {}),
    });

    const choice = response.choices[0];

    // If we get tool calls, execute them and loop
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      messages.push(choice.message);

      for (const toolCall of choice.message.tool_calls) {
        const toolResult = await executeToolCall(toolCall, program);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }
      continue;
    }

    // Otherwise, we have our final answer
    const content = choice.message.content;
    if (!content) {
      throw new Error("No response content from OpenAI");
    }

    const result = JSON.parse(content);

    if (options.verbose) {
      console.error(
        `[markdownlang] Result: ${JSON.stringify(result, null, 2)}`
      );
    }

    return result;
  }

  throw new Error("Agentic loop exceeded maximum iterations");
}

/**
 * Resolve imported markdownlang programs into OpenAI tool definitions.
 */
async function resolveImportedTools(
  program: MarkdownlangProgram
): Promise<OpenAI.Chat.Completions.ChatCompletionTool[]> {
  if (!program.imports || program.imports.length === 0) return [];

  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [];

  for (const importPath of program.imports) {
    const imported = parse(importPath);
    tools.push({
      type: "function",
      function: {
        name: imported.name,
        description: imported.description,
        parameters: prepareSchemaForStrictMode(imported.input),
      },
    });
  }

  return tools;
}

/**
 * Execute a tool call by running the corresponding imported markdownlang program.
 */
async function executeToolCall(
  toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
  parentProgram: MarkdownlangProgram
): Promise<any> {
  if (!parentProgram.imports) {
    throw new Error(`No imports defined but tool call received: ${toolCall.function.name}`);
  }

  // Find the imported program matching this tool name
  for (const importPath of parentProgram.imports) {
    const imported = parse(importPath);
    if (imported.name === toolCall.function.name) {
      const input = JSON.parse(toolCall.function.arguments);
      return run(imported, input);
    }
  }

  throw new Error(`Unknown tool: ${toolCall.function.name}`);
}
