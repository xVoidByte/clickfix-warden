import type { DisplayPart, Normalized } from './types';

// Zero-width, bidi control and soft hyphen characters that render as nothing.
const INVISIBLE = /[\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
// Blank characters used to push the real command out of sight in the Run box.
const BLANK = /[\t \u00A0\u1680\u2000-\u200A\u202F\u205F\u2800\u3000\u3164]/;
const BLANK_RUN = /[\t \u00A0\u1680\u2000-\u200A\u202F\u205F\u2800\u3000\u3164]{8,}/g;

const LATIN = /[a-z]/i;
const CONFUSABLE_SCRIPT = /[\u0370-\u03FF\u0400-\u04FF]/;

// Cyrillic and Greek letters that look like Latin ones.
const FOLD: Record<string, string> = {
  а: 'a', в: 'b', е: 'e', ё: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't', у: 'y', х: 'x',
  і: 'i', ї: 'i', ј: 'j', ѕ: 's', ԁ: 'd', ԛ: 'q', ԝ: 'w', ӏ: 'l', һ: 'h', ү: 'y',
  α: 'a', β: 'b', ε: 'e', ι: 'i', κ: 'k', ν: 'v', ο: 'o', ρ: 'p', τ: 't', υ: 'u', χ: 'x', ϲ: 'c',
};

const MAX_INPUT = 50_000;
const MAX_DECODED = 6;

export function normalize(input: string): Normalized {
  let text = String(input ?? '');
  if (text.length > MAX_INPUT) text = text.slice(0, MAX_INPUT);

  const invisible = INVISIBLE.test(text);
  INVISIBLE.lastIndex = 0;
  text = text.replace(INVISIBLE, '');
  text = text.normalize('NFKC');

  const maxSpaceRun = longestBlankRun(text);
  const display = buildDisplay(text);

  const homoglyph = hasMixedScriptWord(text);

  let obfuscation = false;
  let work = text;

  // cmd caret escapes, p^o^w^e^r^s^h^e^l^l
  const carets = work.match(/(?<=[a-z0-9])\^(?=[a-z0-9])/gi);
  if (carets && carets.length >= 2) {
    obfuscation = true;
    work = work.replace(/(?<=[a-z0-9])\^(?=[a-z0-9])/gi, '');
  }
  // PowerShell backtick escapes inside words, p`ow`ershell
  const ticks = work.match(/(?<=[a-z])`(?=[a-z])/gi);
  if (ticks && ticks.length >= 2) {
    obfuscation = true;
    work = work.replace(/(?<=[a-z])`(?=[a-z])/gi, '');
  }
  // String concatenation, 'pow'+'ershell' and "Dow"+"nloadString"
  if (/(['"])\s*\+\s*\1/.test(work)) {
    obfuscation = true;
    work = work.replace(/(['"])\s*\+\s*\1/g, '');
  }
  // Empty quotes in the middle of a word, p""owershell
  if (/(?<=[a-z])(""|'')(?=[a-z])/i.test(work)) {
    obfuscation = true;
    work = work.replace(/(?<=[a-z])(""|'')(?=[a-z])/gi, '');
  }
  // [char]112+[char]111 sequences
  const charCodes = work.match(/\[char\]\s*(0x[0-9a-f]+|\d+)/gi);
  if (charCodes && charCodes.length >= 3) {
    obfuscation = true;
    work = work.replace(/\[char\]\s*(0x[0-9a-f]+|\d+)\s*\+?\s*/gi, (_m, code: string) => {
      const n = code.toLowerCase().startsWith('0x') ? parseInt(code, 16) : parseInt(code, 10);
      return Number.isFinite(n) && n > 0 && n < 0x10000 ? String.fromCharCode(n) : '';
    });
  }
  // Variable substring tricks, %PUBLIC:~5,1%
  const substrings = work.match(/%\w+:~-?\d+,-?\d+%/g);
  if (substrings && substrings.length >= 2) obfuscation = true;

  work = work
    .replace(/%comspec%|\$env:comspec/gi, 'cmd.exe')
    .replace(/%(systemroot|windir)%/gi, 'c:\\windows');

  const decoded = decodeBase64Parts(work);
  const base64 = decoded.length > 0;

  const parts = [collapse(work)];
  for (const d of decoded) parts.push(collapse(d));
  if (homoglyph) parts.push(fold(collapse(work)));
  const match = parts.join('\n').toLowerCase();

  return {
    match,
    display,
    decoded,
    maxSpaceRun,
    padding: false,
    invisible,
    homoglyph,
    obfuscation,
    base64,
  };
}

/** Marks the padding flag against a threshold that comes from the rules. */
export function withPadding(norm: Normalized, paddingMin: number): Normalized {
  return { ...norm, padding: norm.maxSpaceRun >= paddingMin };
}

function collapse(s: string): string {
  return s.replace(/[\s\u00A0\u2800\u3164]+/g, ' ').trim();
}

function fold(s: string): string {
  let out = '';
  for (const ch of s.toLowerCase()) out += FOLD[ch] ?? ch;
  return out;
}

function longestBlankRun(s: string): number {
  let best = 0;
  let run = 0;
  for (const ch of s) {
    if (BLANK.test(ch)) {
      run++;
      if (run > best) best = run;
    } else run = 0;
  }
  return best;
}

function buildDisplay(s: string): DisplayPart[] {
  const parts: DisplayPart[] = [];
  let last = 0;
  BLANK_RUN.lastIndex = 0;
  for (let m = BLANK_RUN.exec(s); m; m = BLANK_RUN.exec(s)) {
    if (m.index > last) parts.push({ t: 'text', v: s.slice(last, m.index) });
    parts.push({ t: 'gap', n: m[0].length });
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push({ t: 'text', v: s.slice(last) });
  // Trim leading and trailing blank text so the box starts with the command.
  if (parts.length && parts[0].t === 'text') parts[0] = { t: 'text', v: parts[0].v.replace(/^\s+/, '') };
  const end = parts[parts.length - 1];
  if (end && end.t === 'text') parts[parts.length - 1] = { t: 'text', v: end.v.replace(/\s+$/, '') };
  return parts.filter((p) => p.t === 'gap' || p.v.length > 0);
}

function hasMixedScriptWord(s: string): boolean {
  for (const word of s.split(/\s+/)) {
    if (word.length < 3) continue;
    if (LATIN.test(word) && CONFUSABLE_SCRIPT.test(word)) return true;
  }
  return false;
}

const B64_TOKEN = /(?:^|[^A-Za-z0-9+/=])([A-Za-z0-9+/]{20,}={0,2})(?![A-Za-z0-9+/=])/g;

function decodeBase64Parts(s: string, depth = 0): string[] {
  const out: string[] = [];
  if (depth > 1) return out;
  B64_TOKEN.lastIndex = 0;
  const tokens: string[] = [];
  for (let m = B64_TOKEN.exec(s); m && tokens.length < MAX_DECODED; m = B64_TOKEN.exec(s)) tokens.push(m[1]);
  for (const token of tokens) {
    const text = tryDecode(token);
    if (!text) continue;
    out.push(text);
    for (const inner of decodeBase64Parts(text, depth + 1)) out.push(inner);
    if (out.length >= MAX_DECODED) break;
  }
  return out;
}

function tryDecode(token: string): string | null {
  if (token.length > 40_000) return null;
  // Long runs of one letter or plain words are not Base64 payloads.
  if (/^[a-z]+$/i.test(token) && !/[A-Z]/.test(token.slice(1))) return null;
  let bin: string;
  try {
    bin = atob(token.length % 4 === 0 ? token : token + '='.repeat(4 - (token.length % 4)));
  } catch {
    return null;
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  let text: string;
  let zeros = 0;
  for (let i = 1; i < bytes.length; i += 2) if (bytes[i] === 0) zeros++;
  if (bytes.length >= 4 && zeros >= bytes.length / 2 / 2) {
    text = new TextDecoder('utf-16le').decode(bytes);
  } else {
    text = new TextDecoder('utf-8').decode(bytes);
  }
  if (!/[a-z]{2}/i.test(text)) return null;
  let printable = 0;
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    if ((c >= 32 && c < 127) || c === 9 || c === 10 || c === 13 || c >= 0xa0) printable++;
  }
  return printable / Math.max(1, text.length) >= 0.85 ? text : null;
}
