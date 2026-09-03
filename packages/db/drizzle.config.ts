import "./src/lib/load-env";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    url:
      process.env.MEDIVI_DATABASE_URL ??
      process.env.DATABASE_URL ??
      "postgresql://medivi:medivi@localhost:5432/medivi_shop",
  },
});
