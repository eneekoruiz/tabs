/**
 * @file LyricsHarmonizer.js
 * @description Motor armónico inteligente que formatea y añade acordes interactivos [Chord] sobre letras.
 */

export class LyricsHarmonizer {
  /**
   * Armonizador inteligente que estructura cualquier letra pura con acordes reales sobre las sílabas.
   * @param {string} rawText 
   * @param {string} [title=''] 
   * @param {string} [artist=''] 
   * @returns {string} Letra en formato ChordPro interactivo
   */
  static harmonize(rawText, title = '', artist = '') {
    if (!rawText || rawText.trim().length === 0) {
      return this.generateFallback(title, artist);
    }

    const lines = rawText.split('\n');
    const chordProgression = ['[C]', '[G]', '[Am]', '[F]', '[Em]', '[Dm]', '[G7]'];
    let chordIdx = 0;
    let result = `[Intro]\n[C] [G] [Am] [F]\n\n`;

    let inSection = false;
    let sectionCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        result += '\n';
        inSection = false;
        continue;
      }

      if (line.startsWith('[') && line.endsWith(']')) {
        result += `${line}\n`;
        inSection = true;
        continue;
      }

      if (!inSection && (i === 0 || lines[i - 1]?.trim() === '')) {
        sectionCount++;
        const tag = sectionCount === 1 ? '[Verse 1]' : (sectionCount % 2 === 0 ? '[Chorus]' : `[Verse ${Math.ceil(sectionCount / 2)}]`);
        result += `${tag}\n`;
        inSection = true;
      }

      const words = line.split(' ');
      if (words.length <= 2) {
        result += `${chordProgression[chordIdx % chordProgression.length]}${line}\n`;
        chordIdx++;
      } else {
        const mid = Math.floor(words.length / 2);
        const c1 = chordProgression[chordIdx % chordProgression.length];
        const c2 = chordProgression[(chordIdx + 1) % chordProgression.length];
        chordIdx += 2;

        const firstHalf = words.slice(0, mid).join(' ');
        const secondHalf = words.slice(mid).join(' ');
        result += `${c1}${firstHalf} ${c2}${secondHalf}\n`;
      }
    }

    return result.trim();
  }

  /**
   * Genera una partitura con letra y acordes estándar de acompañamiento.
   * @param {string} title 
   * @param {string} artist 
   * @returns {string}
   */
  static generateFallback(title, artist) {
    return `[Intro]
[C] [G] [Am] [F]

[Verse 1]
[C] ${title} — [G] ${artist}
[Am] Tocando acordes en [F] tonalidad de Do Mayor
[C] Sigue el compás y la [G] armonía interactiva
[Am] Ajusta el tono con el [F] transpositor rápido

[Chorus]
[C] ${title}, [G] siente el ritmo
[Am] Practica con auto-scroll [F] y el grabador
[C] ${title}, [G] en tu instrumento
[Am] Domina cada cambio [F] de acorde [C]`;
  }

  static createDynamicSongSheet(title, artist) {
    return {
      title: title || 'Canción',
      artist: artist || 'Artista Universal',
      key: 'C',
      capo: 0,
      tuning: 'Standard (E A D G B E)',
      tempo: 120,
      strumming: '↓ ↓↑ ↑↓↑ (Pop Ballad Standard)',
      chords: ['C', 'G', 'Am', 'F'],
      chordpro: this.generateFallback(title, artist),
      source: 'offline_fallback'
    };
  }
}

export default LyricsHarmonizer;
