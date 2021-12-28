module.exports = {
  env: {
    jest: true,
    node: true,
  },
  plugins: ['@typescript-eslint', 'import', 'jest'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: '2018',
    sourceType: 'module',
    project: 'typescript.eslintrc.json',
  },
  extends: ['plugin:import/typescript', 'plugin:jest/recommended'],
  settings: {
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
    'import/resolver': {
      node: {},
      typescript: {
        directory: './tsconfig.json',
      },
    },
  },
  ignorePatterns: ['*.js', '*.d.ts', 'node_modules/', '*.generated.ts'],
  rules: {
    '@typescript-eslint/no-require-imports': ['error'],
    '@typescript-eslint/indent': ['error', 2],

    quotes: ['error', 'single', { avoidEscape: true }],
    'comma-dangle': ['error', 'only-multiline'],
    'comma-spacing': ['error', { before: false, after: true }],
    'no-multi-spaces': ['error', { ignoreEOLComments: false }],
    'array-bracket-spacing': ['error', 'never'],
    'array-bracket-newline': ['error', 'consistent'],
    'object-curly-spacing': ['error', 'always'],
    'object-curly-newline': ['error', { multiline: true, consistent: true }],
    'object-property-newline': [
      'error',
      { allowAllPropertiesOnSameLine: true },
    ],
    'keyword-spacing': ['error'],
    'brace-style': ['error', '1tbs', { allowSingleLine: true }],
    'space-before-blocks': 'error',
    curly: ['error', 'multi-line', 'consistent'],
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: ['**/__tests__/**'],
        optionalDependencies: false,
        peerDependencies: false,
      },
    ],

    'import/no-unresolved': ['error'],

    'import/order': [
      'warn',
      {
        groups: ['builtin', 'external'],
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],

    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'punycode',
            message: `Package 'punycode' has to be imported with trailing slash, see warning in https://github.com/bestiejs/punycode.js#installation`,
          },
        ],
        patterns: ['!punycode/'],
      },
    ],

    'no-duplicate-imports': ['error'],

    'no-shadow': ['off'],
    '@typescript-eslint/no-shadow': ['error'],

    'key-spacing': ['error'],

    semi: ['error', 'always'],

    'quote-props': ['error', 'as-needed'],

    'no-multiple-empty-lines': ['error'],

    'max-len': [
      'error',
      {
        code: 150,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreComments: true,
        ignoreRegExpLiterals: true,
      },
    ],

    '@typescript-eslint/no-floating-promises': ['error'],

    'no-return-await': 'off',
    '@typescript-eslint/return-await': 'error',

    'no-console': ['error'],

    'no-trailing-spaces': ['error'],

    'dot-notation': ['error'],

    'no-bitwise': ['error'],

    '@typescript-eslint/member-ordering': [
      'error',
      {
        default: [
          'public-static-field',
          'public-static-method',
          'protected-static-field',
          'protected-static-method',
          'private-static-field',
          'private-static-method',
          'field',
          'constructor',
          'method',
        ],
      },
    ],

    'jest/no-disabled-tests': 'warn',
    'jest/no-focused-tests': 'error',
    'jest/no-identical-title': 'error',
    'jest/prefer-to-have-length': 'warn',
    'jest/valid-expect': 'error',
  },
};
