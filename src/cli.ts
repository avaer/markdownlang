#!/usr/bin/env node

import { Command } from "commander";
import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";
import { parse } from "./parser.js";
import { run } from "./runner.js";
import { compile } from "./compiler.js";

// Load .env.local (look in cwd first, then script directory)
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const program = new Command();

program
  .name("markdownlang")
  .description(
    "An AI-native programming environment where markdown files are executable programs"
  )
  .version("0.1.0");

// ── markdownlang run ───────────────────────────────────────

program
  .command("run")
  .description("Run a markdownlang program")
  .argument("<file>", "Path to a .mdlang file")
  .option("-i, --input <json>", "Input data as a JSON string", "{}")
  .option(
    "-m, --model <model>",
    "OpenAI model to use",
    "gpt-4o-mini"
  )
  .option("-v, --verbose", "Enable verbose/debug output")
  .action(async (file: string, opts: { input: string; model: string; verbose?: boolean }) => {
    try {
      const prog = parse(file);

      let input: Record<string, any>;
      try {
        input = JSON.parse(opts.input);
      } catch {
        console.error("Error: --input must be valid JSON");
        process.exit(1);
      }

      // Validate input against schema (basic check)
      if (prog.input.required) {
        for (const field of prog.input.required) {
          if (!(field in input)) {
            console.error(`Error: missing required input field "${field}"`);
            console.error(
              `Required fields: ${prog.input.required.join(", ")}`
            );
            process.exit(1);
          }
        }
      }

      const result = await run(prog, input, {
        model: opts.model,
        verbose: opts.verbose,
      });

      console.log(JSON.stringify(result, null, 2));
    } catch (err: any) {
      console.error(`Error: ${err.message ?? err}`);
      process.exit(1);
    }
  });

// ── markdownlang compile ──────────────────────────────────

program
  .command("compile")
  .description("Compile a markdownlang program to TypeScript")
  .argument("<file>", "Path to a .mdlang file")
  .option(
    "-o, --output <file>",
    "Output file path (defaults to <name>.ts)"
  )
  .action(async (file: string, opts: { output?: string }) => {
    try {
      const prog = parse(file);
      const tsCode = compile(prog);

      const outputPath =
        opts.output ?? `${prog.name}.ts`;

      fs.writeFileSync(outputPath, tsCode, "utf-8");
      console.log(`Compiled ${file} → ${outputPath}`);
    } catch (err: any) {
      console.error(`Error: ${err.message ?? err}`);
      process.exit(1);
    }
  });

// ── markdownlang parse ────────────────────────────────────

program
  .command("parse")
  .description("Parse and display the structure of a markdownlang program")
  .argument("<file>", "Path to a .mdlang file")
  .action((file: string) => {
    try {
      const prog = parse(file);
      console.log(JSON.stringify(prog, null, 2));
    } catch (err: any) {
      console.error(`Error: ${err.message ?? err}`);
      process.exit(1);
    }
  });

program.parse();
