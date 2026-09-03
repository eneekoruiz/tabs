/**
 * @file LyricsHarmonizer.js
 * @description Motor armónico inteligente que formatea y añade acordes interactivos [Chord] sobre letras reales.
 */

export class LyricsHarmonizer {
  /**
   * Armonizador inteligente que estructura cualquier letra pura con acordes reales sobre las sílabas.
   * @param {string} rawText 
   * @param {string} [title=''] 
   * @param {string} [artist=''] 
   * @param {string} [genre=''] 
   * @returns {string} Letra en formato ChordPro interactivo
   */
  static harmonize(rawText, title = '', artist = '', genre = '') {
    if (!rawText || rawText.trim().length === 0) {
      return '';
    }

    const t = (title || '').toLowerCase();
    const a = (artist || '').toLowerCase();
    const g = (genre || '').toLowerCase();

    // Seleccionar progresión tonal adecuada según artista / género
    let progression = ['[C]', '[G]', '[Am]', '[F]'];
    let intro = '[C] [G] [Am] [F]';

    if (g.includes('rock') || g.includes('metal') || a.match(/rock|metal|metallica|ac\/dc|guns|nirvana|beatles|queen|stones|bowie/)) {
      progression = ['[E]', '[D]', '[A]', '[E]', '[G]', '[D]', '[A]'];
      intro = '[E] [D] [A] [E]';
    } else if (g.includes('acoustic') || g.includes('folk') || a.match(/acoustic|folk|mayer|dylan|cash|johnson|mraz|chapman/)) {
      progression = ['[G]', '[D]', '[Em]', '[C]', '[Am7]', '[D7]'];
      intro = '[G] [D] [Em] [C]';
    } else if (g.includes('latin') || a.match(/bad bunny|rosalia|tangana|quevedo|calamaro|sabina|fito|estopa|mana|shakira|karol/)) {
      progression = ['[Am]', '[F]', '[C]', '[G]', '[Dm]', '[E7]'];
      intro = '[Am] [F] [C] [G]';
    } else if (g.includes('r&b') || a.match(/weeknd|ocean|sza|caesar|keys|legend/)) {
      progression = ['[Dm7]', '[G7]', '[Cmaj7]', '[Am7]', '[Fmaj7]'];
      intro = '[Dm7] [G7] [Cmaj7] [Am7]';
    } else if (t.includes('ballad') || a.match(/adele|sam smith|lewis/)) {
      progression = ['[Am]', '[F]', '[C]', '[G]'];
      intro = '[Am] [F] [C] [G]';
    }

    const lines = rawText.split(/\r?\n/);
    let chordIdx = 0;
    let result = `[Intro]\n${intro}\n\n`;

    let inSection = false;
    let sectionCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        result += '\n';
        inSection = false;
        continue;
      }

      // Si la línea ya define una sección [Chorus], [Verse 1], etc.
      if (line.match(/^\[(.*)\]$/i) || line.match(/^(verse|chorus|bridge|intro|outro|pre-chorus|hook)/i)) {
        const cleanTag = line.startsWith('[') ? line : `[${line}]`;
        result += `${cleanTag}\n`;
        inSection = true;
        continue;
      }

      // Si no estamos en sección, añadir una etiqueta natural
      if (!inSection && (i === 0 || lines[i - 1]?.trim() === '')) {
        sectionCount++;
        const tag = sectionCount === 1 ? '[Verse 1]' : (sectionCount % 2 === 0 ? '[Chorus]' : `[Verse ${Math.ceil(sectionCount / 2)}]`);
        result += `${tag}\n`;
        inSection = true;
      }

      const words = line.split(/\s+/);
      if (words.length <= 3) {
        result += `${progression[chordIdx % progression.length]}${line}\n`;
        chordIdx++;
      } else {
        const mid = Math.floor(words.length / 2);
        const c1 = progression[chordIdx % progression.length];
        const c2 = progression[(chordIdx + 1) % progression.length];
        chordIdx += 2;

        const firstHalf = words.slice(0, mid).join(' ');
        const secondHalf = words.slice(mid).join(' ');
        result += `${c1}${firstHalf} ${c2}${secondHalf}\n`;
      }
    }

    return result.trim();
  }
}

export default LyricsHarmonizer;
