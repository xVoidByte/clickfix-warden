import { compileRules } from './rules';
import type { PageVerdict, Reason, RulesFile, TriggerKind } from './types';

const CONTEXT_PAGE_CAP = 50;

/** Scores page text for instructions that walk a visitor through a ClickFix paste. */
export function scorePageText(text: string, rules: RulesFile): PageVerdict {
  const compiled = compileRules(rules);
  const limited = text.length > rules.page.maxTextLength ? text.slice(0, rules.page.maxTextLength) : text;
  const reasons: Reason[] = [];
  const groups = new Set<string>();
  const ids = new Set<string>();
  let score = 0;
  for (const { rule, re } of compiled.page) {
    if (!re.test(limited)) continue;
    score += rule.w;
    groups.add(rule.group);
    ids.add(rule.id);
    reasons.push({ id: rule.id, w: rule.w });
  }
  score = Math.min(CONTEXT_PAGE_CAP, score);
  const standalone =
    text.length <= rules.page.standaloneMaxTextLength &&
    score >= rules.page.standaloneMinScore &&
    groups.has('open') &&
    groups.has('paste') &&
    (ids.has('page-verify-human') || ids.has('page-fake-update'));
  return { score, reasons, groups, ids, standalone, textLength: text.length };
}

/** Classifies the element the visitor clicked right before a clipboard write. */
export function classifyTriggerText(text: string, isCheckbox: boolean, rules: RulesFile): TriggerKind {
  if (isCheckbox) return 'captcha';
  const t = compileRules(rules).trigger;
  const sample = text.slice(0, 300);
  if (!sample.trim()) return null;
  if (t.captcha?.test(sample)) return 'captcha';
  if (t.fix?.test(sample)) return 'fix';
  if (t.copy?.test(sample)) return 'copy';
  return null;
}
