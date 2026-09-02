import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
  title: 'The Bugs on the Table — Qualidade & Produto',
  description: 'Reports, testes, correções e versões do U+ em um único lugar.',
  icons: { icon: '/brand/bugs-on-the-table-logo.png', shortcut: '/brand/bugs-on-the-table-logo.png' },
  openGraph: {
    title: 'The Bugs on the Table — Qualidade & Produto',
    description: 'Reports, testes e correções em um só lugar.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'The Bugs on the Table' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Bugs on the Table — Qualidade & Produto',
    description: 'Reports, testes e correções em um só lugar.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body></html>;
}
