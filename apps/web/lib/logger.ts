import "server-only";
import pino from "pino";

import { env } from "./env";

/**
 * Pretty-printed in dev (readable in the terminal), plain JSON in
 * production (so it's ingestible by a log aggregator) — never the reverse,
 * since pino-pretty's formatting cost isn't worth paying on a prod server.
 */
export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  transport:
    env.NODE_ENV === "production"
      ? undefined
      : { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } },
});
