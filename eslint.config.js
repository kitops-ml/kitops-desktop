import path from 'node:path'
import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import { includeIgnoreFile } from '@eslint/compat'
import globals from 'globals'
import stylistic from '@stylistic/eslint-plugin'
import simpleImportSort from "eslint-plugin-simple-import-sort";

import vue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const gitignorePath = path.resolve(__dirname, '.gitignore')

export default [
  // ignore anything in the .gitignore file, and some other custom file entries
  includeIgnoreFile(gitignorePath),
  { ignores: ['dist/', 'dist-electron/', 'node_modules/'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],

  {
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      '@stylistic': stylistic,
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      // Formatting
      '@stylistic/semi': ['error', 'never'],
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
      '@stylistic/indent': ['error', 2],
      '@stylistic/brace-style': ['error', '1tbs'],
      '@stylistic/operator-linebreak': ['error', 'before'],
      'vue/block-order': ['error', {
        order: ['script', 'template', 'style']
      }],

      // Linting
      curly: 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      'no-console': 'warn',
      // 'sort-imports': ['error', {
      //   ignoreCase: true,
      //   ignoreDeclarationSort: false,
      //   ignoreMemberSort: false,
      //   allowSeparatedGroups: true,
      // }],
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',

      // Relax some defaults
      '@typescript-eslint/no-require-imports': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-closing-bracket-spacing': 'error',
      'vue/html-closing-bracket-newline': ['error', {
        singleline: 'never',
        multiline: 'never',
      }],
      'no-console': 'off',
      'vue/html-self-closing': 'off',
      'vue/max-len': ['warn',
        {
          code: 120,
          ignoreUrls: true,
          ignoreStrings: true,
          template: 300,
          comments: 200,
        },
      ],
      'vue/no-v-html': 'off'
    },
  },

  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },

  {
    files: ['electron/**/*.{js,cjs}', 'bin/**/*.{js,cjs}', 'scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'error',
    },
  },
]
