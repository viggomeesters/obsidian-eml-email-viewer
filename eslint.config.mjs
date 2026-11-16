// Required ESLint flat-config interface for the official Obsidian checker.
import obsidianmd from "eslint-plugin-obsidianmd";
export default [
  { ignores: ["node_modules/**", "main.js", "esbuild.config.mjs", "version-bump.mjs", "eslint.config.mjs", "scripts/**", "test-fixtures/**", "fixtures/**", "dist-test/**", "tests/**", "test/**"] },
  ...obsidianmd.configs.recommended,
  { files: ["**/*.ts"], languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } } },
];
