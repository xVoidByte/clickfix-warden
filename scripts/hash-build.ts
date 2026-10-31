// Writes SHA-256 hashes of every store package next to them, so anyone can
// check that a package in a store matches the one built from this repository.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(import.meta.dirname, '..', '.output');
const zips = readdirSync(dir).filter((f) => f.endsWith('.zip')).sort();
const lines = zips.map((f) => `${createHash('sha256').update(readFileSync(resolve(dir, f))).digest('hex')}  ${f}`);
writeFileSync(resolve(dir, 'SHA256SUMS.txt'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
