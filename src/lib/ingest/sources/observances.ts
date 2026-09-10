/**
 * `observances` adapter entry point. The implementation lives in ./observances/adapter.ts so the
 * helper directory of the same name resolves to the same module under both resolvers: bundlers
 * pick this file for `./observances`, Node ESM (tsx, `npm run ingest`) picks
 * ./observances/index.ts — both re-export the one adapter module.
 */
export * from "./observances/adapter";
// Explicit named export: Node's CJS lexer cannot see `export *` re-exports, so a static ESM
// `import { adapter } from ".../observances"` (tsx .mts probes) needs this line.
export { adapter } from "./observances/adapter";
