/**
 * Minimal ESLint config.
 *
 * Deliberately narrow: it enables ONE rule, react-hooks/rules-of-hooks, because
 * that rule catches a class of bug this project has actually shipped. A hook
 * call that lands outside a component body builds cleanly, passes `vite build`,
 * and then white-screens the admin panel at runtime with
 * "Cannot read properties of null (reading 'useState')".
 *
 * Style rules are left off on purpose. Turning on a full preset across a
 * codebase this size would bury the one rule that matters under thousands of
 * formatting complaints, and a lint step people ignore is worse than none.
 */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['react-hooks'],
  rules: {
    'react-hooks/rules-of-hooks': 'error',
  },
  overrides: [
    {
      // The backend is CommonJS. Note "./*.js" rather than "*.js": in ESLint an
      // override pattern with no slash matches a BASENAME at any depth, so
      // "*.js" would drag every frontend ESM file in here too.
      files: ['backend/**/*.js', 'scripts/**/*.js', './*.js'],
      env: { browser: false },
      parserOptions: { sourceType: 'script' },
      rules: { 'react-hooks/rules-of-hooks': 'off' },
    },
    {
      // Written with ESM `import` despite living in the CommonJS backend, and
      // imported by nothing — requiring it would throw. Parsed as a module here
      // so lint reports what it is rather than failing on it; the file itself
      // is pre-existing and left alone.
      files: ['backend/routes/emailSendRoute.js'],
      parserOptions: { sourceType: 'module' },
    },
  ],
};
