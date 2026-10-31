export type FeedSource = 'urlhaus' | 'threatfox' | 'feodo';
export type Category = 'clickfix' | 'malware' | 'c2' | 'phishing';

/** One report about an address, as published in feed.json. */
export type FeedRecordTuple = [source: FeedSource, category: Category, malware: string, firstSeen: string, ref: string, tags: string[]];

export interface FeedFile {
  format: 1;
  generated: string;
  sources: { id: FeedSource; name: string; count: number }[];
  entries: [key: string, records: FeedRecordTuple[]][];
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
  count: number;
  sources: FeedFile['sources'];
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

export function toRecord(t: FeedRecordTuple): FeedRecord {
  return { source: t[0], category: t[1], malware: t[2], firstSeen: t[3], ref: t[4], tags: t[5] ?? [] };
}

export function hasClickFix(hits: FeedHit[]): boolean {
  return hits.some((h) => h.records.some((r) => r.category === 'clickfix'));
}
