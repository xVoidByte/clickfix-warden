export type FeedSource = 'urlhaus' | 'threatfox' | 'feodo';
export type Category = 'clickfix' | 'malware' | 'c2' | 'phishing';

export const FEED_FORMAT = 2;

/** One report about an address, the id is the report number on abuse.ch. */
export type FeedRecordTuple = [source: FeedSource, category: Category, malware: string, firstSeen: string, id: string, tags: string[]];
export type FeedEntry = [key: string, records: FeedRecordTuple[]];

export interface SourceCount {
  id: FeedSource;
  name: string;
  count: number;
}

/** hot.json changes every hour and holds ClickFix, hosts, IPs and ThreatFox, bulk.json holds the URLhaus download links. */
export interface FeedPart {
  format: 2;
  part: 'hot' | 'bulk';
  generated: string;
  sources: SourceCount[];
  entries: FeedEntry[];
}

/** Changes to hot.json since the previous hour. */
export interface FeedDelta {
  format: 2;
  part: 'hot-delta';
  base: string;
  generated: string;
  sources: SourceCount[];
  put: FeedEntry[];
  del: string[];
}

export interface FeedRecord {
  source: FeedSource;
  category: Category;
  malware: string;
  firstSeen: string;
  ref: string;
  tags: string[];
}

export interface FeedHit {
  key: string;
  records: FeedRecord[];
}

export interface FeedMeta {
  generated: string;
  hotGenerated: string;
  bulkGenerated: string;
  bulkChecked: string;
  count: number;
  sources: SourceCount[];
  checked: string;
}

export interface UpdateState {
  lastAttempt: string;
  lastError: string | null;
}

export const SOURCE_NAMES: Record<FeedSource, string> = {
  urlhaus: 'URLhaus',
  threatfox: 'ThreatFox',
  feodo: 'Feodo Tracker',
};

const REF_BASE: Record<FeedSource, string> = {
  urlhaus: 'https://urlhaus.abuse.ch/url/',
  threatfox: 'https://threatfox.abuse.ch/ioc/',
  feodo: 'https://feodotracker.abuse.ch/browse/host/',
};

/** Link to the public report, empty when the id looks wrong. */
export function refFor(source: FeedSource, id: string): string {
  const base = REF_BASE[source];
  return base && /^[\w.:-]{1,64}$/.test(id) ? `${base}${id}/` : '';
}

export function toRecord(t: FeedRecordTuple): FeedRecord {
  return { source: t[0], category: t[1], malware: t[2], firstSeen: t[3], ref: refFor(t[0], t[4]), tags: t[5] ?? [] };
}

export function hasClickFix(hits: FeedHit[]): boolean {
  return hits.some((h) => h.records.some((r) => r.category === 'clickfix'));
}

/** URLhaus download links go to bulk.json unless tagged ClickFix, everything else is hot. */
export function isHotEntry([key, records]: FeedEntry): boolean {
  return !key.startsWith('u:') || records.some((r) => r[0] !== 'urlhaus' || r[1] === 'clickfix');
}

export function splitEntries(entries: FeedEntry[]): { hot: FeedEntry[]; bulk: FeedEntry[] } {
  const hot: FeedEntry[] = [];
  const bulk: FeedEntry[] = [];
  for (const e of entries) (isHotEntry(e) ? hot : bulk).push(e);
  return { hot, bulk };
}

/** Keys to add or replace and keys to remove when going from one set of entries to the next. */
export function diffEntries(prev: FeedEntry[], next: FeedEntry[]): { put: FeedEntry[]; del: string[] } {
  const before = new Map(prev.map(([k, r]) => [k, JSON.stringify(r)]));
  const after = new Set<string>();
  const put: FeedEntry[] = [];
  for (const entry of next) {
    after.add(entry[0]);
    if (before.get(entry[0]) !== JSON.stringify(entry[1])) put.push(entry);
  }
  const del = [...before.keys()].filter((k) => !after.has(k));
  return { put, del };
}
