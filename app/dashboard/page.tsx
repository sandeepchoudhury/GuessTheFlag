import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { getUserFromCookie } from '@/lib/auth';
import db from '@/lib/db';
import styles from './dashboard.module.css';
import LogoutButton from './LogoutButton';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { isLocale, Locale, LOCALE_COOKIE, t } from '@/lib/i18n';

interface ProgressRow {
  level_id: number;
  completed: number;
  attempts: number;
}

function getTierForLevel(level: number, locale: Locale): string {
  if (level >= 1 && level <= 5) {
    return t(locale, `tier${level}` as 'tier1' | 'tier2' | 'tier3' | 'tier4' | 'tier5');
  }
  return t(locale, 'tierMix');
}

export default function DashboardPage() {
  const user = getUserFromCookie();
  if (!user) {
    redirect('/login');
  }

  const langCookie = cookies().get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(langCookie) ? langCookie : 'en';

  const rows = db
    .prepare('SELECT level_id, completed, attempts FROM user_progress WHERE user_id = ?')
    .all(user.id) as ProgressRow[];

  const progressMap = new Map<number, { completed: boolean; attempts: number }>();
  for (const row of rows) {
    progressMap.set(row.level_id, { completed: row.completed === 1, attempts: row.attempts });
  }

  // Split the welcome message around {name} so the username gets its own styled span
  const [welcomeBefore, welcomeAfter] = t(locale, 'welcome', { name: '\u0000' }).split('\u0000');

  const maxLevel = Math.max(user.currentLevel, 5);
  const levels = Array.from({ length: maxLevel }, (_, i) => {
    const lvl = i + 1;
    const p = progressMap.get(lvl);
    return {
      level: lvl,
      completed: p?.completed ?? false,
      attempts: p?.attempts ?? 0,
      unlocked: lvl <= user.currentLevel,
    };
  });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>
            🏴 {t(locale, 'appTitle')}
          </h1>
          <p>{welcomeBefore}<span className={styles.username}>{user.username}</span>{welcomeAfter}</p>
        </div>
        <div className={styles.headerActions}>
          <LanguageSwitcher />
          <LogoutButton label={t(locale, 'signOut')} />
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.currentLevelBanner}>
          <div className={styles.bannerIcon}>🎯</div>
          <div className={styles.bannerText}>
            <h2>{t(locale, 'currentLevel', { n: user.currentLevel })}</h2>
            <p>{t(locale, 'difficultyLine', { tier: getTierForLevel(user.currentLevel, locale) })}</p>
          </div>
        </div>

        <p className={styles.sectionTitle}>{t(locale, 'allLevels')}</p>
        <div className={styles.levelsGrid}>
          {levels.map(({ level, completed, attempts, unlocked }) => {
            const cardClass = `${styles.levelCard} ${completed ? styles.completed : unlocked ? styles.unlocked : styles.locked}`;
            const badgeClass = `${styles.badge} ${completed ? styles.completed : unlocked ? styles.unlocked : styles.locked}`;
            const badgeText = completed
              ? t(locale, 'completedBadge')
              : unlocked
                ? t(locale, 'unlockedBadge')
                : t(locale, 'lockedBadge');

            return (
              <div key={level} className={cardClass}>
                <div className={styles.levelHeader}>
                  <span className={styles.levelNumber}>{t(locale, 'level', { n: level })}</span>
                  <span className={badgeClass}>{badgeText}</span>
                </div>
                <div className={styles.tierLabel}>{t(locale, 'tierQuestions', { tier: getTierForLevel(level, locale) })}</div>
                {attempts > 0 && (
                  <div className={styles.stats}>{t(locale, 'attempts', { n: attempts })}</div>
                )}
                {unlocked ? (
                  <Link href={`/game/${level}`} className={styles.startBtn}>
                    {completed ? t(locale, 'playAgain') : t(locale, 'startLevel')}
                  </Link>
                ) : (
                  <p className={styles.lockedMsg}>{t(locale, 'completeToUnlock', { n: level - 1 })}</p>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
