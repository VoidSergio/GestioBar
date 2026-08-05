import type { Metadata, Viewport } from 'next';
import { ProviderDati } from '@/components/shell/provider-dati';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gestionale Bar',
  description: 'Conti aperti e clienti a credito, dal telefono.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icone/icona-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icone/icona-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icone/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Bar',
  },
  formatDetection: {
    // Impedisce a iOS di trasformare gli importi in numeri di telefono.
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  // Niente zoom: l'app deve stare in una schermata, non essere pizzicata.
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="min-h-full antialiased">
        <ProviderDati>{children}</ProviderDati>
      </body>
    </html>
  );
}
