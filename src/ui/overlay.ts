// In-page warnings, drawn inside a closed shadow root so page styles and
// scripts cannot read or restyle them. All page-supplied text goes in through
// textContent, never as HTML.

import type { DisplayPart } from '../engine/types';
import type { FeedHit } from '../feed/types';
import { SOURCE_NAMES } from '../feed/types';
import { t } from '../shared/i18n';
import type { AlertData } from '../shared/messages';

export interface OverlayActions {
  leave(): void;
  trust(host: string): void;
  copyAnyway?(text: string): Promise<boolean>;
}

const DIALOG_KINDS = new Set(['clipboard', 'manual-copy', 'paste', 'protocol', 'fullscreen']);

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.wrap { --bg:#ffffff; --fg:#1b1f24; --muted:#57606a; --line:#d0d7de; --code:#f3f4f6; --accent:#0b57d0; --danger:#b3261e; --dangerbg:#fdecea; --gap:#e8def8; --gapfg:#4a2c8f;
  font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: var(--fg); }
@media (prefers-color-scheme: dark) {
  .wrap { --bg:#1e2228; --fg:#e6e8eb; --muted:#9aa4af; --line:#3a414b; --code:#14171b; --accent:#8ab4f8; --danger:#f2b8b5; --dangerbg:#3b1d1b; --gap:#3b2f5c; --gapfg:#d7c8ff; }
}
.backdrop { position: fixed; inset: 0; background: rgba(10,12,16,.62); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 2147483647; }
.card { background: var(--bg); color: var(--fg); width: 100%; max-width: 580px; max-height: calc(100vh - 32px); overflow: auto; border-radius: 14px; border: 1px solid var(--line); box-shadow: 0 18px 60px rgba(0,0,0,.35); padding: 22px 22px 18px; }
.brand { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 12px; font-weight: 600; letter-spacing: .02em; text-transform: uppercase; }
.brand svg { width: 18px; height: 18px; flex: none; }
h1 { font-size: 20px; line-height: 1.3; margin: 10px 0 8px; color: var(--danger); font-weight: 700; }
p { margin: 0 0 10px; }
.note { background: var(--dangerbg); border-radius: 10px; padding: 10px 12px; margin: 10px 0; }
.label { font-size: 12px; font-weight: 600; color: var(--muted); margin: 14px 0 6px; text-transform: uppercase; letter-spacing: .02em; }
.cmd { font: 12.5px/1.5 ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace; background: var(--code); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; white-space: pre-wrap; word-break: break-all; max-height: 180px; overflow: auto; margin: 0; }
.gapchip { display: inline-block; font: 11px/1.6 system-ui, sans-serif; background: var(--gap); color: var(--gapfg); border-radius: 6px; padding: 0 6px; margin: 0 4px; white-space: nowrap; }
ul { margin: 0; padding-left: 20px; }
li { margin: 2px 0; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
.secondary { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; justify-content: space-between; align-items: center; }
button { font: inherit; font-weight: 600; border-radius: 9px; padding: 9px 16px; cursor: pointer; border: 1px solid var(--line); background: transparent; color: var(--fg); }
button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
@media (prefers-color-scheme: dark) { button.primary { color: #0b1a33; } }
button.link { border: none; padding: 6px 4px; color: var(--accent); font-weight: 500; }
button.hold { color: var(--danger); border-color: var(--danger); font-weight: 500; font-size: 13px; padding: 7px 12px; }
button:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.banner { position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647; background: var(--bg); color: var(--fg); border-bottom: 3px solid var(--danger); box-shadow: 0 6px 24px rgba(0,0,0,.25); padding: 12px 16px; display: flex; gap: 12px; align-items: flex-start; }
.banner svg { width: 22px; height: 22px; flex: none; margin-top: 2px; }
.banner .text { flex: 1; min-width: 0; }
.banner strong { color: var(--danger); display: block; margin-bottom: 2px; }
.banner .meta { color: var(--muted); font-size: 13px; }
.banner a { color: var(--accent); }
.banner .btns { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.banner button { padding: 6px 12px; font-size: 13px; }
.close { border: none; font-size: 20px; line-height: 1; padding: 4px 8px; color: var(--muted); }
`;

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Red shield with an exclamation mark, built node by node. */
function shield(): SVGSVGElement {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  const body = document.createElementNS(SVG_NS, 'path');
  body.setAttribute('fill', '#c5221f');
  body.setAttribute('d', 'M12 2 4 5v6c0 5 3.4 9.6 8 11 4.6-1.4 8-6 8-11V5l-8-3z');
  const mark = document.createElementNS(SVG_NS, 'path');
  mark.setAttribute('fill', '#fff');
  mark.setAttribute('d', 'M11 7h2v6h-2zm0 8h2v2h-2z');
  s.append(body, mark);
  return s;
}

let hostEl: HTMLElement | null = null;
let shadow: ShadowRoot | null = null;
let dialogOpen = false;
const shownBanners = new Set<string>();

function root(): ShadowRoot {
  if (hostEl && shadow && hostEl.isConnected) return shadow;
  hostEl = document.createElement('cfw-warden');
  hostEl.setAttribute('style', 'all: initial !important; display: block !important; position: static !important;');
  shadow = hostEl.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = CSS;
  shadow.appendChild(style);
  (document.documentElement ?? document).appendChild(hostEl);
  return shadow;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}


function renderCommand(parts: DisplayPart[], decoded: string[] | undefined): HTMLElement {
  const box = el('pre', 'cmd');
  let shown = 0;
  for (const part of parts) {
    if (shown > 1200) {
      box.append('…');
      break;
    }
    if (part.t === 'gap') box.append(el('span', 'gapchip', t('overlayGap', String(part.n))));
    else {
      const v = part.v.length > 1200 - shown ? part.v.slice(0, 1200 - shown) + '…' : part.v;
      shown += v.length;
      box.append(v);
    }
  }
  if (decoded?.length) {
    for (const d of decoded.slice(0, 3)) {
      box.append('\n\n');
      box.append(el('span', 'gapchip', t('overlayDecoded')));
      box.append('\n' + (d.length > 800 ? d.slice(0, 800) + '…' : d));
    }
  }
  return box;
}

function title(kind: AlertData['kind']): [string, string] {
  switch (kind) {
    case 'manual-copy':
      return [t('alertManualTitle'), t('alertManualBody')];
    case 'paste':
      return [t('alertPasteTitle'), t('alertPasteBody')];
    case 'protocol':
      return [t('alertProtocolTitle'), t('alertProtocolBody')];
    case 'fullscreen':
      return [t('alertFullscreenTitle'), t('alertFullscreenBody')];
    default:
      return [t('alertClipboardTitle'), t('alertClipboardBody')];
  }
}

export function showAlert(alert: AlertData, actions: OverlayActions, customWarning = ''): void {
  if (DIALOG_KINDS.has(alert.kind)) showDialog(alert, actions, customWarning);
  else showBanner(alert, actions);
}

function showDialog(alert: AlertData, actions: OverlayActions, customWarning: string): void {
  if (dialogOpen) return;
  const r = root();
  dialogOpen = true;
  const wrap = el('div', 'wrap');
  const backdrop = el('div', 'backdrop');
  const card = el('div', 'card');
  card.setAttribute('role', 'alertdialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-labelledby', 'cfw-title');
  card.setAttribute('aria-describedby', 'cfw-body');

  const brand = el('div', 'brand');
  brand.append(shield(), 'ClickFix Warden');
  const [heading, body] = title(alert.kind);
  const h1 = el('h1', undefined, heading);
  h1.id = 'cfw-title';
  const p = el('p', undefined, body);
  p.id = 'cfw-body';
  card.append(brand, h1, p);
  if (alert.detail) card.append(el('p', undefined, alert.detail));
  if (customWarning) card.append(el('div', 'note', customWarning));

  if (alert.display?.length) {
    card.append(el('div', 'label', t('overlayWouldRun')), renderCommand(alert.display, alert.decoded));
  }
  if (alert.reasons.length) {
    card.append(el('div', 'label', t('overlayWhy')));
    const ul = el('ul');
    const seen = new Set<string>();
    for (const reason of alert.reasons) {
      if (seen.has(reason.text)) continue;
      seen.add(reason.text);
      ul.append(el('li', undefined, reason.text));
      if (seen.size >= 6) break;
    }
    card.append(ul);
  }

  const close = () => {
    backdrop.remove();
    dialogOpen = false;
    document.removeEventListener('keydown', onKey, true);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey, true);

  const leave = el('button', 'primary', t('overlayLeave'));
  leave.title = t('overlayLeaveTip');
  leave.addEventListener('click', () => {
    close();
    actions.leave();
  });
  const dismiss = el('button', undefined, t('overlayClose'));
  dismiss.title = t('overlayCloseTip');
  dismiss.addEventListener('click', close);
  const row = el('div', 'actions');
  row.append(leave, dismiss);
  card.append(row);

  const secondary = el('div', 'secondary');
  const trust = el('button', 'link', t('overlayTrust'));
  trust.title = t('overlayTrustTip');
  trust.addEventListener('click', () => {
    close();
    actions.trust(alert.host);
  });
  secondary.append(trust);
  if (alert.original && actions.copyAnyway) secondary.append(holdButton(alert.original, actions.copyAnyway));
  card.append(secondary);

  backdrop.append(card);
  wrap.append(backdrop);
  r.append(wrap);
  leave.focus();
}

function holdButton(text: string, copy: (text: string) => Promise<boolean>): HTMLButtonElement {
  const HOLD = 3;
  const btn = el('button', 'hold', t('overlayHold'));
  btn.title = t('overlayHoldTip');
  let timer: number | undefined;
  let left = HOLD;
  const reset = () => {
    if (timer) clearInterval(timer);
    timer = undefined;
    left = HOLD;
    if (!btn.disabled) btn.textContent = t('overlayHold');
  };
  btn.addEventListener('pointerdown', () => {
    if (btn.disabled) return;
    left = HOLD;
    btn.textContent = t('overlayHolding', String(left));
    timer = window.setInterval(async () => {
      left--;
      if (left > 0) {
        btn.textContent = t('overlayHolding', String(left));
        return;
      }
      clearInterval(timer);
      timer = undefined;
      const ok = await copy(text);
      btn.disabled = ok;
      btn.textContent = ok ? t('overlayCopied') : t('overlayHold');
    }, 1000);
  });
  btn.addEventListener('pointerup', reset);
  btn.addEventListener('pointerleave', reset);
  return btn;
}

function hitSummary(hits: FeedHit[]): string {
  const parts: string[] = [];
  for (const hit of hits) {
    for (const r of hit.records) {
      const bits = [SOURCE_NAMES[r.source], t('category_' + r.category)];
      if (r.malware) bits.push(r.malware);
      if (r.firstSeen) bits.push(t('bannerFirstSeen', r.firstSeen));
      parts.push(bits.join(', '));
      if (parts.length >= 3) return parts.join(' | ');
    }
  }
  return parts.join(' | ');
}

function showBanner(alert: AlertData, actions: OverlayActions): void {
  if (shownBanners.has(alert.kind)) return;
  shownBanners.add(alert.kind);
  const r = root();
  const wrap = el('div', 'wrap');
  const bar = el('div', 'banner');
  bar.setAttribute('role', 'alert');
  const text = el('div', 'text');
  let headline = t('bannerPageInstructions');
  if (alert.kind === 'reputation') headline = t('bannerReputation');
  if (alert.kind === 'web3-loader') headline = t('bannerWeb3');
  text.append(el('strong', undefined, headline));
  if (alert.kind === 'reputation' && alert.hits?.length) {
    const meta = el('div', 'meta', hitSummary(alert.hits) + ' ');
    const ref = alert.hits.flatMap((h) => h.records).find((rec) => /^https:\/\/(urlhaus|threatfox|feodotracker)\.abuse\.ch\//.test(rec.ref));
    if (ref) {
      const a = el('a', undefined, t('bannerDetails'));
      a.href = ref.ref;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      meta.append(a);
    }
    text.append(meta);
  } else if (alert.detail) {
    text.append(el('div', 'meta', alert.detail));
  }
  const btns = el('div', 'btns');
  const leave = el('button', 'primary', t('overlayLeave'));
  leave.title = t('overlayLeaveTip');
  leave.addEventListener('click', () => actions.leave());
  const trust = el('button', undefined, t('overlayTrust'));
  trust.title = t('overlayTrustTip');
  trust.addEventListener('click', () => {
    bar.remove();
    actions.trust(alert.host);
  });
  const close = el('button', 'close', '×');
  close.title = t('overlayCloseTip');
  close.setAttribute('aria-label', t('overlayClose'));
  close.addEventListener('click', () => bar.remove());
  btns.append(leave, trust, close);
  bar.append(shield(), text, btns);
  wrap.append(bar);
  r.append(wrap);
}
