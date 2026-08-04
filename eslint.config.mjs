import { readFileSync } from "node:fs";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const US_WORDS = JSON.parse(
  readFileSync(new URL("./scripts/uk-english-wordlist.json", import.meta.url), "utf8"),
);

// Words that are legitimate code values (CSS keywords, property names)
// and must only be flagged in comments, never in string literals.
const STRING_SAFE_WORDS = new Set(["center", "centered", "centers", "centering", "color", "colors", "colored"]);
// Proper nouns that are legitimately capitalised in UK English too
// (e.g. the schema.org "Organization" JSON-LD type).
const PROPER_NOUNS = new Set(["Organization"]);

function checkWords(text, node, context, inString) {
  if (!text) return;
  const activeWords = US_WORDS.filter((w) => !(inString && STRING_SAFE_WORDS.has(w)));
  for (const word of activeWords) {
    const regex = new RegExp(`(?<![\\w/-])${word}(?![\\w-])`, "i");
    const matches = text.split("`").filter((_, i) => i % 2 === 0);
    if (matches.some((seg) => regex.test(seg) && !PROPER_NOUNS.has(seg.match(regex)?.[0] ?? ""))) {
      context.report({
        node,
        messageId: "usEnglish",
        data: { word },
      });
    }
  }
}

const noEmDash = {
  meta: {
    type: "problem",
    docs: { description: "Disallow em dashes (U+2014) anywhere in the file." },
    messages: {
      emDash:
        "Em dash (\u2014) is banned. Use a hyphen, colon, period or comma instead.",
    },
  },
  create(context) {
    return {
      "Program:exit"(node) {
        const sourceCode = context.sourceCode;
        const text = sourceCode.getText();
        let idx = text.indexOf("\u2014");
        while (idx !== -1) {
          const start = sourceCode.getLocFromIndex(idx);
          const end = sourceCode.getLocFromIndex(idx + 1);
          context.report({ node, loc: { start, end }, messageId: "emDash" });
          idx = text.indexOf("\u2014", idx + 1);
        }
      },
    };
  },
};

const ukEnglish = {
  meta: {
    type: "problem",
    docs: { description: "Enforce UK English spelling in comments and string literals." },
    messages: {
      usEnglish:
        "US English spelling '{{word}}'. Use the UK English spelling instead.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      Literal(node) {
        if (typeof node.value === "string") checkWords(node.value, node, context, true);
      },
      TemplateElement(node) {
        checkWords(node.value.raw, node, context, true);
      },
      JSXText(node) {
        checkWords(node.value, node, context, true);
      },
      JSXAttribute(node) {
        const value = node.value;
        if (value && typeof value.value === "string") {
          checkWords(value.value, node, context, true);
        }
      },
      "Program:exit"() {
        for (const comment of sourceCode.getAllComments()) {
          checkWords(comment.value, comment, context, false);
        }
      },
    };
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      "jsc-conventions": {
        rules: { "no-em-dash": noEmDash, "uk-english": ukEnglish },
      },
    },
    rules: {
      "jsc-conventions/no-em-dash": "error",
      "jsc-conventions/uk-english": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
