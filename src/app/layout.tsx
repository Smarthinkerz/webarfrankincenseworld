import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AR Vision Studio',
  description: 'Enterprise WebAR studio with Supabase-backed CMS, live preview, and multilingual front page.',
  manifest: '/manifest.webmanifest'
};

export const viewport: Viewport = {
  themeColor: '#070812',
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
