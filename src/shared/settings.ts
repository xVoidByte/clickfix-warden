import { browser } from 'wxt/browser';

export interface Settings {
  enabled: boolean;
  clipboard: boolean;
  paste: boolean;
  protocols: boolean;
  fullscreen: boolean;
  pageWarnings: boolean;
  reputation: boolean;
  blockPage: boolean;
  web3: boolean;
  feedUpdates: boolean;
  trustedSites: string[];
  customWarning: string;
  historyDays: number;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  clipboard: true,
  paste: true,
  protocols: true,
  fullscreen: true,
  pageWarnings: true,
  reputation: true,
  blockPage: true,
  web3: true,
  feedUpdates: true,
  trustedSites: [],
  customWarning: '',
  historyDays: 30,
};

export interface EffectiveSettings {
  settings: Settings;
  managedKeys: string[];
  locked: boolean;
}

const BOOL_KEYS = Object.keys(DEFAULT_SETTINGS).filter(
  (k) => typeof DEFAULT_SETTINGS[k as keyof Settings] === 'boolean',
) as (keyof Settings)[];

/** Keeps only known keys with the right types. */
export function sanitizeSettings(raw: unknown): Partial<Settings> {
  const out: Partial<Settings> = {};
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  for (const key of BOOL_KEYS) if (typeof r[key] === 'boolean') (out as Record<string, unknown>)[key] = r[key];
  if (Array.isArray(r.trustedSites))
    out.trustedSites = r.trustedSites.filter((s): s is string => typeof s === 'string').map(normalizeSite).filter(Boolean).slice(0, 2000);
  if (typeof r.customWarning === 'string') out.customWarning = r.customWarning.slice(0, 500);
  if (typeof r.historyDays === 'number' && [7, 30, 90].includes(r.historyDays)) out.historyDays = r.historyDays;
  return out;
}

export function normalizeSite(site: string): string {
  let s = site.trim().toLowerCase();
  if (!s) return '';
  try {
    if (s.includes('://')) s = new URL(s).hostname;
  } catch {
    return '';
  }
  return s.replace(/^\*\./, '').replace(/^www\./, '').replace(/\.$/, '').split('/')[0];
}

export function isTrusted(host: string, settings: Settings): boolean {
  const h = host.toLowerCase().replace(/^www\./, '');
  return settings.trustedSites.some((site) => h === site || h.endsWith('.' + site));
}

async function readManaged(): Promise<Record<string, unknown>> {
  try {
    const managed = (browser.storage as unknown as { managed?: typeof browser.storage.local }).managed;
    if (!managed) return {};
    return ((await managed.get(null)) as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}

/** Defaults, then the user's choices, then anything set by the organisation. */
export async function computeEffectiveSettings(): Promise<EffectiveSettings> {
  const { settings: local } = await browser.storage.local.get('settings');
  const managedRaw = await readManaged();
  const managed = sanitizeSettings(managedRaw);
  const mine = sanitizeSettings(local);
  const settings: Settings = { ...DEFAULT_SETTINGS, ...mine, ...managed };
  if (managed.trustedSites && mine.trustedSites)
    settings.trustedSites = [...new Set([...managed.trustedSites, ...mine.trustedSites])];
  return { settings, managedKeys: Object.keys(managed), locked: managedRaw.lockSettings === true };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const { settings: local } = await browser.storage.local.get('settings');
  const next = { ...sanitizeSettings(local), ...sanitizeSettings(patch) };
  await browser.storage.local.set({ settings: next });
}
