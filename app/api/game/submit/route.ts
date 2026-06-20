export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import sql from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { SubmitAnswer, AnswerKeyItem, SubmitGameResponse } from '@/lib/types';
import { isLocale, LOCALE_COOKIE, Locale } from '@/lib/i18n';
import { localizedCountryName } from '@/lib/countryNames';
import { isSameOrigin, crossOriginRejected } from '@/lib/security';

interface CountryRow {
  id: number;
  name: string;
  iso_code: string;
  flag_path: string;
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return crossOriginRejected();
  }

  const user = await getUserFromCookie();
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

  // A player may only submit for an integer level they have already unlocked.
  // Without the upper bound, a crafted body (e.g. level: 99999) could jump
  // current_level arbitrarily via the UPDATE below.
  if (
    !Number.isInteger(level) ||
    level < 1 ||
    level > user.currentLevel ||
    !Array.isArray(answers)
  ) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Grade answers server-side
  const answerKey: AnswerKeyItem[] = [];
  let score = 0;

  const langCookie = cookies().get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(langCookie) ? langCookie : 'en';

  const ids = answers.map((a) => a.countryId);
  const rows = ids.length
    ? await sql<CountryRow[]>`
        SELECT id, name, iso_code, flag_path FROM countries WHERE id = ANY(${ids})
      `
    : [];
  const byId = new Map(rows.map((c) => [c.id, c]));

  for (const submission of answers) {
    const country = byId.get(submission.countryId);
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
    await sql`
      INSERT INTO user_progress (user_id, level_id, completed, attempts)
      VALUES (${user.id}, ${level}, 1, 1)
      ON CONFLICT (user_id, level_id)
      DO UPDATE SET completed = 1, attempts = user_progress.attempts + 1
    `;

    // Bump current_level if they just cleared their current level
    const urows = await sql<{ id: number; current_level: number }[]>`
      SELECT id, current_level FROM users WHERE id = ${user.id}
    `;
    const userRow = urows[0];
    if (userRow && level >= userRow.current_level) {
      await sql`UPDATE users SET current_level = ${level + 1} WHERE id = ${user.id}`;
    }
  } else {
    await sql`
      INSERT INTO user_progress (user_id, level_id, completed, attempts)
      VALUES (${user.id}, ${level}, 0, 1)
      ON CONFLICT (user_id, level_id)
      DO UPDATE SET attempts = user_progress.attempts + 1
    `;
  }

  // Fetch updated current_level
  const updatedRows = await sql<{ current_level: number }[]>`
    SELECT current_level FROM users WHERE id = ${user.id}
  `;
  const updatedUser = updatedRows[0];

  const response: SubmitGameResponse = {
    score,
    total,
    passed,
    newCurrentLevel: updatedUser.current_level,
    answerKey,
  };

  return NextResponse.json(response, { status: 200 });
}
