// The example REVIEW.md from code.claude.com/docs/en/code-review-customize, word for word.
// Shown in a browser by the `reviewmd` visual; `marks` pick lines from it by their text.
export const REVIEW_MD: { kind: "h1" | "h2" | "p" | "li"; text: string }[] = [
  { kind: "h1", text: "Review instructions" },
  { kind: "h2", text: "What Important means here" },
  { kind: "p", text: "Reserve Important for findings that would break behavior, leak data, or block a rollback: incorrect logic, unscoped database queries, PII in logs or error messages, and migrations that aren't backward compatible. Style, naming, and refactoring suggestions are Nit at most." },
  { kind: "h2", text: "Cap the nits" },
  { kind: "p", text: "Report at most five Nits per review." },
  { kind: "h2", text: "Do not report" },
  { kind: "li", text: "Anything CI already enforces: lint, formatting, type errors" },
  { kind: "li", text: "Generated files under `src/gen/` and any `*.lock` file" },
  { kind: "li", text: "Test-only code that intentionally violates production rules" },
  { kind: "h2", text: "Always check" },
  { kind: "li", text: "New API routes have an integration test" },
  { kind: "li", text: "Log lines don't include email addresses, user IDs, or request bodies" },
  { kind: "li", text: "Database queries are scoped to the caller's tenant" },
];
export const reviewLine = (text: string) => REVIEW_MD.findIndex((b) => b.text === text);
