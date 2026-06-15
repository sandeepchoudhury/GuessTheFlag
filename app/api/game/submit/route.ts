export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { SubmitAnswer, AnswerKeyItem, SubmitGameResponse } from '@/lib/types';
import { isLocale, LOCALE_COOKIE, Locale } from '@/lib/i18n';
import { localizedCountryName } from '@/lib/countryNames';

interface CountryRow {
  id: number;
  name: string;
  iso_code: string;
  flag_path: string;
}

interface UserRow {
  id: number;
  current_level: number;
}

export async function POST(req: NextRequest) {
  const user = getUserFromCookie();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { level: number; answers: SubmitAnswer[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { level, answers } = body;

  if (!level || !Array.isArray(answers)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Grade answers server-side
  const answerKey: AnswerKeyItem[] = [];
  let score = 0;

  const langCookie = cookies().get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(langCookie) ? langCookie : 'en';

  for (const submission of answers) {
    const country = db
      .prepare('SELECT id, name, iso_code, flag_path FROM countries WHERE id = ?')
      .get(submission.countryId) as CountryRow | undefined;

    if (!country) continue;

    const localizedName = localizedCountryName(country.iso_code, country.name, locale);
    // Accept the localized or English name so a mid-game language switch can't fail a correct answer
    const isCorrect =
      submission.answer !== null &&
      (submission.answer === localizedName || submission.answer === country.name);
    if (isCorrect) score++;

    answerKey.push({
      countryId: country.id,
      flagPath: country.flag_path,
      correctOption: localizedName,
      userAnswer: submission.answer,
      isCorrect,
    });
  }

  const total = answerKey.length;
  const passed = score === total && total === 15;

  // Persist progress
  if (passed) {
    db.prepare(`
      INSERT INTO user_progress (user_id, level_id, completed, attempts)
      VALUES (?, ?, 1, 1)
      ON CONFLICT(user_id, level_id) DO UPDATE SET completed = 1, attempts = attempts + 1
    `).run(user.id, level);

    // Bump current_level if they just cleared their current level
    const userRow = db.prepare('SELECT id, current_level FROM users WHERE id = ?').get(user.id) as UserRow;
    if (userRow && level >= userRow.current_level) {
      db.prepare('UPDATE users SET current_level = ? WHERE id = ?').run(level + 1, user.id);
    }
  } else {
    db.prepare(`
      INSERT INTO user_progress (user_id, level_id, completed, attempts)
      VALUES (?, ?, 0, 1)
      ON CONFLICT(user_id, level_id) DO UPDATE SET attempts = attempts + 1
    `).run(user.id, level);
  }

  // Fetch updated current_level
  const updatedUser = db.prepare('SELECT current_level FROM users WHERE id = ?').get(user.id) as { current_level: number };

  const response: SubmitGameResponse = {
    score,
    total,
    passed,
    newCurrentLevel: updatedUser.current_level,
    answerKey,
  };

  return NextResponse.json(response, { status: 200 });
}
