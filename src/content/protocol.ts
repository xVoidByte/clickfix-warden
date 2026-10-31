// Event names shared by the page hooks and the guard, which catches them first in the capture phase so page code never sees them.
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

/** What lands in the clipboard instead of the attacker's command. Starts with # so shells treat it as a comment. */
export function safeText(): string {
  return '# ClickFix Warden blocked a dangerous command. Close this window and never paste commands from websites.';
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
