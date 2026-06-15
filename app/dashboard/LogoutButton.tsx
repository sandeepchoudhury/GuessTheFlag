'use client';

import { useRouter } from 'next/navigation';
import styles from './dashboard.module.css';

export default function LogoutButton({ label }: { label: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <button className={styles.logoutBtn} onClick={handleLogout}>
      {label}
    </button>
  );
}
