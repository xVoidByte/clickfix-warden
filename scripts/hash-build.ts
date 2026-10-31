// Writes SHA256SUMS.txt for the store packages so anyone can check them against this repository.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(import.meta.dirname, '..', '.output');
const zips = readdirSync(dir).filter((f) => f.endsWith('.zip')).sort();
const lines = zips.map((f) => `${createHash('sha256').update(readFileSync(resolve(dir, f))).digest('hex')}  ${f}`);
writeFileSync(resolve(dir, 'SHA256SUMS.txt'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
