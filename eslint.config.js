export default [
  {
    files: ["**/*.js"],
    ignores: ["**/__tests__/**"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          decorators: true
        }
      },
      globals: {
        console: "readonly",
        window: "readonly",
        document: "readonly",
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        global: "readonly"
      }
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": "warn",
      "no-undef": "error",
      semi: ["error", "always"],
      quotes: ["error", "single"],
      indent: ["error", 4]
    }
  },
  {
    files: ["**/__tests__/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        window: "readonly",
        document: "readonly",
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        global: "readonly",
        // Jest globals
        jest: "readonly",
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        test: "readonly",
        process: "readonly",
        MessageEvent: "readonly"
      }
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": "warn",
      "no-undef": "error"
    }
  }
];
