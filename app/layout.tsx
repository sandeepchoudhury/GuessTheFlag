import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { isLocale, LOCALE_COOKIE } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Guess the Flag',
  description: 'Test your knowledge of world flags!',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const langCookie = cookies().get(LOCALE_COOKIE)?.value;
  const lang = isLocale(langCookie) ? langCookie : 'en';

  return (
    <html lang={lang}>
      <body>{children}</body>
    </html>
  );
}
