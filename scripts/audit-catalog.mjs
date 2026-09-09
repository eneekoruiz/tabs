import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { UNIVERSAL_SONG_DATABASE } from '../src/data/lyrics/UniversalSongDatabase.js';
import { MEGA_CATALOG } from '../src/data/CatalogDataset.js';
import { offlineUniversalLibrary } from '../src/data/catalog/OfflineUniversalLibraryEngine.js';
import { getKnownSongLyrics } from '../src/data/lyrics/KnownSongLyrics.js';
import { resolveSongMetadata } from '../src/data/catalog/SongMetadataResolver.js';
import { songKey } from '../src/data/catalog/SongIdentity.js';
import { assessSong, summarizeQuality, plainLyricText } from '../src/data/catalog/CatalogQuality.js';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'reports/catalog-audit');
const hash = text => createHash('sha256').update(text).digest('hex');
const rows = [];
const add = (song, source, rowId) => {
  const text = String(song.lyricsChords || song.lyrics || '');
  rows.push({ rowId, identity: songKey(song.title, song.artist), title: song.title, artist: song.artist,
    version: song.versionId || song.versionName || null, source, quality: assessSong(song),
    textSha256: text ? hash(text) : null, plainSha256: text ? hash(plainLyricText(text).toLowerCase()) : null });
};
Object.entries(UNIVERSAL_SONG_DATABASE).forEach(([id, song]) => add(song, 'universal_repository', id));
MEGA_CATALOG.forEach((song, index) => add(song, 'mega_repository', `mega:${index}`));
for (const [key, song] of offlineUniversalLibrary.searchIndex) {
  add({ ...song, lyricsChords: getKnownSongLyrics(song.title, song.artist) || '',
    ...resolveSongMetadata(song.title, song.artist) }, 'effective_lyric_lookup', key);
}
const groupBy = key => {
  const groups = new Map();
  rows.forEach(row => { const value = row[key]; if (value) { if (!groups.has(value)) groups.set(value, []); groups.get(value).push(row); } });
  return [...groups.values()];
};
const conflictingTexts = groupBy('identity').filter(group => new Set(group.map(row => row.plainSha256).filter(Boolean)).size > 1)
  .map(group => ({ identity: group[0].identity, records: group.map(({ rowId, source, textSha256, quality }) => ({ rowId, source, textSha256, words: quality.wordCount })) }));
const sharedTexts = groupBy('plainSha256').filter(group => new Set(group.map(row => row.identity)).size > 1)
  .map(group => ({ sha256: group[0].plainSha256, identities: [...new Set(group.map(row => row.identity))] }));
const tempoConflicts = [];
for (const song of MEGA_CATALOG) {
  const meta = resolveSongMetadata(song.title, song.artist);
  if (meta.tempo && song.tempo && Number(meta.tempo) !== Number(song.tempo)) {
    tempoConflicts.push({ title: song.title, artist: song.artist, megaTempo: song.tempo, metadataTempo: meta.tempo });
  }
}
const inputs = [];
async function inventory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await inventory(path);
    else if (/\.(js|json)$/.test(path)) inputs.push({ path: relative(root, path).replaceAll('\\', '/'), sha256: hash(await readFile(path)) });
  }
}
await inventory(resolve(root, 'src/data/lyrics'));
await inventory(resolve(root, 'src/data/catalog'));
const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), scope: 'Bundled repository only; does not inspect browser IndexedDB or certify music against recordings.',
  summaries: Object.fromEntries(['universal_repository', 'mega_repository', 'effective_lyric_lookup'].map(source => [source, summarizeQuality(rows.filter(row => row.source === source))])),
  uniqueIdentities: new Set(rows.map(row => row.identity)).size,
  conflictingTexts, sharedTexts, tempoConflicts, inputs: inputs.sort((a, b) => a.path.localeCompare(b.path)), rows };
const effective = report.summaries.effective_lyric_lookup;
const markdown = `# Auditoría del catálogo incluido\n\nGenerada: ${report.generatedAt}\n\n## Resultado\n\n` +
  `Se revisan estructuralmente **${effective.records} entradas del índice**, además de ${report.summaries.universal_repository.records} registros de letras y ${MEGA_CATALOG.length} arreglos del catálogo pequeño. No son cantidades que se puedan sumar como canciones únicas.\n\n` +
  `| Comprobación del índice | Registros |\n|---|---:|\n| Con texto de letra | ${effective.withLyrics} |\n| Con marcas de acordes | ${effective.withChords} |\n| Con tempo declarado | ${effective.withTempo} |\n| Con tiempos de letra | ${effective.withTiming} |\n| Con melodía vocal | ${effective.withVocalMelody} |\n| Con grabación offline comprobada | ${effective.withOfflineAudio} |\n| Autenticidad musical verificada | 0 |\n\n` +
  `**No hay ninguna canción certificada como karaoke completo y original.** La presencia de texto, acordes o BPM no demuestra su corrección. Los audios importados por el usuario pertenecen a IndexedDB y quedan fuera de este informe del repositorio.\n\n` +
  `## Discrepancias para revisión\n\n- ${conflictingTexts.length} identidades tienen textos diferentes entre fuentes locales. Pueden ser versiones legítimas o recortes; no se decide automáticamente.\n- ${sharedTexts.length} grupos comparten texto entre identidades distintas. Puede haber versiones, traducciones o duplicados.\n- ${tempoConflicts.length} canciones tienen BPM contradictorios entre dos tablas del repositorio.\n\n` +
  `## Límites y criterio de aceptación\n\nCada versión necesita identidad de grabación, fuentes y permisos por recurso; letra íntegra contrastada, acordes revisados, tempo o mapa de tempo medido, audio reproducible y marcas temporales comprobadas contra ESE audio. Una melodía vocal requiere notas y duraciones revisadas. Ni un algoritmo armónico ni un archivo LRC certifican lo anterior.\n\nEl informe JSON incluye una fila por registro, incidencias y huellas SHA-256 sin reproducir las letras. El CSV permite priorizar revisiones. No se ha borrado contenido del usuario.\n`;
const csvCell = value => '"' + String(value ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"';
const csv = [['source', 'title', 'artist', 'identity', 'words', 'chords', 'tempo', 'issues'],
  ...rows.map(row => [row.source, row.title, row.artist, row.identity, row.quality.wordCount,
    row.quality.chordCount, row.quality.tempo, row.quality.issues.join('|')])].map(row => row.map(csvCell).join(',')).join('\n');
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'catalog-audit.json'), JSON.stringify(report, null, 2));
await writeFile(resolve(output, 'catalog-audit.csv'), '\ufeff' + csv);
await writeFile(resolve(output, 'README.md'), markdown);
console.log(JSON.stringify({ summaries: report.summaries, uniqueIdentities: report.uniqueIdentities,
  textConflicts: conflictingTexts.length, sharedTextGroups: sharedTexts.length, tempoConflicts, output }, null, 2));
