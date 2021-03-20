'use strict';

module.exports = {
  ignorePatterns: ['dist/'],
  env: {
    node: true,
  },
  extends: [
    'airbnb-base',
  ],
  overrides: [{
    files: ['*.js'],
    parserOptions: {
      sourceType: 'script',
    },
  }, {
    files: ['src/**/*.ts'],
    extends: [
      'plugin:@typescript-eslint/recommended',
      'plugin:@typescript-eslint/recommended-requiring-type-checking',
      'plugin:import/errors',
      'plugin:import/warnings',
      'plugin:import/typescript',
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
      project: 'tsconfig.json',
    },
    plugins: [
      '@typescript-eslint',
    ],
    rules: {
      'import/extensions': 'off',
      'import/order': ['error', {
        alphabetize: { order: 'asc' },
      }],
      'sort-imports': ['error', { ignoreDeclarationSort: true }],
    },
  }],
  rules: {
    'max-len': ['error', { code: 120 }],
    'no-console': 'off',
    strict: ['error', 'global'],
  },
};
