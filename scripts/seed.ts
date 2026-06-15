import sql from '../lib/db';
import { MASTER_COUNTRIES } from '../lib/countries';

async function main() {
  for (const country of MASTER_COUNTRIES) {
    const flagPath = `/flags/${country.iso}.svg`;
    await sql`
      INSERT INTO countries (name, iso_code, flag_path, difficulty_tier)
      VALUES (${country.name}, ${country.iso}, ${flagPath}, ${country.tier})
      ON CONFLICT (iso_code) DO NOTHING
    `;
    console.log(`[SEED] ${country.iso} - ${country.name} (tier ${country.tier})`);
  }
  console.log(`\nSeeded ${MASTER_COUNTRIES.length} countries.`);
  await sql.end();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
