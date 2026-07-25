import path from "node:path";
import { config } from "dotenv";

/**
 * `dotenv/config`'s default `path` is resolved from `process.cwd()`, which
 * breaks the moment these scripts run with a cwd other than the monorepo
 * root (e.g. `pnpm run` from inside packages/db). Resolve relative to this
 * file's own location instead, which is stable regardless of invocation cwd.
 */
config({ path: path.resolve(__dirname, "../../../../.env") });
