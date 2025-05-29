export default {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'relay-server/**/*.js',
    '!relay-server/tests/**',
    '!relay-server/**/*.test.js'
  ],
  testMatch: [
    '**/__tests__/**/*.mjs',
    '**/?(*.)+(spec|test).mjs'
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(ws|uuid)/)'
  ],
  transform: {
    '^.+\\.m?js$': ['babel-jest', { configFile: './babel.config.js' }]
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  }
}; 