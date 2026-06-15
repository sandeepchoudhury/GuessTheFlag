export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserFromCookie } from '@/lib/auth';
import { buildQuestions } from '@/lib/game';
import { StartGameResponse } from '@/lib/types';
import { isLocale, LOCALE_COOKIE, Locale } from '@/lib/i18n';

export async function GET(req: NextRequest) {
  const user = await getUserFromCookie();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const levelParam = searchParams.get('level');
  const level = levelParam ? parseInt(levelParam, 10) : NaN;

  if (isNaN(level) || level < 1 || !Number.isInteger(level)) {
    return NextResponse.json({ error: 'Invalid level parameter' }, { status: 400 });
  }

  if (level > user.currentLevel) {
    return NextResponse.json({ error: 'Level is locked' }, { status: 403 });
  }

  const langCookie = cookies().get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(langCookie) ? langCookie : 'en';

  const questions = await buildQuestions(level, locale);

  const response: StartGameResponse = { level, questions };
  return NextResponse.json(response, { status: 200 });
}
