import db from '../lib/db';
import { MASTER_COUNTRIES } from '../lib/countries';

const insert = db.prepare(
  'INSERT OR IGNORE INTO countries (name, iso_code, flag_path, difficulty_tier) VALUES (?, ?, ?, ?)'
);

const insertMany = db.transaction(() => {
  for (const country of MASTER_COUNTRIES) {
    const flagPath = `/flags/${country.iso}.svg`;
    insert.run(country.name, country.iso, flagPath, country.tier);
    console.log(`[SEED] ${country.iso} - ${country.name} (tier ${country.tier})`);
  }
});

insertMany();
console.log(`\nSeeded ${MASTER_COUNTRIES.length} countries.`);
