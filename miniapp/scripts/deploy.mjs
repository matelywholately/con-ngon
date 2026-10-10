import './release-check.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const report = JSON.parse(await readFile('size-report.json', 'utf8'));
const template = await readFile('app-config.json');
try {
  // CLI consumes the root config; Zalo's generated HTML needs the built hashes.
  await writeFile('app-config.json', await readFile('dist/app-config.json'));
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--require', fileURLToPath(new URL('./require-tls.cjs', import.meta.url)),
      fileURLToPath(new URL('../node_modules/zmp-cli/index.js', import.meta.url)),
      'deploy', '--existing', '--testing', '--outputDir', 'dist', ...process.argv.slice(2)], {
      stdio: 'inherit', env: { ...process.env, APP_ID: report.miniAppId }, windowsHide: true,
    });
    child.on('error', reject); child.on('close', resolve);
  });
  if (code !== 0) throw new Error('Zalo upload did not complete');
} finally { await writeFile('app-config.json', template); }
