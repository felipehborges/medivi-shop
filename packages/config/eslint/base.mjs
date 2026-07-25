// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Shared base rules for every package/app in the monorepo.
 * Consumers spread this array and layer framework-specific config on top
 * (e.g. apps/web adds `eslint-config-next`).
 */
export const baseConfig = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "warn",
    },
  },
);

export default baseConfig;
