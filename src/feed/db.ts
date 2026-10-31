import { type FeedEntry, type FeedHit, type FeedRecordTuple, toRecord } from './types';

const DB_NAME = 'clickfix-warden';
const VERSION = 2;
export type StoreName = 'hot' | 'bulk';
const STORES: StoreName[] = ['hot', 'bulk'];

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (db.objectStoreNames.contains('ioc')) db.deleteObjectStore('ioc');
      for (const name of STORES) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Swaps one store for a new set of entries in a single transaction. */
export async function replaceStore(name: StoreName, entries: FeedEntry[]): Promise<void> {
  const db = await open();
  const tx = db.transaction(name, 'readwrite');
  const store = tx.objectStore(name);
  store.clear();
  for (const [key, records] of entries) store.put(records, key);
  await done(tx);
}

/** Applies an hourly change list to the hot store. */
export async function applyDelta(put: FeedEntry[], del: string[]): Promise<void> {
  const db = await open();
  const tx = db.transaction('hot', 'readwrite');
  const store = tx.objectStore('hot');
  for (const key of del) store.delete(key);
  for (const [key, records] of put) store.put(records, key);
  await done(tx);
}

export async function countEntries(): Promise<number> {
  const db = await open();
  const tx = db.transaction(STORES, 'readonly');
  const counts = await Promise.all(
    STORES.map(
      (name) =>
        new Promise<number>((resolve, reject) => {
          const req = tx.objectStore(name).count();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        }),
    ),
  );
  return counts.reduce((a, b) => a + b, 0);
}

/** Looks up many keys in both stores in one read transaction, returns only the ones found. */
export async function lookupKeys(keys: string[]): Promise<FeedHit[]> {
  if (!keys.length) return [];
  const db = await open();
  const tx = db.transaction(STORES, 'readonly');
  const found = new Map<string, FeedRecordTuple[]>();
  await Promise.all(
    STORES.flatMap((name) =>
      keys.map(
        (key) =>
          new Promise<void>((resolve) => {
            const req = tx.objectStore(name).get(key);
            req.onsuccess = () => {
              if (Array.isArray(req.result)) found.set(key, [...(found.get(key) ?? []), ...req.result]);
              resolve();
            };
            req.onerror = () => resolve();
          }),
      ),
    ),
  );
  return [...found].map(([key, records]) => ({ key, records: records.map(toRecord) }));
}
