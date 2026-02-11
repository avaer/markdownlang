# markdownlang

An experimental implementation of [markdownlang](https://xeiaso.net/blog/2026/markdownlang/), the "last programming language" concept proposed by Xe Iaso. In markdownlang, markdown files *are* the programs — YAML frontmatter defines typed input/output schemas, and the markdown body is the executable prompt sent to an LLM with structured output.

This implementation was one-shotted by AI.

## How it works

A `.mdlang` file looks like this:

```markdown
---
name: fizzbuzz
description: FizzBuzz classic programming exercise
input:
  type: object
  properties:
    start:
      type: integer
    end:
      type: integer
  required: [start, end]
output:
  type: object
  properties:
    results:
      type: array
      items:
        type: string
  required: [results]
---

# FizzBuzz

For each number from {{ .start }} to {{ .end }}, output:

- "FizzBuzz" if divisible by both 3 and 5
- "Fizz" if divisible by 3
- "Buzz" if divisible by 5
- The number itself otherwise

Return the results as an array of strings.
```

The frontmatter declares the program's name, description, and strictly typed input/output JSON schemas. The body is a prompt template with Go-style `{{ .variable }}` substitution. At runtime, the rendered prompt is sent to OpenAI with structured output enforced by the output schema — so the result is always valid, typed JSON.

## CLI

### `markdownlang run`

Execute a markdownlang program:

```bash
npx tsx src/cli.ts run examples/fizzbuzz.mdlang --input '{"start": 1, "end": 15}'
```

Options:
- `-i, --input <json>` — Input data as JSON (default: `{}`)
- `-m, --model <model>` — OpenAI model (default: `gpt-4o-mini`)
- `-v, --verbose` — Debug output

### `markdownlang compile`

Translate a markdownlang program to standalone TypeScript:

```bash
npx tsx src/cli.ts compile examples/fizzbuzz.mdlang -o fizzbuzz.ts
```

The generated TypeScript is self-contained — it includes typed `Input`/`Output` interfaces, the prompt template, and a `run()` function that calls OpenAI directly.

### `markdownlang parse`

Inspect the parsed structure of a program:

```bash
npx tsx src/cli.ts parse examples/fizzbuzz.mdlang
```

## Setup

```bash
pnpm install
```

Create a `.env.local` with your OpenAI API key:

```
OPENAI_API_KEY=sk-...
```

## Examples

See the `examples/` directory:

- **fizzbuzz.mdlang** — The canonical example from Xe's blog post
- **greeting.mdlang** — Generates a personalized greeting in any language
- **summarize.mdlang** — Summarizes text into bullet points with a headline

## Key concepts

- **Your documentation is your code.** The markdown body is both human-readable documentation and the executable program.
- **Schemas are your types.** JSON Schema in the frontmatter enforces structured input and output, replacing traditional type systems.
- **Programs compose.** Markdownlang programs can import other programs as tools via the `imports` frontmatter field, enabling agentic tool-calling loops.
- **Compilation means translation.** `markdownlang compile` emits TypeScript that makes the same OpenAI API call — the "compiled" form is just a more traditional representation of the same program.

## License

MIT
