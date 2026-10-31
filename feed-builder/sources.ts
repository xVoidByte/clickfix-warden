// Parsers for the abuse.ch exports. They turn each source into lookup keys
// with one report per entry, using the same key format as the extension.

import { cleanHost, hostKey, ipKey, isIp, urlKey } from '../src/feed/keys';
import type { Category, FeedRecordTuple, FeedSource } from '../src/feed/types';

export interface BuildOptions {
  clickfixTags: string[];
  noHostLevel: string[];
  now: Date;
  /** Reports older than this many days are left out, unless still online. */
  maxAgeDays: number;
  /** IP reports are riskier because cloud addresses change hands, so they expire sooner. */
  ipMaxAgeDays: number;
  minConfidence: number;
  minIpConfidence: number;
}

export type Entries = Map<string, FeedRecordTuple[]>;

/** Minimal CSV reader that handles quoted fields, doubled quotes and commas inside quotes. */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/** Reads an abuse.ch CSV whose header sits in the last comment line. */
export function readCsv(text: string, expected: string[]): Record<string, string>[] {
  const lines = text.split(/\r?\n/);
  let header: string[] | null = null;
  const rows: Record<string, string>[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    if (line.startsWith('#')) {
      const cols = parseCsvLine(line.replace(/^#\s*/, ''));
      if (cols.length >= 3 && expected.every((c) => cols.includes(c))) header = cols;
      continue;
    }
    const cols = parseCsvLine(line);
    const names = header ?? expected;
    const row: Record<string, string> = {};
    names.forEach((name, i) => (row[name] = cols[i] ?? ''));
    rows.push(row);
  }
  return rows;
}

function normTag(tag: string): string {
  return tag.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function splitTags(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t && t.toLowerCase() !== 'none' && t.toLowerCase() !== 'null')
    .slice(0, 8);
}

function isClickFix(values: string[], opts: BuildOptions): boolean {
  const wanted = new Set(opts.clickfixTags.map(normTag));
  return values.some((v) => wanted.has(normTag(v)));
}

function day(ts: string): string {
  return (ts || '').slice(0, 10);
}

/** abuse.ch dates come as "2026-10-20 12:34:56" or "2026-10-20", always UTC. */
export function ageDays(ts: string | null | undefined, now: Date): number {
  const s = (ts ?? '').trim();
  let iso = s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) iso = s + 'T00:00:00Z';
  else if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(s)) iso = s.replace(' ', 'T') + 'Z';
  const t = Date.parse(iso);
  return Number.isFinite(t) ? (now.getTime() - t) / 86_400_000 : Infinity;
}

function add(entries: Entries, key: string, record: FeedRecordTuple): void {
  const list = entries.get(key);
  if (!list) entries.set(key, [record]);
  else if (!list.some((r) => r[0] === record[0] && r[4] === record[4])) list.push(record);
}

export const URLHAUS_COLUMNS = ['id', 'dateadded', 'url', 'url_status', 'last_online', 'threat', 'tags', 'urlhaus_link', 'reporter'];

/** URLhaus reports exact malware download addresses, so it only ever adds exact-address keys. */
export function fromUrlhaus(csv: string, opts: BuildOptions, entries: Entries): number {
  let count = 0;
  for (const row of readCsv(csv, ['id', 'dateadded', 'url'])) {
    const url = row.url;
    if (!url) continue;
    const online = row.url_status === 'online';
    if (!online && ageDays(row.dateadded, opts.now) > opts.maxAgeDays) continue;
    const key = urlKey(url);
    if (!key) continue;
    const tags = splitTags(row.tags ?? '');
    const category: Category = isClickFix(tags, opts) ? 'clickfix' : 'malware';
    const ref = /^https:\/\/urlhaus\.abuse\.ch\//.test(row.urlhaus_link ?? '') ? row.urlhaus_link : `https://urlhaus.abuse.ch/url/${row.id}/`;
    add(entries, key, ['urlhaus', category, '', day(row.dateadded), ref, tags]);
    count++;
  }
  return count;
}

export const THREATFOX_COLUMNS = [
  'first_seen_utc',
  'ioc_id',
  'ioc_value',
  'ioc_type',
  'threat_type',
  'fk_malware',
  'malware_alias',
  'malware_printable',
  'last_seen_utc',
  'confidence_level',
  'reference',
  'tags',
  'anonymous',
  'reporter',
];

export function fromThreatfox(csv: string, opts: BuildOptions, entries: Entries): number {
  const noHost = new Set(opts.noHostLevel.map((h) => h.toLowerCase()));
  let count = 0;
  for (const row of readCsv(csv, ['first_seen_utc', 'ioc_id', 'ioc_value', 'ioc_type'])) {
    const value = row.ioc_value;
    const type = row.ioc_type;
    if (!value || !type) continue;
    const confidence = Number(row.confidence_level ?? 0);
    const seen = row.last_seen_utc || row.first_seen_utc;
    const tags = splitTags(row.tags ?? '');
    const malware = row.malware_printable && !/^unknown/i.test(row.malware_printable) ? row.malware_printable : '';
    const clickfix = isClickFix([...tags, malware, row.malware_alias ?? ''], opts);
    const category: Category = clickfix ? 'clickfix' : row.threat_type === 'botnet_cc' ? 'c2' : 'malware';
    const record: FeedRecordTuple = ['threatfox', category, malware, day(row.first_seen_utc), `https://threatfox.abuse.ch/ioc/${row.ioc_id}/`, tags];
    if (type === 'domain') {
      if (confidence < opts.minConfidence || ageDays(seen, opts.now) > opts.maxAgeDays) continue;
      const host = cleanHost(value);
      if (!host || noHost.has(host)) continue;
      add(entries, hostKey(host), record);
      count++;
    } else if (type === 'url') {
      if (confidence < opts.minConfidence || ageDays(seen, opts.now) > opts.maxAgeDays) continue;
      const key = urlKey(value);
      if (!key) continue;
      add(entries, key, record);
      count++;
    } else if (type === 'ip:port') {
      if (confidence < opts.minIpConfidence || ageDays(seen, opts.now) > opts.ipMaxAgeDays) continue;
      const ip = value.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
      if (!isIp(ip)) continue;
      add(entries, ipKey(ip), record);
      count++;
    }
  }
  return count;
}

interface FeodoRow {
  ip_address: string;
  status: string;
  first_seen: string;
  last_online: string | null;
  malware: string;
}

export function fromFeodo(json: string, opts: BuildOptions, entries: Entries): number {
  const rows = JSON.parse(json) as FeodoRow[];
  let count = 0;
  for (const row of rows) {
    if (!row.ip_address || !isIp(row.ip_address)) continue;
    const last = row.last_online ?? row.first_seen;
    if (ageDays(last, opts.now) > opts.ipMaxAgeDays) continue;
    add(entries, ipKey(row.ip_address), ['feodo', 'c2', row.malware ?? '', day(row.first_seen), `https://feodotracker.abuse.ch/browse/host/${row.ip_address}/`, []]);
    count++;
  }
  return count;
}

export const SOURCE_LABELS: Record<FeedSource, string> = { urlhaus: 'URLhaus', threatfox: 'ThreatFox', feodo: 'Feodo Tracker' };
