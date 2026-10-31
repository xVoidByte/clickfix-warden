// Lists recent ClickFix reports from ThreatFox and URLhaus without opening any site, needs ABUSECH_AUTH_KEY and takes an optional day count.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { unzipSync } from 'fflate';
import { type BuildOptions, type Entries, fromThreatfox, fromUrlhaus } from '../feed-builder/sources';
import { BUNDLED_RULES } from '../src/engine/rules';
import { refFor } from '../src/feed/types';

const key = process.env.ABUSECH_AUTH_KEY?.trim();
if (!key) {
  console.error('Set ABUSECH_AUTH_KEY to your free abuse.ch key first.');
  process.exit(1);
}
const days = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 7);
const root = resolve(import.meta.dirname, '..');
const seenPath = resolve(root, '.work/review-seen.json');

async function get(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { 'user-agent': 'clickfix-warden-review' } });
  if (!res.ok) throw new Error(`${url.split(key!).join('***')} answered HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

const defang = (s: string) => s.replace(/^http/i, 'hxxp').replace(/\./g, '[.]');

const opts: BuildOptions = {
  clickfixTags: BUNDLED_RULES.feed.clickfixTags,
  noHostLevel: [],
  now: new Date(),
  maxAgeDays: days,
  ipMaxAgeDays: days,
  minConfidence: 0,
  minIpConfidence: 0,
};

const entries: Entries = new Map();
const urlhaus = new TextDecoder().decode(await get(`https://urlhaus-api.abuse.ch/v2/files/exports/${key}/recent.csv`));
fromUrlhaus(urlhaus, opts, entries);
const zip = unzipSync(await get(`https://threatfox-api.abuse.ch/v2/files/exports/${key}/full.csv.zip`));
const csvName = Object.keys(zip).find((n) => n.endsWith('.csv'))!;
fromThreatfox(new TextDecoder().decode(zip[csvName]), opts, entries);

const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
const rows: { seen: boolean; first: string; source: string; what: string; malware: string; tags: string; ref: string }[] = [];
const seen = new Set<string>(existsSync(seenPath) ? (JSON.parse(readFileSync(seenPath, 'utf8')) as string[]) : []);
for (const [k, records] of entries) {
  for (const r of records) {
    if (r[1] !== 'clickfix' || r[3] < cutoff) continue;
    const ref = refFor(r[0], r[4]);
    rows.push({ seen: seen.has(ref), first: r[3], source: r[0], what: defang(k.slice(2)), malware: r[2], tags: r[5].join(', '), ref });
  }
}
rows.sort((a, b) => Number(a.seen) - Number(b.seen) || b.first.localeCompare(a.first));

const fresh = rows.filter((r) => !r.seen);
console.log(`ClickFix reports from the last ${days} days: ${rows.length}, new since the last run: ${fresh.length}\n`);
for (const r of rows) console.log(`${r.seen ? '   ' : 'NEW'}  ${r.first}  ${r.source.padEnd(9)}  ${r.what}\n      ${[r.malware, r.tags].filter(Boolean).join(' | ')}  ${r.ref}`);

mkdirSync(resolve(root, '.work'), { recursive: true });
writeFileSync(seenPath, JSON.stringify([...new Set([...seen, ...rows.map((r) => r.ref)])]));
