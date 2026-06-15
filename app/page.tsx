import { redirect } from 'next/navigation';
import { getUserFromCookie } from '@/lib/auth';

export default async function Home() {
  const user = await getUserFromCookie();
  if (user) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
