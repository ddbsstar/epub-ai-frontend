import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import globals from 'globals'
import prettier from 'eslint-config-prettier'

export default defineConfig([
  globalIgnores(['dist/**', 'node_modules/**', 'coverage/**']),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
      globals: { ...globals.browser, ...globals.node },
    },
    rules: { '@typescript-eslint/consistent-type-imports': 'error' },
  },
  prettier,
])
