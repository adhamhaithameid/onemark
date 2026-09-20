import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://adhamhaithameid.github.io/onemark/'),
  title: {
    default: 'OneMark — GitHub-identical Markdown, offline',
    template: '%s · OneMark',
  },
  description:
    'The GitHub Flavored Markdown rendering you trust, shipped to every device — one engine, six platforms, zero servers, and a test suite that proves it.',
  keywords: ['markdown', 'gfm', 'github', 'offline', 'renderer', 'editor'],
  openGraph: {
    title: 'OneMark — GitHub-identical Markdown, offline',
    description: 'Verified against GitHub\u2019s own renderer. One engine, six platforms, zero servers.',
    url: 'https://adhamhaithameid.github.io/onemark/',
    siteName: 'OneMark',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
