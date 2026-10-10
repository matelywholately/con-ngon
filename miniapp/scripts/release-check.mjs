import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { checkRelease } from './limits.mjs';

const report = JSON.parse(await readFile('size-report.json', 'utf8'));
checkRelease(report);
async function paths(dir, prefix = '') {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) result.push(...await paths(`${dir}/${entry.name}`, `${prefix}${entry.name}/`));
    else result.push(`${prefix}${entry.name}`);
  }
  return result.sort();
}
const actual = await paths('dist');
if (JSON.stringify(actual) !== JSON.stringify(report.files.map(file => file.path).sort())) throw new Error('Package changed. Rebuild before deploying.');
for (const file of report.files) {
  const data = await readFile(`dist/${file.path}`);
  if (data.length !== file.bytes || createHash('sha256').update(data).digest('hex') !== file.sha256) throw new Error('Package changed. Rebuild before deploying.');
}
console.log('Package configuration and size checks passed. Device tests and Zalo review are still required.');
