import { compileRules } from './rules';
import type { ProtocolRule, RulesFile } from './types';

/** True when pasted text is a sign-in link carrying an authorization code (ConsentFix). */
export function isConsentFixPaste(text: string, pageHost: string, rules: RulesFile): boolean {
  const host = pageHost.toLowerCase();
  const allowed = rules.consentfix?.allowedHosts ?? [];
  if (allowed.some((h) => host === h || host.endsWith('.' + h))) return false;
  const sample = text.trim().slice(0, 4000);
  if (!/^https?:\/\//i.test(sample)) return false;
  return compileRules(rules).consentfix.some((re) => re.test(sample));
}

const SAFE_SCHEMES = new Set(['http', 'https', 'about', 'blob', 'data', 'javascript', 'mailto', 'tel', 'sms', 'chrome-extension', 'moz-extension']);

/** Returns the scheme of a link that leaves the browser, or null for normal web links. */
export function externalScheme(url: string): string | null {
  const m = /^\s*([a-z][a-z0-9+.-]*):/i.exec(url);
  if (!m) return null;
  const scheme = m[1].toLowerCase();
  return SAFE_SCHEMES.has(scheme) ? null : scheme;
}

/** Matches a link against the dangerous protocol list. */
export function matchProtocol(url: string, rules: RulesFile): ProtocolRule | null {
  if (!externalScheme(url)) return null;
  let value = url.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    // keep the raw value
  }
  for (const { rule, re } of compileRules(rules).protocols) if (re.test(value)) return rule;
  return null;
}

/** Classifies a blockchain RPC host, returns null when it is not one we watch. */
export function web3Host(url: string, rules: RulesFile): 'mainnet' | 'testnet' | null {
  let host: string;
  try {
    host = new URL(url, 'https://invalid.invalid/').hostname.toLowerCase();
  } catch {
    return null;
  }
  const c = compileRules(rules);
  if (c.testnetHosts.has(host)) return 'testnet';
  if (c.rpcHosts.has(host)) return 'mainnet';
  return null;
}
