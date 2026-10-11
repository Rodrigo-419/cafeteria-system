import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettierConfig from 'eslint-config-prettier'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const localRulesPlugin = require('./tools/eslint-rules/index.cjs')

const reactHooksCfg =
  reactHooks.configs['recommended-latest'] ?? reactHooks.configs.recommended

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'tools', 'eslint.config.js'] },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      prettierConfig,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      '@local': localRulesPlugin,
    },
    rules: {
      ...reactHooksCfg.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@local/no-inline-style': 'error',
      '@local/no-hardcoded-color': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', disallowTypeAnnotations: false },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: [
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      'src/test/**/*.{ts,tsx}',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@local/no-hardcoded-color': 'off',
    },
  },
)
