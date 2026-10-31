import { browser } from 'wxt/browser';
import { isUsableRules, BUNDLED_RULES } from '../engine/rules';
import type { RulesFile } from '../engine/types';
import { FEED_BASE } from '../shared/constants';
import { countEntries, replaceFeed } from './db';
import type { FeedFile, FeedMeta, UpdateState } from './types';
import { verifySignature } from './verify';

export interface UpdateResult {
  feed: 'updated' | 'unchanged' | 'error';
  rules: 'updated' | 'unchanged' | 'error';
  error?: string;
}

async function fetchSigned(name: string): Promise<{ bytes: Uint8Array; text: string }> {
  const [body, sig] = await Promise.all([
    fetch(FEED_BASE + name, { cache: 'no-cache', credentials: 'omit' }),
    fetch(FEED_BASE + name + '.sig', { cache: 'no-cache', credentials: 'omit' }),
  ]);
  if (!body.ok) throw new Error(`${name} HTTP ${body.status}`);
  if (!sig.ok) throw new Error(`${name}.sig HTTP ${sig.status}`);
  const bytes = new Uint8Array(await body.arrayBuffer());
  const signature = await sig.text();
  if (!(await verifySignature(bytes, signature))) throw new Error(`${name} signature check failed`);
  return { bytes, text: new TextDecoder().decode(bytes) };
}

async function updateRules(): Promise<'updated' | 'unchanged'> {
  const { text } = await fetchSigned('rules.json');
  const rules = JSON.parse(text) as RulesFile;
  if (!isUsableRules(rules)) return 'unchanged';
  const { rules: stored } = await browser.storage.local.get('rules');
  const current = isUsableRules(stored) ? stored.version : BUNDLED_RULES.version;
  if (rules.version <= current) return 'unchanged';
  await browser.storage.local.set({ rules });
  return 'updated';
}

async function updateFeedData(): Promise<'updated' | 'unchanged'> {
  const { text } = await fetchSigned('feed.json');
  const feed = JSON.parse(text) as FeedFile;
  if (feed.format !== 1 || !Array.isArray(feed.entries) || typeof feed.generated !== 'string') throw new Error('feed.json has an unknown format');
  const { feedMeta } = (await browser.storage.local.get('feedMeta')) as { feedMeta?: FeedMeta };
  const now = new Date().toISOString();
  // Never go back to an older signed file, that would let an old copy hide new reports.
  if (feedMeta && feed.generated <= feedMeta.generated) {
    await browser.storage.local.set({ feedMeta: { ...feedMeta, checked: now } });
    return 'unchanged';
  }
  await replaceFeed(feed);
  const meta: FeedMeta = { generated: feed.generated, count: await countEntries(), sources: feed.sources, checked: now };
  await browser.storage.local.set({ feedMeta: meta });
  return 'updated';
}

let running: Promise<UpdateResult> | null = null;

/** Downloads, checks and stores the newest signed database and rules. */
export function updateAll(): Promise<UpdateResult> {
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
      result.feed = await updateFeedData();
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
