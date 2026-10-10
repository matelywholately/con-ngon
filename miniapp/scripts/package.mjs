import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { checkLimits } from './limits.mjs';

const html = await readFile('dist/index.html', 'utf8');
const config = JSON.parse(await readFile('app-config.json', 'utf8'));
config.listCSS = Array.from(html.matchAll(/<link[^>]+href="\.\/([^"]+\.css)"/g), match => match[1]);
config.listSyncJS = Array.from(html.matchAll(/<script[^>]+src="\.\/([^"]+\.module\.js)"/g), match => match[1]);
config.listAsyncJS = [];
if (!config.listCSS.length || !config.listSyncJS.length) throw new Error('Missing Zalo bootstrap assets');
await writeFile('dist/app-config.json', JSON.stringify(config, null, 2) + '\n');
async function walk(dir, prefix = '') {
  const entries = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory()) entries.push(...await walk(`${dir}/${entry.name}`, `${path}/`));
    else if (entry.isFile()) entries.push({ path, data: await readFile(`${dir}/${entry.name}`) });
    else throw new Error('Unexpected package entry');
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}
const entries = await walk('dist');
for (const path of [...config.listCSS, ...config.listSyncJS]) if (!entries.some(entry => entry.path === path)) throw new Error('Broken bootstrap reference');
const files = entries.map(({ path, data }) => ({ path, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') }));
const metadata = JSON.parse(await readFile('.build-metadata.json', 'utf8'));
const report = { ...metadata, ...checkLimits(files), files };
await mkdir('release', { recursive: true });
const name = metadata.demo ? 'bua-kip-demo' : 'bua-kip-production';
// A standard stored ZIP, so compressed size cannot conceal an oversized app.
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
const local = [], central = []; let offset = 0;
for (const entry of entries) {
  const filename = Buffer.from(entry.path); const crc = crc32(entry.data);
  const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x800, 6); header.writeUInt16LE(33, 12); header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(entry.data.length, 18); header.writeUInt32LE(entry.data.length, 22); header.writeUInt16LE(filename.length, 26);
  local.push(header, filename, entry.data);
  const index = Buffer.alloc(46); index.writeUInt32LE(0x02014b50); index.writeUInt16LE(20, 4); index.writeUInt16LE(20, 6);
  index.writeUInt16LE(0x800, 8); index.writeUInt16LE(33, 14); index.writeUInt32LE(crc, 16);
  index.writeUInt32LE(entry.data.length, 20); index.writeUInt32LE(entry.data.length, 24); index.writeUInt16LE(filename.length, 28); index.writeUInt32LE(offset, 42);
  central.push(index, filename); offset += header.length + filename.length + entry.data.length;
}
const end = Buffer.alloc(22); const directory = Buffer.concat(central);
end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
await writeFile(`release/${name}.zip`, Buffer.concat([...local, directory, end]));
await writeFile(`release/${name}-size.json`, JSON.stringify(report, null, 2) + '\n');
await writeFile('size-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(`${name}: ${report.totalBytes} bytes; largest file ${report.largest.bytes} bytes. Package: release/${name}.zip`);
