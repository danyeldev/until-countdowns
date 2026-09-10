export * from "./adapter";
// Explicit named export: Node's CJS lexer cannot see `export *` re-exports, so a static ESM
// `import { adapter } from ".../observances"` (tsx .mts probes) needs this line.
export { adapter } from "./adapter";
