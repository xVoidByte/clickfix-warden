import { browser } from 'wxt/browser';
import type { Label, Lang } from '../engine/types';

export function t(key: string, subs?: string | string[]): string {
  try {
    const value = browser.i18n.getMessage(key as never, subs as never);
    return value || key;
  } catch {
    return key;
  }
}

export function uiLang(): Lang {
  try {
    return browser.i18n.getUILanguage().toLowerCase().startsWith('bg') ? 'bg' : 'en';
  } catch {
    return 'en';
  }
}

export function label(l: Label | undefined, fallback: string): string {
  if (!l) return fallback;
  return l[uiLang()] || l.en || fallback;
}

/** Fills every element that carries data-i18n, data-i18n-title or data-i18n-placeholder. */
export function localizePage(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) el.textContent = t(el.dataset.i18n!);
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle!);
  for (const el of root.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder!);
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-tip]')) el.dataset.tip = t(el.dataset.i18nTip!);
  document.documentElement.lang = uiLang();
}

export function relativeTime(iso: string | undefined): string {
  if (!iso) return t('timeNever');
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return t('timeJustNow');
  if (min < 60) return t('timeMinutes', String(min));
  const h = Math.round(min / 60);
  if (h < 48) return t('timeHours', String(h));
  return t('timeDays', String(Math.round(h / 24)));
}
