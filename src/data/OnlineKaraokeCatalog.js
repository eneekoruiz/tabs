// Public provider links only. Recordings remain in the provider's official player.
const normalize = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
export const onlineKaraokeKey = song => normalize(String(song?.artist || '').replace(/^the\s+/i, '')) + '::' + normalize(song?.title);
let pending;
export function buildKaraokeProviderSearch(song) {
  return 'https://karaokenerds.com/Search?' + new URLSearchParams({ query: [song?.artist, song?.title].filter(Boolean).join(' '), webFilter: 'OnlyWeb' });
}
export function validateOnlineKaraokeCatalog(data) {
  if (data?.schemaVersion !== 1 || !Array.isArray(data.matches) || data.matches.length > 20_000 || !Array.isArray(data.listedSongs)) throw Error('Índice de karaoke inválido');
  const validSong = row => typeof row.title === 'string' && row.title.trim() && typeof row.artist === 'string' && row.artist.trim() && /^https:\/\/karaokenerds\.com\/Song\/[^?#]+\/$/.test(row.sourceUrl || '');
  const keys = new Set();
  for (const row of data.matches) {
    const key = onlineKaraokeKey(row);
    if (!validSong(row) || !/^[A-Za-z0-9_-]{11}$/.test(row.videoId || '') || typeof row.channel !== 'string' || !/karaoke|instrumental/i.test(row.videoTitle || '') || keys.has(key)) throw Error('Fuente de karaoke inválida');
    keys.add(key);
  }
  if (data.listedSongs.length > 20_000 || data.listedSongs.some(row => !validSong(row))) throw Error('Búsquedas de karaoke inválidas');
  return data;
}
export async function getOnlineKaraokeCatalog() {
  if (!pending) pending = fetch(new URL('../../assets/data/online-karaoke.json', import.meta.url)).then(async response => {
    if (!response.ok) throw Error('No se pudo cargar el catálogo de karaoke online');
    return validateOnlineKaraokeCatalog(await response.json());
  }).catch(error => { pending = null; throw error; });
  return pending;
}
export async function findOnlineKaraoke(song) {
  const data = await getOnlineKaraokeCatalog();
  const key = onlineKaraokeKey(song);
  return data.matches.find(row => onlineKaraokeKey(row) === key) || data.listedSongs.find(row => onlineKaraokeKey(row) === key) || null;
}
export async function loadOnlineKaraoke(videoId) {
  const data = await getOnlineKaraokeCatalog();
  const track = data.matches.find(row => row.videoId === videoId);
  if (!track) throw Error('El karaoke elegido no está disponible');
  return { ...track, id: 'online-karaoke-' + videoId, karaokeVideoId: videoId, onlineKaraokeSource: track, contentSource: 'online_karaoke', lyricsChords: '{comment:La letra y los tiempos están en el vídeo del proveedor.}', _openOnlineKaraoke: true, _practiceRecovery: { performanceMode: 'sing', karaokePositionMs: 0 } };
}
