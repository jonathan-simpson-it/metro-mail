#!/usr/bin/env node
/**
 * Repo-wide text conventions guard. Runs as part of `npm run lint`.
 *
 * 1. Em dashes (U+2014) are banned in every text file.
 * 2. US English spellings are banned in docs (.md), env templates and
 *    CSS files. JS/TS comments and string literals are covered by the
 *    ESLint rules in eslint.config.mjs (jsc-conventions/no-em-dash and
 *    jsc-conventions/uk-english).
 *
 * Exits non-zero and lists every offending file/line.
 */
import { readdirSync, readFileSync } from "node:fs";
import { extname, basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "out", "build", ".vercel"]);
const SKIP_FILES = new Set(["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "tsconfig.tsbuildinfo"]);
const BINARY_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".avif", ".woff", ".woff2", ".ttf", ".eot", ".svg"]);
const PROSE_EXT = new Set([".md", ".css", ".txt"]);
const STRING_SAFE_WORDS = new Set(["center", "centered", "centers", "centering"]);
// Proper nouns that are legitimately capitalised in UK English too
// (e.g. the schema.org "Organization" JSON-LD type).
const PROPER_NOUNS = new Set(["Organization"]);

const US_WORDS = JSON.parse(
  readFileSync(new URL("./uk-english-wordlist.json", import.meta.url), "utf8"),
);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, out);
    } else if (!SKIP_FILES.has(entry.name) && !BINARY_EXT.has(extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

function findLines(text, regex) {
  const lines = [];
  const parts = text.split("\n");
  for (let i = 0; i < parts.length; i++) {
    const match = parts[i].match(regex);
    if (match && !PROPER_NOUNS.has(match[0])) {
      lines.push({ line: i + 1, text: parts[i].trim(), word: match[0] });
    }
  }
  return lines;
}

/** True when any prose segment (outside inline `code spans`) matches. */
function proseMatches(line, regex) {
  const segments = line.split("`");
  for (let i = 0; i < segments.length; i += 2) {
    const match = segments[i].match(regex);
    if (match && !PROPER_NOUNS.has(match[0])) return true;
  }
  return false;
}

const files = walk(ROOT);
const violations = [];

for (const file of files) {
  const rel = file.slice(ROOT.length);
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  if (text.includes("\u2014")) {
    violations.push(`EM DASH: ${rel} (lines ${findLines(text, /\u2014/g).map((l) => l.line).join(", ")})`);
  }

  const isEnv = basename(file) === ".env.example";
  const isCss = extname(file) === ".css";
  const isProse = PROSE_EXT.has(extname(file)) || isEnv;
  if (isProse) {
    const activeWords = US_WORDS.filter((w) => !(isCss && STRING_SAFE_WORDS.has(w)));
    // In CSS, prose lives only in /* comments */. Blank out declarations
    // (preserving newlines so reported line numbers match the file).
    let scanText = text;
    if (isCss) {
      let out = "";
      let i = 0;
      while (i < text.length) {
        const start = text.indexOf("/*", i);
        if (start === -1) {
          out += text.slice(i).replace(/[^\n]/g, " ");
          break;
        }
        const end = text.indexOf("*/", start + 2);
        if (end === -1) {
          out += text.slice(i).replace(/[^\n]/g, " ");
          break;
        }
        out += text.slice(i, start).replace(/[^\n]/g, " ");
        out += text.slice(start, end + 2);
        i = end + 2;
      }
      scanText = out;
    }
    const lines = scanText.split("\n");
    for (const word of activeWords) {
      const regex = new RegExp(`(?<![\\w/-])${word}(?![\\w-])`, "i");
      for (let i = 0; i < lines.length; i++) {
        if (proseMatches(lines[i], regex)) {
          violations.push(
            `US ENGLISH: ${rel}:${i + 1}: "${lines[i].trim()}" (use UK spelling of "${word}")`,
          );
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Text conventions violated:");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log("Text conventions OK (no em dashes, no US English in docs/CSS).");
