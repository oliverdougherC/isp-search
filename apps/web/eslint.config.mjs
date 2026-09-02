import nextPlugin from '@next/eslint-plugin-next';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';

import rootConfig from '../../eslint.config.mjs';

/**
 * The Next.js plugin is used directly (not via eslint-config-next) because the root config
 * already registers typescript-eslint; eslint-config-next would register a second instance.
 */
export default defineConfig([
  ...rootConfig,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: { '@next/next': nextPlugin, 'react-hooks': reactHooks },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...reactHooks.configs.recommended.rules,
    },
  },
  globalIgnores(['.next/**', 'out/**', 'next-env.d.ts']),
]);
