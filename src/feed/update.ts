import { browser } from 'wxt/browser';
import { isUsableRules, BUNDLED_RULES } from '../engine/rules';
import type { RulesFile } from '../engine/types';
import { FEED_BASE } from '../shared/constants';
import { applyDelta, countEntries, replaceStore } from './db';
import { FEED_FORMAT, type FeedDelta, type FeedMeta, type FeedPart, type UpdateState } from './types';
import { verifySignature } from './verify';

const BULK_MAX_AGE = 24 * 60 * 60 * 1000;

export interface UpdateResult {
  feed: 'updated' | 'unchanged' | 'error';
  rules: 'updated' | 'unchanged' | 'error';
  error?: string;
}

class NotFound extends Error {}

async function fetchSigned<T>(name: string): Promise<T> {
  const [body, sig] = await Promise.all([
    fetch(FEED_BASE + name, { cache: 'no-cache', credentials: 'omit' }),
    fetch(FEED_BASE + name + '.sig', { cache: 'no-cache', credentials: 'omit' }),
  ]);
  if (body.status === 404) throw new NotFound(name);
  if (!body.ok) throw new Error(`${name} HTTP ${body.status}`);
  if (!sig.ok) throw new Error(`${name}.sig HTTP ${sig.status}`);
  const bytes = new Uint8Array(await body.arrayBuffer());
  if (!(await verifySignature(bytes, await sig.text()))) throw new Error(`${name} signature check failed`);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

async function updateRules(): Promise<'updated' | 'unchanged'> {
  const rules = await fetchSigned<RulesFile>('rules.json');
  if (!isUsableRules(rules)) return 'unchanged';
  const { rules: stored } = await browser.storage.local.get('rules');
  const current = isUsableRules(stored) ? stored.version : BUNDLED_RULES.version;
  if (rules.version <= current) return 'unchanged';
  await browser.storage.local.set({ rules });
  return 'updated';
}

function checkPart(p: FeedPart, part: FeedPart['part']): void {
  if (p.format !== FEED_FORMAT || p.part !== part || !Array.isArray(p.entries) || typeof p.generated !== 'string')
    throw new Error(`${part}.json has an unknown format`);
}

/** Hourly part, applied as a small change list when the previous hour is what we have. */
async function updateHot(meta: FeedMeta): Promise<boolean> {
  if (meta.hotGenerated) {
    try {
      const delta = await fetchSigned<FeedDelta>('hot-delta.json');
      if (delta.format === FEED_FORMAT && delta.part === 'hot-delta') {
        if (delta.generated === meta.hotGenerated) return false;
        if (delta.base === meta.hotGenerated && delta.generated > delta.base) {
          await applyDelta(delta.put, delta.del);
          meta.hotGenerated = delta.generated;
          meta.sources = delta.sources;
          return true;
        }
      }
    } catch (e) {
      if (!(e instanceof NotFound)) throw e;
    }
  }
  const hot = await fetchSigned<FeedPart>('hot.json');
  checkPart(hot, 'hot');
  // Never go back to an older signed file, that would let an old copy hide new reports.
  if (meta.hotGenerated && hot.generated <= meta.hotGenerated) return false;
  await replaceStore('hot', hot.entries);
  meta.hotGenerated = hot.generated;
  meta.sources = hot.sources;
  return true;
}

/** Daily part with the URLhaus download links. */
async function updateBulk(meta: FeedMeta, force: boolean): Promise<boolean> {
  if (!force && meta.bulkChecked && Date.now() - Date.parse(meta.bulkChecked) < BULK_MAX_AGE) return false;
  const bulk = await fetchSigned<FeedPart>('bulk.json');
  checkPart(bulk, 'bulk');
  meta.bulkChecked = new Date().toISOString();
  if (meta.bulkGenerated && bulk.generated <= meta.bulkGenerated) return false;
  await replaceStore('bulk', bulk.entries);
  meta.bulkGenerated = bulk.generated;
  return true;
}

async function updateFeedData(forceBulk: boolean): Promise<'updated' | 'unchanged'> {
  const { feedMeta } = (await browser.storage.local.get('feedMeta')) as { feedMeta?: FeedMeta };
  const meta: FeedMeta = feedMeta?.hotGenerated !== undefined
    ? { ...feedMeta }
    : { generated: '', hotGenerated: '', bulkGenerated: '', bulkChecked: '', count: 0, sources: [], checked: '' };
  let changed = false;
  try {
    changed = await updateHot(meta);
    changed = (await updateBulk(meta, forceBulk)) || changed;
  } finally {
    meta.checked = new Date().toISOString();
    meta.generated = meta.hotGenerated;
    if (changed) meta.count = await countEntries();
    if (meta.hotGenerated) await browser.storage.local.set({ feedMeta: meta });
  }
  return changed ? 'updated' : 'unchanged';
}

let running: Promise<UpdateResult> | null = null;

/** Downloads, checks and stores the newest signed database and rules. */
export function updateAll(opts: { forceBulk?: boolean } = {}): Promise<UpdateResult> {
  if (running) return running;
  running = (async () => {
    const result: UpdateResult = { feed: 'unchanged', rules: 'unchanged' };
    const errors: string[] = [];
    try {
      result.rules = await updateRules();
    } catch (e) {
      result.rules = 'error';
      errors.push(String((e as Error).message ?? e));
    }
    try {
      result.feed = await updateFeedData(!!opts.forceBulk);
    } catch (e) {
      result.feed = 'error';
      errors.push(String((e as Error).message ?? e));
    }
    if (errors.length) result.error = errors.join(', ');
    const state: UpdateState = { lastAttempt: new Date().toISOString(), lastError: result.error ?? null };
    await browser.storage.local.set({ updateState: state });
    return result;
  })().finally(() => {
    running = null;
  });
  return running;
}
