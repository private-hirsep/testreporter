import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import vue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "**/dist/**",
      "**/dist-ts/**",
      "**/coverage/**",
      "**/node_modules/**",
      ".quality-report-summary/**",
      "dist/**",
      "eslint.config.js"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs["flat/recommended"],
  prettier,
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: globals.browser
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "vue/multi-word-component-names": "off"
    }
  },
  {
    files: ["scripts/**/*.mjs", "*.config.js"],
    languageOptions: {
      globals: globals.node
    }
  },
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
        sourceType: "module"
      },
      globals: globals.browser
    },
    rules: {
      "vue/multi-word-component-names": "off"
    }
  }
];
