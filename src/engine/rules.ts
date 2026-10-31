import bundled from '../../rules/rules.json';
import type { CommandRule, PageRule, ProtocolRule, RulesFile } from './types';

/** Bumped when the engine learns a new rule type, rules with a higher minEngine are ignored. */
export const ENGINE_VERSION = 1;
export const RULES_FORMAT = 1;

export const BUNDLED_RULES = bundled as unknown as RulesFile;

export interface Compiled<T> {
  rule: T;
  re: RegExp;
}

export interface CompiledRules {
  source: RulesFile;
  command: Compiled<CommandRule>[];
  page: Compiled<PageRule>[];
  protocols: Compiled<ProtocolRule>[];
  consentfix: RegExp[];
  trigger: { captcha: RegExp | null; fix: RegExp | null; copy: RegExp | null };
  rpcHosts: Set<string>;
  testnetHosts: Set<string>;
}

const cache = new WeakMap<RulesFile, CompiledRules>();

function compile(re: string, flags: string): RegExp | null {
  try {
    return new RegExp(re, flags);
  } catch {
    try {
      return new RegExp(re, flags.replace('u', ''));
    } catch {
      return null;
    }
  }
}

export function compileRules(rules: RulesFile): CompiledRules {
  const hit = cache.get(rules);
  if (hit) return hit;
  const command: Compiled<CommandRule>[] = [];
  for (const rule of rules.command ?? []) {
    const re = compile(rule.re, 'im');
    if (re) command.push({ rule, re });
  }
  const page: Compiled<PageRule>[] = [];
  for (const rule of rules.page?.instructions ?? []) {
    const re = compile(rule.re, 'iu');
    if (re) page.push({ rule, re });
  }
  const protocols: Compiled<ProtocolRule>[] = [];
  for (const rule of rules.protocols ?? []) {
    const re = compile(rule.re, 'i');
    if (re) protocols.push({ rule, re });
  }
  const consentfix = (rules.consentfix?.re ?? []).map((r) => compile(r, 'i')).filter((r): r is RegExp => !!r);
  const compiled: CompiledRules = {
    source: rules,
    command,
    page,
    protocols,
    consentfix,
    trigger: {
      captcha: rules.trigger ? compile(rules.trigger.captchaLike.re, 'iu') : null,
      fix: rules.trigger ? compile(rules.trigger.fixLike.re, 'iu') : null,
      copy: rules.trigger ? compile(rules.trigger.copyLike.re, 'iu') : null,
    },
    rpcHosts: new Set((rules.web3?.rpcHosts ?? []).map((h) => h.toLowerCase())),
    testnetHosts: new Set((rules.web3?.testnetHosts ?? []).map((h) => h.toLowerCase())),
  };
  cache.set(rules, compiled);
  return compiled;
}

/** Checks a downloaded rules file before it replaces the current one. */
export function isUsableRules(value: unknown): value is RulesFile {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<RulesFile>;
  return (
    r.format === RULES_FORMAT &&
    typeof r.version === 'number' &&
    typeof r.minEngine === 'number' &&
    r.minEngine <= ENGINE_VERSION &&
    Array.isArray(r.command) &&
    !!r.thresholds &&
    !!r.structure &&
    !!r.page &&
    Array.isArray(r.protocols)
  );
}

/** Picks the newer of the bundled rules and a stored copy. */
export function pickRules(stored: unknown): RulesFile {
  if (isUsableRules(stored) && stored.version > BUNDLED_RULES.version) return stored;
  return BUNDLED_RULES;
}
