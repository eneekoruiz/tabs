import { parseVocalReference } from '../audio/VocalReference.js';
const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
let pendingIndex;
export async function getPublicVocalReferences() {
  pendingIndex ||= fetch(new URL('../../assets/data/vocal-references/index.json', import.meta.url)).then(async response => {
    if (!response.ok) throw new Error('No se pudo abrir el catálogo de melodías.');
    const data = await response.json();
    if (data.schemaVersion !== 1 || !Array.isArray(data.references)) throw new Error('Catálogo de melodías no compatible.');
    return data.references;
  }).catch(error => { pendingIndex = null; throw error; });
  return pendingIndex;
}
export async function findPublicVocalReferences(song) {
  const references = await getPublicVocalReferences();
  return references.filter(ref => normalize(ref.title) === normalize(song.title) && normalize(ref.artist) === normalize(song.artist));
}
export async function loadPublicVocalReference(ref) {
  if (!/^[a-f0-9]{40}$/.test(ref.id)) throw new Error('Referencia desconocida.');
  const response = await fetch(new URL('../../assets/data/vocal-references/' + ref.id + '.json', import.meta.url));
  if (!response.ok) throw new Error('No se pudo cargar esta melodía.');
  const text = await response.text(), parsed = parseVocalReference(text);
  if (normalize(parsed.title) !== normalize(ref.title) || normalize(parsed.artist) !== normalize(ref.artist)) throw new Error('La identidad de la melodía no coincide.');
  return new File([text], ref.title + '-reference.json', { type: 'application/json' });
}
