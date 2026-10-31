import { type FeedFile, type FeedHit, toRecord } from './types';

const DB_NAME = 'clickfix-warden';
const STORE = 'ioc';
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
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

/** Swaps the whole database for a new feed in one transaction. */
export async function replaceFeed(feed: FeedFile): Promise<void> {
  const db = await open();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  store.clear();
  for (const [key, records] of feed.entries) store.put(records, key);
  await done(tx);
}

export async function countEntries(): Promise<number> {
  const db = await open();
  const tx = db.transaction(STORE, 'readonly');
  const req = tx.objectStore(STORE).count();
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Looks up many keys in one read transaction, returns only the ones found. */
export async function lookupKeys(keys: string[]): Promise<FeedHit[]> {
  if (!keys.length) return [];
  const db = await open();
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  const hits: FeedHit[] = [];
  await Promise.all(
    keys.map(
      (key) =>
        new Promise<void>((resolve) => {
          const req = store.get(key);
          req.onsuccess = () => {
            if (Array.isArray(req.result)) hits.push({ key, records: req.result.map(toRecord) });
            resolve();
          };
          req.onerror = () => resolve();
        }),
    ),
  );
  return hits;
}
