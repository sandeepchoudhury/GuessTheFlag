'use client';

import { useEffect, useState } from 'react';
import { getClientLocale, Locale, LOCALES, LOCALE_COOKIE, LOCALE_LABELS } from '@/lib/i18n';

export default function LanguageSwitcher() {
  const [locale, setLocale] = useState<Locale>('en');

  useEffect(() => {
    setLocale(getClientLocale());
  }, []);

  function handleChange(value: string) {
    document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
    // Full reload so both server and client components pick up the new locale
    window.location.reload();
  }

  return (
    <select
      className="langSwitcher"
      value={locale}
      onChange={(e) => handleChange(e.target.value)}
      aria-label="Language"
    >
      {LOCALES.map((l) => (
        <option key={l} value={l}>
          {LOCALE_LABELS[l]}
        </option>
      ))}
    </select>
  );
}
