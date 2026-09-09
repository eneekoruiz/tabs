import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, copyFile, lstat, realpath, readdir } from 'node:fs/promises';
import { resolve, relative, dirname, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = resolve(root, 'handoff', `antigravity-${stamp}`);
const git = (...args) => execFileSync('git', ['-c', 'core.safecrlf=false', ...args], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
const split = buffer => buffer.toString('utf8').split('\0').filter(Boolean);
const sha = data => createHash('sha256').update(data).digest('hex');
const within = path => { const rel = relative(root, path); return rel && !rel.startsWith('..') && !isAbsolute(rel); };
const allowed = path => !/^(?:handoff|node_modules|dist|test-results|playwright-report|\.git)\//.test(path)
  && !/(?:^|\/)(?:\.env(?:\..*)?|.*\.(?:log|pem|key|pfx|zip))$/i.test(path)
  && (/^(?:src|assets|tests|scripts|docs|reports)\//.test(path) || !path.includes('/'));
await mkdir(resolve(output, 'checks'), { recursive: true });
const checks = [];
function check(name, command, args) {
  let result, exitCode = 0;
  try { result = execFileSync(command, args, { cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024 }); }
  catch (error) { exitCode = error.status ?? -1; result = `${error.stdout || ''}\n${error.stderr || ''}\n${error.message}`; }
  checks.push({ name, exitCode, passed: exitCode === 0, log: `checks/${name}.txt` });
  return writeFile(resolve(output, 'checks', `${name}.txt`), result);
}
await check('unit-tests', process.execPath, ['--test', 'tests/catalog-quality.unit.mjs', 'tests/karaoke-timing.unit.mjs']);
await check('catalog-audit', process.execPath, ['scripts/audit-catalog.mjs']);
await check('offline-assets', process.execPath, ['scripts/verify-offline-assets.mjs']);
await check('build', process.execPath, ['scripts/build-static.mjs']);
await check('diff-check', 'git', ['-c', 'core.safecrlf=false', 'diff', '--check']);
let playwrightLastRun = null;
try {
  const raw = await readFile(resolve(root, 'test-results/.last-run.json'), 'utf8');
  playwrightLastRun = JSON.parse(raw);
  await writeFile(resolve(output, 'checks/playwright-last-run.json'), raw);
  for (const entry of await readdir(resolve(root, 'test-results'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      const context = await readFile(resolve(root, 'test-results', entry.name, 'error-context.md'), 'utf8');
      // Only failure metadata; don't bundle browser snapshots, lyrics or traces.
      await writeFile(resolve(output, 'checks', `failure-${sha(entry.name).slice(0, 12)}.md`), context.split('# Page snapshot')[0]);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const baseCommit = git('rev-parse', 'HEAD').toString().trim();
const branch = git('branch', '--show-current').toString().trim();
const tracked = split(git('diff', '--name-only', '-z', 'HEAD'));
const untracked = split(git('ls-files', '--others', '--exclude-standard', '-z'));
const patch = git('diff', '--binary', '--full-index', 'HEAD');
await writeFile(resolve(output, 'changes.patch'), patch);
const files = [], excluded = [];
for (const [kind, paths] of [['tracked', tracked], ['untracked', untracked]]) {
  for (const path of paths) {
    if (!allowed(path)) { excluded.push({ path, reason: 'Non-project artifact or sensitive-file pattern' }); continue; }
    const source = resolve(root, path);
    if (!within(source)) throw new Error(`Unsafe source path: ${path}`);
    let stat;
    try { stat = await lstat(source); } catch (error) {
      if (error.code !== 'ENOENT' || kind !== 'tracked') throw error;
      files.push({ path, kind, deleted: true }); continue;
    }
    if (!stat.isFile() || !within(await realpath(source))) throw new Error(`Not a regular in-workspace file: ${path}`);
    const data = await readFile(source);
    const destination = resolve(output, 'files', path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, data);
    files.push({ path, kind, bytes: data.length, sha256: sha(data) });
  }
}
await copyFile(resolve(root, 'docs/ANTIGRAVITY_HANDOFF.md'), resolve(output, 'LEEME-ANTIGRAVITY.md'));
const manifest = { formatVersion: 1, createdAt: new Date().toISOString(), baseCommit, branch,
  purpose: 'Review and continuation handoff, NOT a fully validated release',
  committed: false, pushed: false, completePlaywrightSuiteValidated: false,
  playwrightLastRun, checks, patchSha256: sha(patch), files, excluded };
await writeFile(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
for (const file of files.filter(file => !file.deleted)) {
  if (sha(await readFile(resolve(output, 'files', file.path))) !== file.sha256) throw new Error(`Copy verification failed: ${file.path}`);
}
console.log(JSON.stringify({ output, archive: `${output}.zip`, files: files.length, checks,
  completePlaywrightSuiteValidated: false, playwrightLastRun }, null, 2));
