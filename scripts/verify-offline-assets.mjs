import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const toWebPath = (path) => `./${relative(root, path).replaceAll('\\', '/')}`;

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

const [indexHtml, workerSource, manifestSource] = await Promise.all([
  readFile(join(root, 'index.html'), 'utf8'),
  readFile(join(root, 'sw.js'), 'utf8'),
  readFile(join(root, 'manifest.json'), 'utf8'),
]);

const cached = new Set(
  [...workerSource.matchAll(/['"](\.\/[^'"]+)['"]/g)]
    .map((match) => match[1].split('?')[0])
);

const required = new Set(['./index.html', './manifest.json']);
const manifest = JSON.parse(manifestSource);
for (const icon of manifest.icons || []) {
  if (icon?.src && !icon.src.startsWith('data:') && !icon.src.startsWith('http')) {
    required.add(icon.src.startsWith('./') ? icon.src : './' + icon.src);
  }
}
for (const match of indexHtml.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
  const source = match[1].split('?')[0];
  if (!source.startsWith('data:') && !source.startsWith('http')) {
    required.add(source.startsWith('./') ? source : `./${source}`);
  }
}

const sourceFiles = await walk(join(root, 'src'));
for (const file of sourceFiles) {
  if (extname(file) === '.js' && file !== join(root, 'src', 'main.js')) required.add(toWebPath(file));
}

const cssFiles = await walk(join(root, 'assets', 'css'));
for (const file of cssFiles) {
  if (extname(file) === '.css') required.add(toWebPath(file));
}

const vendorFiles = await walk(join(root, 'assets', 'vendor'));
for (const file of vendorFiles) {
  if (['.js', '.mjs', '.woff2', '.sf2'].includes(extname(file))) required.add(toWebPath(file));
}

const vocalIndex = JSON.parse(await readFile(join(root,'assets/data/vocal-references/index.json'),'utf8'));
required.add('./assets/data/vocal-references/index.json');
for(const reference of vocalIndex.references) required.add('./'+reference.path);
const readyIndex=JSON.parse(await readFile(join(root,'assets/practice/index.json'),'utf8'));
required.add('./assets/practice/index.json');
required.add('./assets/data/online-karaoke.json');
for(const pack of readyIndex.packs)for(const name of new Set([pack.chart,pack.instrumentalChart,...(pack.id==='shearer-stay-with-me'?[pack.files.original,pack.files.instrumental]:[]),'license.txt'].filter(Boolean))) required.add('./assets/practice/'+pack.id+'/'+name);

const missing = [...required].filter((asset) => !cached.has(asset)).sort();
const stale = [...cached].filter((asset) => {
  if (asset === './' || asset === './index.html') return false;
  return !required.has(asset);
}).sort();

if (missing.length) {
  console.error(`Offline cache is missing ${missing.length} required assets:`);
  missing.forEach((asset) => console.error(`- ${asset}`));
  process.exitCode = 1;
} else {
  console.log(`Offline cache covers ${required.size}/${required.size} required assets.`);
}

if (stale.length) {
  console.warn(`Offline cache contains ${stale.length} additional assets.`);
}
