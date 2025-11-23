module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended'
  ],
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 12,
    sourceType: 'module'
  },
  plugins: [
    'react',
    'react-hooks'
  ],
  rules: {
    // General rules
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-arrow-callback': 'error',

    // React specific rules
    'react/prop-types': 'off', // We don't use prop-types in this project
    'react/react-in-jsx-scope': 'off', // React is globally available
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // Electron/Node specific
    'no-undef': 'off', // Electron provides global objects

    // Allow specific patterns for this project
    'no-restricted-globals': 'off', // Allow window/document in renderer
  },
  settings: {
    react: {
      version: '18.0'
    }
  },
  overrides: [
    // Main process files (Electron main)
    {
      files: ['main.js', 'preload.js'],
      env: {
        node: true,
        browser: false
      },
      rules: {
        'no-console': 'warn' // Warn about console usage in main process
      }
    },
    // Renderer process files (React)
    {
      files: ['src/**/*.js', 'renderer.js'],
      env: {
        browser: true,
        node: false
      },
      rules: {
        'react/react-in-jsx-scope': 'off' // React is globally available via CDN
      }
    }
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    '*.min.js',
    'package-lock.json'
  ]
};