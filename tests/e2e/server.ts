// Local web server for the end-to-end tests. It serves the lure and benign
// page replicas and a small feed signed with the test key. The browser maps
// every *.test host to this server, so nothing leaves the machine.

import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const corpus = resolve(root, 'tests/corpus');
const PORT = 47123;

const key = createPrivateKey(readFileSync(resolve(root, 'tests/fixtures/test-signing-key.pem')));
const signB64 = (data: Buffer) => sign(null, data, key).toString('base64');

const feed = Buffer.from(
  JSON.stringify({
    format: 1,
    generated: new Date().toISOString(),
    sources: [
      { id: 'threatfox', name: 'ThreatFox', count: 2 },
      { id: 'urlhaus', name: 'URLhaus', count: 1 },
    ],
    entries: [
      ['h:reported.test', [['threatfox', 'malware', 'Lumma Stealer', '2026-10-01', 'https://threatfox.abuse.ch/ioc/1/', ['Lumma']]]],
      ['h:clickfix-site.test', [['threatfox', 'clickfix', 'ClearFake', '2026-10-20', 'https://threatfox.abuse.ch/ioc/2/', ['ClickFix', 'FakeCaptcha']]]],
      ['h:payload-reported.test', [['urlhaus', 'malware', '', '2026-10-25', 'https://urlhaus.abuse.ch/url/3/', ['ps1']]]],
    ],
  }),
);
const rules = readFileSync(resolve(root, 'rules/rules.json'));

const files: Record<string, Buffer> = {
  '/feed/v1/feed.json': feed,
  '/feed/v1/feed.json.sig': Buffer.from(signB64(feed)),
  '/feed/v1/rules.json': rules,
  '/feed/v1/rules.json.sig': Buffer.from(signB64(rules)),
};

const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.sig': 'text/plain' };

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const host = (req.headers.host ?? '').split(':')[0];
  if (process.env.LOG_REQUESTS) console.log(`${req.method} ${host}${url.pathname}`);
  let body = files[url.pathname];
  let type = TYPES[extname(url.pathname)] ?? 'text/plain';
  if (!body) {
    // Reputation test hosts all serve the same plain page.
    let path = url.pathname === '/' && host.endsWith('.test') ? '/site.html' : url.pathname;
    path = normalize(path).replace(/^([/\\])+/, '');
    const file = join(corpus, path);
    if (file.startsWith(corpus) && existsSync(file)) {
      body = readFileSync(file);
      type = TYPES[extname(file)] ?? 'text/plain';
    }
  }
  if (!body) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }).end(body);
}).listen(PORT, '127.0.0.1', () => console.log(`test server on ${PORT}`));
