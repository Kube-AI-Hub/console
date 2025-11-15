import globals from 'globals'
import airbnbBase from 'eslint-config-airbnb-base'
import prettierConfig from 'eslint-config-prettier'
import prettierPlugin from 'eslint-plugin-prettier'
import babelPlugin from '@babel/eslint-plugin'
import babelParser from '@babel/eslint-parser'
import promisePlugin from 'eslint-plugin-promise'
import reactPlugin from 'eslint-plugin-react'

export default [
  {
    files: ['**/*.{js,jsx}'],
    ignores: [
      'locales/**',
      'scripts/**',
      'node_modules/**',
      'build/**',
      'dist/**',
      'cypress/**',
      'eslint.config.js',
      'babel.config.js',
      'jest.config.js',
      '**/webpack.*.js',
    ],
    // add your custom rules here
    rules: {
      // allow paren-less arrow functions
      'arrow-parens': 0,
      'import/no-extraneous-dependencies': 0,
      'import/no-dynamic-require': 0,
      'import/no-cycle': 0,
      // allow async-await
      'generator-star-spacing': 0,
      // allow debugger during development
      'no-debugger': process.env.NODE_ENV === 'production' ? 2 : 0,
      'global-require': 0,
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'dot-notation': 0,
      'no-underscore-dangle': 0,
      'no-param-reassign': 0,
      '@babel/no-unused-expressions': 'error',
      'no-mixed-operators': 0,
      'no-return-await': 0,
      'no-restricted-syntax': 0,
      'no-await-in-loop': 0,
      'no-restricted-globals': 0,
      'no-empty': [
        2,
        {
          allowEmptyCatch: true,
        },
      ],
      camelcase: 0,
      'max-len': [
        1,
        {
          code: 100,
          tabWidth: 2,
          ignoreUrls: true,
          ignoreComments: true,
          ignoreRegExpLiterals: true,
          ignoreTrailingComments: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignorePattern: "^(\\s*[a-zA-Z_]+: '[^']+'[,;]*)|(.*require.*)$",
        },
      ],
      'import/prefer-default-export': 0,
      'no-eval': 0,
      'no-plusplus': 0,
      'func-names': 0,
      'consistent-return': 0,
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'class-methods-use-this': 0,
      'no-nested-ternary': 0,
      'no-use-before-define': 0,
      'prefer-destructuring': 0,
      'max-classes-per-file': 0,
      'prefer-promise-reject-errors': 0,
    },
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
          modules: true,
          legacyDecorators: true,
        },
        globals: {
          ...globals.browser,
          ...globals.node,
          ...globals.jest,
          ...globals.commonjs,
        },
      },
    },
    ...airbnbBase,
    ...prettierConfig,
    ...prettierPlugin,
    plugins: {
      prettier: prettierPlugin,
      babel: babelPlugin,
      promise: promisePlugin,
      react: reactPlugin,
    },

    // check if imports actually resolve
    settings: {
      'import/resolver': {
        webpack: {
          config: 'scripts/webpack.base.js',
        },
      },
    },
  },
]
