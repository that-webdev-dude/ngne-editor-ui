import { fileURLToPath } from "node:url";
import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";
import { layerImports } from "./eslint/layer-imports.js";

const srcDir = fileURLToPath(new URL("src/", import.meta.url));

export default defineConfig(
    {
        ignores: ["dist", "node_modules", "test-results", "playwright-report", "coverage"],
    },
    js.configs.recommended,
    tseslint.configs.recommended,
    {
        files: ["**/*.{ts,tsx}"],
        plugins: { "react-hooks": reactHooks },
        rules: {
            ...reactHooks.configs.recommended.rules,
            "@typescript-eslint/consistent-type-imports": "error",
        },
    },
    {
        files: ["*.config.{js,ts}", "eslint/**", "scripts/**", "tests/**"],
        languageOptions: { globals: globals.node },
    },
    // The layer import table (SPEC §1.1).
    {
        files: ["src/**/*.{ts,tsx}"],
        plugins: { ngne: { rules: { "layer-imports": layerImports } } },
        rules: { "ngne/layer-imports": ["error", { srcDir }] },
    },
);
