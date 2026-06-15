import db from '@/lib/db';
import { Question } from '@/lib/types';
import { Locale } from '@/lib/i18n';
import { localizedCountryName } from '@/lib/countryNames';

export const QUESTIONS_PER_LEVEL = 15;
export const OPTIONS_PER_QUESTION = 4;
export const TIMER_SECONDS = 15;

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function tiersForLevel(level: number): number[] {
  if (level >= 1 && level <= 5) return [level];
  return [4, 5];
}

interface CountryRow {
  id: number;
  name: string;
  iso_code: string;
  flag_path: string;
  difficulty_tier: number;
}

export function buildQuestions(level: number, locale: Locale = 'en'): Question[] {
  const tiers = tiersForLevel(level);
  const placeholders = tiers.map(() => '?').join(',');

  const pool = db
    .prepare(`SELECT id, name, iso_code, flag_path, difficulty_tier FROM countries WHERE difficulty_tier IN (${placeholders})`)
    .all(...tiers) as CountryRow[];

  if (pool.length === 0) return [];

  const shuffled = fisherYates(pool);
  const questionCountries = shuffled.slice(0, Math.min(QUESTIONS_PER_LEVEL, shuffled.length));

  const displayName = (c: CountryRow) => localizedCountryName(c.iso_code, c.name, locale);

  return questionCountries.map((country) => {
    // Build distractors: other countries from same tier pool
    const distractors = fisherYates(
      pool.filter((c) => c.id !== country.id)
    ).slice(0, OPTIONS_PER_QUESTION - 1);

    const options = fisherYates([displayName(country), ...distractors.map(displayName)]);

    return {
      countryId: country.id,
      flagPath: country.flag_path,
      options,
      correctOption: displayName(country),
    };
  });
}
