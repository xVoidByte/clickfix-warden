import { browser } from 'wxt/browser';
import { LOG_LIMIT } from './constants';
import type { Detection } from './messages';

let chain: Promise<unknown> = Promise.resolve();

/** Appends a detection to the local log. The log never leaves the browser. */
export function addDetection(entry: Omit<Detection, 'id' | 'time'>): Promise<Detection> {
  const detection: Detection = {
    ...entry,
    id: crypto.randomUUID(),
    time: new Date().toISOString(),
    command: entry.command?.slice(0, 2000),
    reasons: entry.reasons.slice(0, 30),
  };
  const run = chain.then(async () => {
    const { log } = (await browser.storage.local.get('log')) as { log?: Detection[] };
    const list = Array.isArray(log) ? log : [];
    // The same page firing the same event again within a few seconds is one detection.
    const dup = list[0];
    if (
      dup &&
      dup.kind === detection.kind &&
      dup.url === detection.url &&
      dup.command === detection.command &&
      Date.now() - new Date(dup.time).getTime() < 10_000
    )
      return dup;
    list.unshift(detection);
    await browser.storage.local.set({ log: list.slice(0, LOG_LIMIT) });
    return detection;
  });
  chain = run.catch(() => undefined);
  return run;
}

export async function readLog(): Promise<Detection[]> {
  const { log } = (await browser.storage.local.get('log')) as { log?: Detection[] };
  return Array.isArray(log) ? log : [];
}
