// Isolated-world side of the clipboard protection. It answers the page-world
// hooks, adds what it knows about the page (instructions, the clicked button,
// reputation), shows warnings and writes the local log.

import { browser } from 'wxt/browser';
import { externalScheme, isConsentFixPaste, matchProtocol } from '../engine/checks';
import { classifyTriggerText, scorePageText } from '../engine/page';
import { BUNDLED_RULES, pickRules } from '../engine/rules';
import { evaluateCommand } from '../engine/score';
import type { CommandContext, PageVerdict, Reason, RulesFile, TriggerKind, Verdict } from '../engine/types';
import type { FeedHit } from '../feed/types';
import { label, t } from '../shared/i18n';
import type { AlertData, DetectionAction, DetectionKind, Message, PageStatus, TabMessage } from '../shared/messages';
import { DEFAULT_SETTINGS, type EffectiveSettings, isTrusted, type Settings } from '../shared/settings';
import { showAlert } from '../ui/overlay';
import { type CheckDetail, EVT, type SignalDetail, safeText } from './protocol';

export function startGuard(): void {
  const isTop = window === window.top;
  const host = location.hostname;
  let rules: RulesFile = BUNDLED_RULES;
  let settings: Settings = DEFAULT_SETTINGS;
  let trusted = false;
  let pageReported = false;
  const web3 = { mainnet: false, testnet: false };
  let lastPointer: { el: Element | null; time: number } = { el: null, time: 0 };
  let copyMark = 0;
  let pageCache: { time: number; v: PageVerdict } | null = null;
  let scans = 0;

  const active = () => settings.enabled && !trusted;

  function sendMessage<T = unknown>(msg: Message): Promise<T | undefined> {
    try {
      return (browser.runtime.sendMessage(msg) as Promise<T>).catch(() => undefined);
    } catch {
      return Promise.resolve(undefined);
    }
  }

  // ---- state from storage ----
  async function load(): Promise<void> {
    try {
      const stored = await browser.storage.local.get(['rules', 'effective']);
      rules = pickRules(stored.rules);
      const eff = stored.effective as EffectiveSettings | undefined;
      if (eff?.settings) settings = { ...DEFAULT_SETTINGS, ...eff.settings };
      trusted = isTrusted(host, settings);
    } catch {
      // extension context gone, keep the bundled defaults
    }
  }
  void load();
  try {
    browser.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && (changes.rules || changes.effective)) void load();
    });
  } catch {
    // ignore
  }

  // ---- page context ----
  function pageText(): string {
    const body = document.body;
    if (!body) return '';
    let text = '';
    try {
      text = body.innerText || body.textContent || '';
    } catch {
      text = body.textContent || '';
    }
    const extras: string[] = [];
    for (const node of body.querySelectorAll('img[alt], [aria-label]')) {
      const v = node.getAttribute('alt') || node.getAttribute('aria-label');
      if (v) extras.push(v);
      if (extras.length >= 60) break;
    }
    return (text + '\n' + extras.join('\n')).slice(0, 200_000);
  }

  function pageVerdict(fresh = false): PageVerdict {
    if (!fresh && pageCache && Date.now() - pageCache.time < 1500) return pageCache.v;
    const v = scorePageText(pageText(), rules);
    pageCache = { time: Date.now(), v };
    return v;
  }

  function trigger(): TriggerKind {
    if (!lastPointer.el || Date.now() - lastPointer.time > 5000) return null;
    const target = lastPointer.el;
    const el = target.closest('button, a, label, [role=button], [role=checkbox], input, [onclick]') ?? target;
    const isCheckbox =
      el.matches('input[type=checkbox], [role=checkbox]') || !!el.querySelector?.('input[type=checkbox], [role=checkbox]');
    const text = [el.getAttribute('aria-label'), el.getAttribute('title'), (el as HTMLElement).innerText ?? el.textContent]
      .filter(Boolean)
      .join(' ')
      .slice(0, 300);
    return classifyTriggerText(text, isCheckbox, rules);
  }

  function context(manual: boolean): CommandContext {
    const p = pageVerdict();
    return { pageScore: p.score, pageReasons: p.reasons, trigger: trigger(), pageReported, web3: web3.mainnet || web3.testnet, manual };
  }

  // ---- reporting ----
  function reasonText(r: Reason): string {
    if (r.label) return label(r.label, r.id);
    const msg = t('r_' + r.id.replace(/-/g, '_'));
    return msg.startsWith('r_') ? r.id : msg;
  }

  function present(alert: AlertData): void {
    if (isTop) {
      showAlert(alert, overlayActions, settings.customWarning);
    } else {
      void sendMessage({ type: 'show-alert', alert });
    }
  }

  function log(kind: DetectionKind, action: DetectionAction, extra: { score?: number; reasons?: string[]; command?: string } = {}): void {
    void sendMessage({
      type: 'log',
      detection: { kind, action, url: location.href, host, score: extra.score, reasons: extra.reasons ?? [], command: extra.command },
    });
  }

  function reportVerdict(kind: DetectionKind, v: Verdict, original: string, hits?: FeedHit[]): void {
    // Strongest reasons first, small ones like "contains a web address" left out.
    const reasons = v.reasons
      .filter((r) => r.w >= 10)
      .sort((a, b) => b.w - a.w)
      .map((r) => ({ id: r.id, text: reasonText(r) }));
    if (hits?.length) reasons.unshift({ id: 'payload-reported', text: t('r_payload_reported') });
    present({ kind, host, score: v.score, reasons, display: v.norm.display, decoded: v.norm.decoded, original });
    log(kind, 'blocked', { score: v.score, reasons: reasons.map((r) => r.id), command: original });
  }

  async function writeSafeClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText(safeText());
      return;
    } catch {
      // fall back to a temporary text field
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = safeText();
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      (document.body ?? document.documentElement).appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    } catch {
      // nothing else to try
    }
  }

  /** A borderline command gets a second look: is its download address in the database? */
  async function checkTargets(v: Verdict, original: string): Promise<void> {
    if (!v.urls.length) return;
    const hits = await sendMessage<FeedHit[]>({ type: 'lookup-targets', urls: v.urls });
    if (!Array.isArray(hits) || !hits.length) return;
    await writeSafeClipboard();
    reportVerdict('clipboard', v, original, hits);
  }

  const overlayActions = {
    leave: () => void sendMessage({ type: 'leave-site' }),
    trust: (h: string) => {
      trusted = true;
      void sendMessage({ type: 'trust-site', host: h });
      log('clipboard', 'trusted', { reasons: [] });
    },
    copyAnyway: async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        log('clipboard', 'copied-anyway', { command: text, reasons: [] });
        return true;
      } catch {
        return false;
      }
    },
  };

  // ---- answers to the page-world hooks ----
  function onCheck(detail: CheckDetail): boolean {
    if (!active()) return false;
    const payload = String(detail.payload ?? '');
    switch (detail.kind) {
      case 'clipboard-write':
      case 'set-data':
      case 'exec-copy': {
        if (!settings.clipboard) return false;
        const v = evaluateCommand(payload, rules, context(false));
        if (v.level === 'block') {
          reportVerdict('clipboard', v, payload);
          return true;
        }
        if (v.level === 'warn') void checkTargets(v, payload);
        return false;
      }
      case 'fullscreen':
      case 'keyboard-lock': {
        if (!settings.fullscreen) return false;
        const p = pageVerdict(true);
        const block =
          detail.kind === 'keyboard-lock'
            ? p.score >= rules.fullscreen.keyboardLockMinScore && (p.groups.has('open') || p.ids.has('page-fake-update'))
            : p.score >= rules.fullscreen.fullscreenMinScore && p.ids.has('page-fake-update');
        if (block) {
          present({ kind: 'fullscreen', host, score: p.score, reasons: p.reasons.map((r) => ({ id: r.id, text: reasonText(r) })) });
          log('fullscreen', 'blocked', { score: p.score, reasons: p.reasons.map((r) => r.id) });
          try {
            if (document.fullscreenElement) void document.exitFullscreen();
          } catch {
            // ignore
          }
        }
        return block;
      }
      case 'protocol':
        return blockProtocol(payload);
    }
    return false;
  }

  function blockProtocol(url: string): boolean {
    if (!active() || !settings.protocols) return false;
    const rule = matchProtocol(url, rules);
    if (!rule) return false;
    const text = label(rule.label, rule.id);
    present({ kind: 'protocol', host, reasons: [{ id: rule.id, text }], display: [{ t: 'text', v: url.slice(0, 600) }] });
    log('protocol', 'blocked', { reasons: [rule.id], command: url });
    return true;
  }

  window.addEventListener(
    EVT.ping,
    (e) => {
      e.stopImmediatePropagation();
      e.preventDefault();
    },
    true,
  );
  window.addEventListener(
    EVT.check,
    (e) => {
      e.stopImmediatePropagation();
      let detail: CheckDetail;
      try {
        detail = JSON.parse(String((e as CustomEvent).detail));
      } catch {
        return;
      }
      if (onCheck(detail)) e.preventDefault();
    },
    true,
  );
  window.addEventListener(
    EVT.mark,
    (e) => {
      e.stopImmediatePropagation();
      let detail = '';
      try {
        detail = JSON.parse(String((e as CustomEvent).detail));
      } catch {
        return;
      }
      copyMark = Math.max(0, copyMark + (detail === 'begin' ? 1 : -1));
    },
    true,
  );
  window.addEventListener(
    EVT.signal,
    (e) => {
      e.stopImmediatePropagation();
      let detail: SignalDetail;
      try {
        detail = JSON.parse(String((e as CustomEvent).detail));
      } catch {
        return;
      }
      if (detail.kind !== 'web3' || !settings.web3) return;
      web3[detail.net] = true;
      if (detail.net === 'testnet' && active()) {
        present({ kind: 'web3-loader', host, reasons: [], detail: t('bannerWeb3Detail') });
        log('web3-loader', 'warned', { reasons: [`rpc:${detail.host}`] });
      }
    },
    true,
  );

  // ---- what the visitor does ----
  window.addEventListener('pointerdown', (e) => (lastPointer = { el: e.target as Element, time: Date.now() }), true);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') lastPointer = { el: e.target as Element, time: Date.now() };
  }, true);

  function selectedText(): string {
    const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    try {
      if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT') && activeEl.selectionEnd! > activeEl.selectionStart!)
        return activeEl.value.slice(activeEl.selectionStart!, activeEl.selectionEnd!);
    } catch {
      // ignore
    }
    return document.getSelection()?.toString() ?? '';
  }

  const onCopy = (e: ClipboardEvent) => {
    if (copyMark > 0 || !active() || !settings.clipboard) return;
    const text = selectedText();
    if (text.trim().length < 6) return;
    const v = evaluateCommand(text, rules, context(true));
    if (v.level !== 'block') return;
    e.clipboardData?.setData('text/plain', safeText());
    e.preventDefault();
    reportVerdict('manual-copy', v, text);
  };
  window.addEventListener('copy', onCopy, true);
  window.addEventListener('cut', onCopy, true);

  window.addEventListener(
    'paste',
    (e) => {
      if (!active() || !settings.paste) return;
      const text = e.clipboardData?.getData('text/plain') ?? '';
      if (!text || !isConsentFixPaste(text, host, rules)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      present({ kind: 'paste', host, reasons: [{ id: 'consentfix', text: t('r_consentfix') }] });
      // The pasted link holds a sign-in code, so only a redacted copy goes in the log.
      log('paste', 'blocked', { reasons: ['consentfix'], command: text.replace(/([?&#](code|id_token|access_token|session_state|client_info)=)[^&#\s]+/gi, '$1[removed]').slice(0, 500) });
    },
    true,
  );

  window.addEventListener(
    'click',
    (e) => {
      const path = e.composedPath();
      const link = path.find((n): n is HTMLAnchorElement | HTMLAreaElement => n instanceof HTMLAnchorElement || n instanceof HTMLAreaElement);
      if (!link?.href || !externalScheme(link.href)) return;
      if (blockProtocol(link.href)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );

  const nav = (window as unknown as { navigation?: EventTarget }).navigation;
  nav?.addEventListener('navigate', (e) => {
    const ev = e as Event & { destination?: { url: string }; cancelable: boolean };
    const url = ev.destination?.url;
    if (url && externalScheme(url) && ev.cancelable && blockProtocol(url)) ev.preventDefault();
  });

  // ---- pages that only tell you what to paste ----
  function scanPage(): void {
    if (!active() || !settings.pageWarnings || scans > 8) return;
    scans++;
    const p = pageVerdict(true);
    if (!p.standalone) return;
    present({ kind: 'page-instructions', host, reasons: p.reasons.map((r) => ({ id: r.id, text: reasonText(r) })) });
    log('page-instructions', 'warned', { score: p.score, reasons: p.reasons.map((r) => r.id) });
    scans = 99;
  }

  function watchPage(): void {
    setTimeout(scanPage, 1200);
    let timer: number | undefined;
    const observer = new MutationObserver(() => {
      if (scans > 8) {
        observer.disconnect();
        return;
      }
      clearTimeout(timer);
      timer = window.setTimeout(scanPage, 1500);
    });
    if (document.body) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchPage, { once: true });
  else watchPage();

  // ---- reputation, top frame only ----
  if (isTop) {
    const showReputation = async () => {
      const status = await sendMessage<PageStatus>({ type: 'page-status', url: location.href });
      if (!status?.hits?.length) return;
      pageReported = true;
      if (!settings.reputation || !settings.enabled || status.trusted) return;
      const render = () =>
        showAlert({ kind: 'reputation', host, reasons: [], hits: status.hits }, overlayActions, settings.customWarning);
      if (document.documentElement) render();
      else document.addEventListener('DOMContentLoaded', render, { once: true });
      log('reputation', 'warned', {
        reasons: status.hits.flatMap((h) => h.records.map((r) => `${r.source}:${r.category}`)),
      });
    };
    void load().then(showReputation);
    try {
      browser.runtime.onMessage.addListener((msg: TabMessage) => {
        if (msg.type === 'reputation-update') void showReputation();
        if (msg.type === 'show-alert') showAlert(msg.alert, overlayActions, settings.customWarning);
      });
    } catch {
      // ignore
    }
  }
}
