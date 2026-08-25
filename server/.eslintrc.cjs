module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: { project: "./tsconfig.json", sourceType: "module" },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  env: { node: true, es2022: true },
  rules: {
    "no-console": ["error", { allow: ["error"] }],
    eqeqeq: ["error", "always"],
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-non-null-assertion": "error",
  },
  ignorePatterns: ["dist", "node_modules"],
};
