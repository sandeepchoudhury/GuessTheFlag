'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../login/login.module.css';
import { getClientLocale, Locale, t } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function SignupPage() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>('en');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLocale(getClientLocale());
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t(locale, 'passwordsNoMatch'));
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? t(locale, 'signupFailed'));
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
        <div className={styles.logo}>🌍</div>
        <h1 className={styles.title}>{t(locale, 'signupTitle')}</h1>
        <p className={styles.subtitle}>{t(locale, 'signupSubtitle')}</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="username">{t(locale, 'username')}</label>
            <input
              id="username"
              className={styles.input}
              type="text"
              placeholder={t(locale, 'signupUsernamePlaceholder')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              minLength={3}
              maxLength={30}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">{t(locale, 'password')}</label>
            <input
              id="password"
              className={styles.input}
              type="password"
              placeholder={t(locale, 'signupPasswordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="confirmPassword">{t(locale, 'confirmPassword')}</label>
            <input
              id="confirmPassword"
              className={styles.input}
              type="password"
              placeholder={t(locale, 'confirmPasswordPlaceholder')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <button className={styles.submitBtn} type="submit" disabled={loading}>
            {loading ? t(locale, 'creatingAccount') : t(locale, 'createAccount')}
          </button>
        </form>

        <div className={styles.footer}>
          {t(locale, 'haveAccount')}{' '}
          <Link href="/login">{t(locale, 'signInLink')}</Link>
        </div>
      </div>
    </div>
  );
}
