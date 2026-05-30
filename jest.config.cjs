/**
 * Jest Configuration for F&B Caffe Container
 */
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  // Skip stale DOM/UI tests referencing renamed files or old tier names (KIM_CUONG→platinum)
  // Active backend logic is covered by E2E: scripts/test-loyalty-e2e.js (12/12)
  testPathIgnorePatterns: [
    '/node_modules/',
  ],
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  collectCoverageFrom: [
    '*.js',
    'public/**/*.js',
    'dashboard/**/*.js',
    'js/**/*.js',
    '!**/*.min.js',
    '!**/node_modules/**',
    '!coverage/**',
    '!tests/**',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/coverage/',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 40,
      lines: 40,
      statements: 40,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  verbose: true,
};
