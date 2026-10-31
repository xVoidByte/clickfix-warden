// Builds the signed database and rules that the extension downloads.
//
// Runs every hour in GitHub Actions (.github/workflows/feed.yml):
//   ABUSECH_AUTH_KEY   free key from https://auth.abuse.ch/
//   FEED_SIGNING_KEY   Ed25519 private key in PEM form
//
// Output goes to dist/site, which is published to GitHub Pages:
//   v1/feed.json, v1/feed.json.sig, v1/rules.json, v1/rules.json.sig, v1/meta.json
//   index.html, privacy.html
//
// If any source fails or looks empty the run stops before publishing, so the
// last good database stays online.

import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { unzipSync } from 'fflate';
import { isUsableRules } from '../src/engine/rules';
import type { RulesFile } from '../src/engine/types';
import { FEED_PUBLIC_KEY } from '../src/feed/public-key';
import type { FeedFile, FeedSource } from '../src/feed/types';
import { type BuildOptions, type Entries, fromFeodo, fromThreatfox, fromUrlhaus, SOURCE_LABELS } from './sources';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, process.env.OUT_DIR ?? 'dist/site');
const unsigned = process.argv.includes('--unsigned');
const UA = 'clickfix-warden-feed (+https://github.com/xVoidByte/clickfix-warden)';

const authKey = process.env.ABUSECH_AUTH_KEY?.trim();
if (!authKey) fail('ABUSECH_AUTH_KEY is not set. Create a free key at https://auth.abuse.ch/ and add it as a repository secret.');

function fail(message: string): never {
  console.error(`Feed build failed: ${message}`);
  process.exit(1);
}

function redact(s: string): string {
  return authKey ? s.split(authKey).join('***') : s;
}

async function download(url: string, optional = false): Promise<Uint8Array | null> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { 'user-agent': UA } });
  } catch (e) {
    if (optional) return null;
    fail(redact(`${url} could not be reached, ${(e as Error).message}`));
  }
  if (res.status === 404 && optional) return null;
  if (!res.ok) fail(redact(`${url} answered HTTP ${res.status}`));
  return new Uint8Array(await res.arrayBuffer());
}

function firstCsvInZip(zip: Uint8Array): string {
  const files = unzipSync(zip);
  const name = Object.keys(files).find((n) => n.toLowerCase().endsWith('.csv'));
  if (!name) fail('the ThreatFox export has no CSV file inside');
  return new TextDecoder().decode(files[name]);
}

function signFile(data: Buffer, pem: string): string {
  const key = createPrivateKey(pem);
  const signature = sign(null, data, key);
  // Make sure the secret matches the public key compiled into the extension.
  const raw = Buffer.from(FEED_PUBLIC_KEY, 'base64');
  const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), raw]);
  const pub = createPublicKey({ key: spki, format: 'der', type: 'spki' });
  if (!verify(null, data, pub, signature)) fail('FEED_SIGNING_KEY does not match src/feed/public-key.ts');
  return signature.toString('base64');
}

const rulesText = readFileSync(resolve(root, 'rules/rules.json'));
const rules = JSON.parse(rulesText.toString('utf8')) as RulesFile;
if (!isUsableRules(rules)) fail('rules/rules.json is not a usable rules file');

const opts: BuildOptions = {
  clickfixTags: rules.feed.clickfixTags,
  noHostLevel: rules.feed.noHostLevel,
  now: new Date(),
  maxAgeDays: 30,
  ipMaxAgeDays: 30,
  minConfidence: 50,
  minIpConfidence: 75,
};

const entries: Entries = new Map();
const counts: Record<FeedSource, number> = { urlhaus: 0, threatfox: 0, feodo: 0 };

console.log('Downloading URLhaus');
const urlhaus = await download(`https://urlhaus-api.abuse.ch/v2/files/exports/${authKey}/recent.csv`);
counts.urlhaus = fromUrlhaus(new TextDecoder().decode(urlhaus!), opts, entries);

console.log('Downloading ThreatFox');
const threatfox = await download(`https://threatfox-api.abuse.ch/v2/files/exports/${authKey}/full.csv.zip`);
counts.threatfox = fromThreatfox(firstCsvInZip(threatfox!), opts, entries);

console.log('Downloading Feodo Tracker');
const feodo = await download('https://feodotracker.abuse.ch/downloads/ipblocklist.json');
counts.feodo = fromFeodo(new TextDecoder().decode(feodo!), opts, entries);

console.log(`Reports: URLhaus ${counts.urlhaus}, ThreatFox ${counts.threatfox}, Feodo ${counts.feodo}, keys ${entries.size}`);
if (counts.urlhaus < 100) fail(`URLhaus gave only ${counts.urlhaus} reports, the export format may have changed`);
if (counts.threatfox < 100) fail(`ThreatFox gave only ${counts.threatfox} reports, the export format may have changed`);

const feed: FeedFile = {
  format: 1,
  generated: opts.now.toISOString(),
  sources: (Object.keys(counts) as FeedSource[]).map((id) => ({ id, name: SOURCE_LABELS[id], count: counts[id] })),
  entries: [...entries.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)),
};
const feedBytes = Buffer.from(JSON.stringify(feed));

mkdirSync(resolve(out, 'v1'), { recursive: true });
writeFileSync(resolve(out, 'v1/feed.json'), feedBytes);
writeFileSync(resolve(out, 'v1/rules.json'), rulesText);
writeFileSync(
  resolve(out, 'v1/meta.json'),
  JSON.stringify(
    {
      generated: feed.generated,
      keys: entries.size,
      sources: feed.sources,
      clickfix: [...entries.values()].filter((r) => r.some((x) => x[1] === 'clickfix')).length,
      rulesVersion: rules.version,
    },
    null,
    2,
  ),
);

if (!unsigned) {
  const pem = process.env.FEED_SIGNING_KEY;
  if (!pem?.includes('PRIVATE KEY')) fail('FEED_SIGNING_KEY is not set. Add the private key PEM as a repository secret.');
  writeFileSync(resolve(out, 'v1/feed.json.sig'), signFile(feedBytes, pem));
  writeFileSync(resolve(out, 'v1/rules.json.sig'), signFile(rulesText, pem));
}

cpSync(resolve(root, 'feed-builder/site'), out, { recursive: true });
writeFileSync(resolve(out, '.nojekyll'), '');
console.log(`Written to ${out} (${(feedBytes.length / 1024 / 1024).toFixed(1)} MB feed)`);
