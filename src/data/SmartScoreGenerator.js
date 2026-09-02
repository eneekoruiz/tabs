const cmap = {
  'C': '3.5 2.4 0.3 1.2 0.1', 'G': '3.6 2.5 0.4 0.3 0.2 3.1', 'D': '0.4 2.3 3.2 2.1',
  'A': '0.5 2.4 2.3 2.2 0.1', 'E': '0.6 2.5 2.4 1.3 0.2 0.1', 'F': '1.6 3.5 3.4 2.3 1.2 1.1',
  'B': '2.5 4.4 4.3 4.2 2.1', 'Am': '0.5 2.4 2.3 1.2 0.1', 'Em': '0.6 2.5 2.4 0.3 0.2 0.1',
  'Dm': '0.4 2.3 3.2 1.1', 'Bm': '2.5 4.4 4.3 3.2 2.1', 'F#m': '2.6 4.5 4.4 2.3 2.2 2.1',
  'C#m': '4.5 6.4 6.3 5.2 4.1', 'G#m': '4.6 6.5 6.4 4.3 4.2 4.1', 'Cm': '3.5 5.4 5.3 4.2 3.1',
  'Gm': '3.6 5.5 5.4 3.3 3.2 3.1', 'Fm': '1.6 3.5 3.4 1.3 1.2 1.1', 'Bbm': '1.5 3.4 3.3 2.2 1.1',
  'Eb': '3.5 5.4 5.3 5.2 3.1', 'Ab': '4.6 6.5 6.4 5.3 4.2 4.1', 'Db': '4.5 6.4 6.3 6.2 4.1',
  'Bb': '1.5 3.4 3.3 3.2 1.1'
};

export class SmartScoreGenerator {
  static generate(song) {
    const title = String(song.title || 'Sin título').replace(/"/g, '\\"');
    const artist = String(song.artist || 'Artista desconocido').replace(/"/g, '\\"');
    const tempo = Number(song.tempo) || 120;
    const timeSig = song.timeSignature || '4/4';
    const is34 = timeSig.includes('3/');
    
    // Parsear acordes y letras del ChordPro
    let segments = [];
    if (song.lyricsChords) {
      // Extraemos el texto completo para intentar mapear acordes con la palabra siguiente
      const regex = /\[([A-G][#b]?(?:m|maj|dim|aug|sus|add)?\d*)\]([^\[\n\r]*)/g;
      let m;
      while ((m = regex.exec(song.lyricsChords)) !== null) {
        const chord = m[1];
        const lyric = m[2].trim().split(' ')[0].replace(/"/g, '').replace(/\\/g, ''); // Tomamos solo la primera palabra
        segments.push({ chord, lyric });
      }
    }
    
    if (segments.length === 0) {
      segments = [
        { chord: 'C', lyric: 'Start' }, { chord: 'G', lyric: '' }, 
        { chord: 'Am', lyric: '' }, { chord: 'F', lyric: '' }
      ];
    }

    // Cabecera global
    let tex = `\\title "${title}" \\artist "${artist}" \\tempo ${tempo} .\n\n`;

    // PISTA 1: GUITARRA RÍTMICA
    tex += `\\track "Guitarra Rítmica"\n\\tuning E2 A2 D3 G3 B3 E4\n\\instrument acousticguitar\n.\n`;
    
    for (let i = 0; i < segments.length; i++) {
      let { chord, lyric } = segments[i];
      let cleanChord = chord.replace(/7|maj7|sus4|sus2|add9/g, '');
      let tChord = cmap[cleanChord] || cmap[chord] || cmap['C'];
      
      let annotation = lyric ? `*${lyric}* ` : '';
      
      if (is34) {
        // Patrón 3/4: D DU DU
        tex += `${annotation}:4 (${tChord}) :8 (${tChord}) :8 (${tChord}) :8 (${tChord}) :8 (${tChord}) |\n`;
      } else {
        // Patrón 4/4: D DU D DU (Rock/Pop clásico)
        if (song.genre === 'Acoustic') {
          // Arpegio simple: Root, resto, root, resto
          const notes = tChord.split(' ');
          const root = notes[0];
          const rest = notes.slice(1).join(' ');
          tex += `${annotation}:4 ${root} :8 (${rest}) :8 (${rest}) :4 ${root} :4 (${rest}) |\n`;
        } else {
          tex += `${annotation}:4 (${tChord}) :8 (${tChord}) :8 (${tChord}) :4 (${tChord}) :8 (${tChord}) :8 (${tChord}) |\n`;
        }
      }
    }

    // PISTA 2: BAJO
    tex += `\n\\track "Bajo"\n\\tuning E1 A1 D2 G2\n\\instrument fingeredbass\n.\n`;
    
    for (let i = 0; i < segments.length; i++) {
      let { chord } = segments[i];
      let cleanChord = chord.replace(/7|maj7|sus4|sus2|add9/g, '');
      let tChord = cmap[cleanChord] || cmap[chord] || cmap['C'];
      
      // Extraer nota tónica para el bajo
      const rootGuitar = tChord.split(' ')[0]; // Ej: 3.5
      let [fret, string] = rootGuitar.split('.');
      let bassString = parseInt(string) - 2;
      if (bassString < 1) bassString = 1;
      
      const bassNote = `${fret}.${bassString}`;
      
      if (is34) {
        // Bajo en 3/4: Tónica, silencio, silencio o Tónica en cada pulso
        tex += `:4 ${bassNote} :4 ${bassNote} :4 ${bassNote} |\n`;
      } else {
        // Bajo en 4/4: Ocho corcheas (Pop/Rock Bassline)
        tex += `:8 ${bassNote} :8 ${bassNote} :8 ${bassNote} :8 ${bassNote} :8 ${bassNote} :8 ${bassNote} :8 ${bassNote} :8 ${bassNote} |\n`;
      }
    }

    return tex;
  }
}
