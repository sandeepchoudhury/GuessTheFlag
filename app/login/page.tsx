'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './login.module.css';
import { getClientLocale, Locale, t } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { APP_VERSION } from '@/lib/version';

export default function LoginPage() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>('en');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLocale(getClientLocale());
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? t(locale, 'loginFailed'));
        return;
      }

      router.push('/dashboard');
    } catch {
      setError(t(locale, 'networkError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.langRow}>
          <LanguageSwitcher />
        </div>
        <div className={styles.logo}>🏴</div>
        <h1 className={styles.title}>{t(locale, 'appTitle')}</h1>
        <p className={styles.subtitle}>{t(locale, 'loginSubtitle')}</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="username">{t(locale, 'username')}</label>
            <input
              id="username"
              className={styles.input}
              type="text"
              placeholder={t(locale, 'usernamePlaceholder')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">{t(locale, 'password')}</label>
            <input
              id="password"
              className={styles.input}
              type="password"
              placeholder={t(locale, 'passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button className={styles.submitBtn} type="submit" disabled={loading}>
            {loading ? t(locale, 'signingIn') : t(locale, 'signIn')}
          </button>
        </form>

        <div className={styles.footer}>
          {t(locale, 'noAccount')}{' '}
          <Link href="/signup">{t(locale, 'signUp')}</Link>
        </div>
        <p className={styles.version}>v{APP_VERSION}</p>
      </div>
    </div>
  );
}
