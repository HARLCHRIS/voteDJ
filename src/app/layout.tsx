import type { Metadata, Viewport } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800', '900'],
  variable: '--font-montserrat',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'DJ Challenge – Eat & Drink Festival Cotonou 2027',
  description:
    'Plateforme officielle de notation en direct du DJ Challenge – Eat & Drink Festival Cotonou 2027 (Days Party).',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#063B1B',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={montserrat.variable}>
      <body className="min-h-screen poster-bg text-white antialiased selection:bg-[#76E000] selection:text-[#063B1B]">
        {children}
      </body>
    </html>
  );
}

