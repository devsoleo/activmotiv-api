import js from '@eslint/js'
import globals from 'globals'

export default [
  js.configs.recommended,
  {
    ignores: ['dist/**', 'build/**', 'coverage/**', 'node_modules/**', 'public/**']
  },
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'after-used', ignoreRestSiblings: true }]
    }
  }
]