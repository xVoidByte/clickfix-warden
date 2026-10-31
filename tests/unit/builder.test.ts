import { describe, expect, it } from 'vitest';
import { ageDays, type BuildOptions, type Entries, fromFeodo, fromThreatfox, fromUrlhaus, parseCsvLine } from '../../feed-builder/sources';
import { BUNDLED_RULES } from '../../src/engine/rules';

// Synthetic rows in the abuse.ch export layout, with reserved test names only.
const now = new Date('2026-10-31T12:00:00Z');
const opts: BuildOptions = {
  clickfixTags: BUNDLED_RULES.feed.clickfixTags,
  noHostLevel: BUNDLED_RULES.feed.noHostLevel,
  now,
  maxAgeDays: 30,
  ipMaxAgeDays: 30,
  minConfidence: 50,
  minIpConfidence: 75,
};

const URLHAUS = `################################################################
# abuse.ch URLhaus Database Dump (CSV - recent URLs)           #
################################################################
#
# id,dateadded,url,url_status,last_online,threat,tags,urlhaus_link,reporter
"9001","2026-10-30 08:00:00","https://cdn.example.invalid/v.ps1","online","2026-10-31 10:00:00","malware_download","ClickFix,ps1","https://urlhaus.abuse.ch/url/9001/","tester"
"9002","2026-10-29 08:00:00","http://192.0.2.10/i.sh","offline","2026-10-29 09:00:00","malware_download","elf,mirai","https://urlhaus.abuse.ch/url/9002/","tester"
"9003","2026-08-01 08:00:00","http://old.example.invalid/x.exe","offline","2026-08-01 09:00:00","malware_download","exe","https://urlhaus.abuse.ch/url/9003/","tester"
"9004","2026-10-30 08:00:00","https://raw.githubusercontent.com/someone/repo/main/a.exe","online","","malware_download","exe","https://urlhaus.abuse.ch/url/9004/","tester"
`;

const THREATFOX = `# ThreatFox IOCs: CSV export
# "first_seen_utc","ioc_id","ioc_value","ioc_type","threat_type","fk_malware","malware_alias","malware_printable","last_seen_utc","confidence_level","is_compromised","reference","tags","anonymous","reporter"
"2026-10-20 10:00:00","101","lure.example.invalid","domain","payload_delivery","js.clearfake","None","ClearFake","","100","0","","ClickFix,FakeCaptcha","0","tester"
"2026-10-21 10:00:00","102","https://evil.example.invalid/gate.php","url","payload_delivery","win.lumma","None","Lumma Stealer","","75","0","","Lumma","0","tester"
"2026-10-22 10:00:00","103","192.0.2.50:443","ip:port","botnet_cc","win.remcos","None","Remcos","","100","0","","Remcos","0","tester"
"2026-10-22 10:00:00","104","192.0.2.51:443","ip:port","botnet_cc","win.remcos","None","Remcos","","50","0","","Remcos","0","tester"
"2026-10-22 10:00:00","105","github.com","domain","payload_delivery","unknown","None","Unknown malware","","100","0","","","0","tester"
"2026-10-22 10:00:00","106","lowconf.example.invalid","domain","payload_delivery","unknown","None","Unknown malware","","25","0","","","0","tester"
"2026-10-22 10:00:00","107","0123456789abcdef0123456789abcdef","md5_hash","payload","win.lumma","None","Lumma Stealer","","100","0","","","0","tester"
`;

const FEODO = JSON.stringify([
  { ip_address: '192.0.2.60', port: 443, status: 'online', first_seen: '2026-10-01 00:00:00', last_online: '2026-10-30', malware: 'QakBot' },
  { ip_address: '192.0.2.61', port: 443, status: 'offline', first_seen: '2025-01-01 00:00:00', last_online: '2026-03-12', malware: 'Emotet' },
]);

describe('csv reader', () => {
  it('handles quotes, doubled quotes and commas in fields', () => {
    expect(parseCsvLine('"a","b,c","d ""e"""')).toEqual(['a', 'b,c', 'd "e"']);
  });
  it('reads abuse.ch dates', () => {
    expect(ageDays('2026-10-30 12:00:00', now)).toBe(1);
    expect(ageDays('2026-10-30', now)).toBe(1.5);
    expect(ageDays('', now)).toBe(Infinity);
  });
});

describe('URLhaus', () => {
  const entries: Entries = new Map();
  const count = fromUrlhaus(URLHAUS, opts, entries);
  it('keeps recent and online addresses and drops old offline ones', () => {
    expect(count).toBe(3);
    expect(entries.has('u:old.example.invalid/x.exe')).toBe(false);
  });
  it('marks ClickFix tags', () => {
    expect(entries.get('u:cdn.example.invalid/v.ps1')?.[0][1]).toBe('clickfix');
    expect(entries.get('u:192.0.2.10/i.sh')?.[0][1]).toBe('malware');
  });
  it('never lists a whole shared host', () => {
    expect(entries.has('h:raw.githubusercontent.com')).toBe(false);
    expect(entries.has('u:raw.githubusercontent.com/someone/repo/main/a.exe')).toBe(true);
  });
});

describe('ThreatFox', () => {
  const entries: Entries = new Map();
  fromThreatfox(THREATFOX, opts, entries);
  it('adds domains, URLs and confident IPs', () => {
    expect(entries.get('h:lure.example.invalid')?.[0]).toEqual([
      'threatfox',
      'clickfix',
      'ClearFake',
      '2026-10-20',
      'https://threatfox.abuse.ch/ioc/101/',
      ['ClickFix', 'FakeCaptcha'],
    ]);
    expect(entries.get('u:evil.example.invalid/gate.php')?.[0][1]).toBe('malware');
    expect(entries.get('i:192.0.2.50')?.[0][1]).toBe('c2');
  });
  it('skips weak, shared and non-network reports', () => {
    expect(entries.has('i:192.0.2.51')).toBe(false);
    expect(entries.has('h:github.com')).toBe(false);
    expect(entries.has('h:lowconf.example.invalid')).toBe(false);
    expect([...entries.keys()].some((k) => k.includes('0123456789abcdef'))).toBe(false);
  });
});

describe('Feodo Tracker', () => {
  it('keeps only recently active servers', () => {
    const entries: Entries = new Map();
    fromFeodo(FEODO, opts, entries);
    expect(entries.has('i:192.0.2.60')).toBe(true);
    expect(entries.has('i:192.0.2.61')).toBe(false);
  });
});
