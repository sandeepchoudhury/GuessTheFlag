export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';

interface ProgressRow {
  level_id: number;
  completed: number;
  attempts: number;
}

export async function GET() {
  const user = await getUserFromCookie();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await sql<ProgressRow[]>`
    SELECT level_id, completed, attempts FROM user_progress WHERE user_id = ${user.id}
  `;

  const progressMap = new Map<number, { completed: boolean; attempts: number }>();
  for (const row of rows) {
    progressMap.set(row.level_id, {
      completed: row.completed === 1,
      attempts: row.attempts,
    });
  }

  const maxLevel = Math.max(user.currentLevel, 5);
  const levels = [];
  for (let i = 1; i <= maxLevel; i++) {
    const p = progressMap.get(i);
    levels.push({
      level: i,
      completed: p?.completed ?? false,
      attempts: p?.attempts ?? 0,
    });
  }

  return NextResponse.json({ currentLevel: user.currentLevel, levels }, { status: 200 });
}
