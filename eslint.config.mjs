import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

export default defineConfig([
  ...nextVitals,
  {
    // Site code ships to browsers; the scripts in /scripts are allowed to log.
    files: ['src/**/*.{js,jsx}'],
    rules: { 'no-console': 'error' },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**']),
])
