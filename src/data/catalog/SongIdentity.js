export function normalizeSongText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/['\u2019]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function songKey(title, artist) {
  return `${normalizeSongText(title)} --- ${normalizeSongText(artist)}`;
}

let lastTitle, lastArtist, normalizedTitle, normalizedArtist;

export function matchesSong(title, artist, titles, artists) {
  // Legacy sheet modules test many branches for the same identity synchronously.
  if (title !== lastTitle || artist !== lastArtist) {
    lastTitle = title;
    lastArtist = artist;
    normalizedTitle = normalizeSongText(title);
    normalizedArtist = normalizeSongText(artist);
  }
  return Boolean(normalizedArtist) && titles.includes(normalizedTitle) && artists.includes(normalizedArtist);
}
