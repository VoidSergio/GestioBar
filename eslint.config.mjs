import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescriptConfig from 'eslint-config-next/typescript';

/**
 * ESLint 9 in configurazione "flat".
 * Da Next 16 `eslint-config-next` esporta direttamente i config flat:
 * non serve più FlatCompat, che con questa versione va in errore.
 */
const eslintConfig = [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },

  ...coreWebVitals,
  ...typescriptConfig,

  {
    rules: {
      // Regole non negoziabili di CLAUDE.md
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  {
    // Gli script di controllo girano in Node e possono stampare a video.
    files: ['scripts/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },
];

export default eslintConfig;
