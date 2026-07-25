import { baseConfig } from "@medivi/config/eslint/base";

export default [
  ...baseConfig,
  {
    ignores: ["migrations/**"],
  },
];
