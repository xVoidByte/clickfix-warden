// Local server for the e2e tests with the page replicas and a feed signed by the test key, every *.test host maps here.

import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const corpus = resolve(root, 'tests/corpus');
const PORT = 47123;

const key = createPrivateKey(readFileSync(resolve(root, 'tests/fixtures/test-signing-key.pem')));
const signB64 = (data: Buffer) => sign(null, data, key).toString('base64');

const generated = new Date().toISOString();
const sources = [
  { id: 'threatfox', name: 'ThreatFox', count: 2 },
  { id: 'urlhaus', name: 'URLhaus', count: 2 },
];
const hot = Buffer.from(
  JSON.stringify({
    format: 2,
    part: 'hot',
    generated,
    sources,
    entries: [
      ['h:clickfix-site.test', [['threatfox', 'clickfix', 'ClearFake', '2026-10-20', '2', ['ClickFix', 'FakeCaptcha']]]],
      ['h:payload-reported.test', [['threatfox', 'malware', '', '2026-10-25', '3', []]]],
      ['h:reported.test', [['threatfox', 'malware', 'Lumma Stealer', '2026-10-01', '1', ['Lumma']]]],
    ],
  }),
);
const bulk = Buffer.from(
  JSON.stringify({
    format: 2,
    part: 'bulk',
    generated,
    sources,
    entries: [['u:download.test:47123/setup.exe', [['urlhaus', 'malware', '', '2026-10-28', '4', []]]]],
  }),
);
const delta = Buffer.from(
  JSON.stringify({
    format: 2,
    part: 'hot-delta',
    base: generated,
    generated: new Date(Date.parse(generated) + 60_000).toISOString(),
    sources,
    put: [['h:delta-added.test', [['threatfox', 'malware', 'Remcos', '2026-10-31', '5', []]]]],
    del: ['h:payload-reported.test'],
  }),
);
const rules = readFileSync(resolve(root, 'rules/rules.json'));

const files: Record<string, Buffer> = {};
for (const [name, data] of Object.entries({ 'hot.json': hot, 'bulk.json': bulk, 'hot-delta.json': delta, 'rules.json': rules })) {
  files[`/feed/v1/${name}`] = data;
  files[`/feed/v1/${name}.sig`] = Buffer.from(signB64(data));
}

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
