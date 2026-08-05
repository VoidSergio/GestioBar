import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // L'app deve essere leggera: gira su telefoni datati dietro un banco.
  // Vedi 03-ARCHITETTURA.md §7 — bundle iniziale sotto i 200 KB compressi.
  experimental: {
    optimizePackageImports: ['@tanstack/react-query'],
  },

  typescript: {
    // Nessuna scorciatoia: un errore di tipo su un importo è un errore contabile.
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
