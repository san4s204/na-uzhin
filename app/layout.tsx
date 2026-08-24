import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'На ужин — выбираем вместе',
  description: 'Тёплый и простой способ решить, что приготовить на ужин.',
  openGraph: {
    title: 'Ну что на ужин?',
    description: 'Выбираем вместе — без бесконечных переговоров.',
    images: [{ url: '/og.png', width: 1536, height: 1024, alt: 'Ну что на ужин? Выбираем вместе' }],
    locale: 'ru_RU',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ну что на ужин?',
    description: 'Выбираем вместе — без бесконечных переговоров.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}

