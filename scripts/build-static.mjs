import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDir = join(projectRoot, 'dist');
const runtimeEntries = ['index.html', 'manifest.json', 'sw.js', 'assets', 'src'];

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

for (const entry of runtimeEntries) {
  const source = join(projectRoot, entry);
  await stat(source);
  await cp(source, join(outputDir, entry), { recursive: true });
}

console.log(`Static bundle ready: ${outputDir}`);
