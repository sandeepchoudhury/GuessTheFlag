import fs from 'fs';
import path from 'path';
import { MASTER_COUNTRIES } from '../lib/countries';

const FLAGS_DIR = path.join(process.cwd(), 'public', 'flags');

async function downloadFlags() {
  if (!fs.existsSync(FLAGS_DIR)) {
    fs.mkdirSync(FLAGS_DIR, { recursive: true });
  }

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const country of MASTER_COUNTRIES) {
    const filePath = path.join(FLAGS_DIR, `${country.iso}.svg`);

    if (fs.existsSync(filePath)) {
      console.log(`[SKIP] ${country.iso} (${country.name}) - already exists`);
      skipped++;
      continue;
    }

    const url = `https://flagcdn.com/${country.iso}.svg`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`[FAIL] ${country.iso} (${country.name}) - HTTP ${response.status}`);
        failed++;
        continue;
      }
      const svg = await response.text();
      fs.writeFileSync(filePath, svg, 'utf-8');
      console.log(`[OK]   ${country.iso} (${country.name})`);
      success++;
    } catch (err) {
      console.error(`[FAIL] ${country.iso} (${country.name}) - ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\nDone. Downloaded: ${success}, Skipped: ${skipped}, Failed: ${failed}`);
}

downloadFlags().catch(console.error);
