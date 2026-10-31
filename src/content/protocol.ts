// Event names shared by the page-world hooks and the isolated guard script.
// Both run at document_start before any page script, and the guard listens in
// the capture phase on window and stops propagation, so page code never sees
// or answers these events.
export const EVT = {
  ping: 'cfw:ping',
  check: 'cfw:check',
  signal: 'cfw:signal',
  mark: 'cfw:copymark',
} as const;

export type CheckKind = 'clipboard-write' | 'set-data' | 'exec-copy' | 'fullscreen' | 'keyboard-lock' | 'protocol';

export interface CheckDetail {
  kind: CheckKind;
  payload: string;
}

export interface SignalDetail {
  kind: 'web3';
  net: 'mainnet' | 'testnet';
  host: string;
}

const SAFE_TEXT = {
  en: '# ClickFix Warden blocked a dangerous command. Close this window and never paste commands from websites.',
  bg: '# ClickFix Warden спря опасна команда. Затворете този прозорец и никога не поставяйте команди от сайтове.',
};

/** What lands in the clipboard instead of the attacker's command. Starts with # so shells treat it as a comment. */
export function safeText(lang?: string): string {
  const l = (lang ?? (typeof navigator !== 'undefined' ? navigator.language : 'en') ?? 'en').toLowerCase();
  return l.startsWith('bg') ? SAFE_TEXT.bg : SAFE_TEXT.en;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
