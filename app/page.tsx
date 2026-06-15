import { redirect } from 'next/navigation';
import { getUserFromCookie } from '@/lib/auth';

export default function Home() {
  const user = getUserFromCookie();
  if (user) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
