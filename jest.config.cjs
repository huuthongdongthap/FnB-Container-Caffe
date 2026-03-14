/**
 * Jest Configuration for F&B Caffe Container
 */
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  transform: {},
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  collectCoverageFrom: [
    '*.js',
    'public/**/*.js',
    'dashboard/**/*.js',
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
