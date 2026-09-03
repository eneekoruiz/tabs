/**
 * @file ChordSvgRenderer.js
 * @description Generador visual SVG para diagramas de Guitarra, Ukelele y Piano.
 * Adaptado a Modo Oscuro / Claro con variables CSS semánticas de alto contraste.
 */

import { 
  GUITAR_CHORDS, 
  UKULELE_CHORDS, 
  PIANO_VOICINGS, 
  LATIN_TO_ANGLO_MAP,
  ALTERNATE_GUITAR_VOICINGS,
  ALTERNATE_UKULELE_VOICINGS
} from './ChordDefinitions.js';

export class ChordSvgRenderer {
  /**
   * Normaliza una clave de acorde (ej. "Mi" -> "E", "Solm" -> "Gm", "E/G#" -> "E")
   * @param {string} chordName
   * @returns {string}
   */
  static normalizeChordKey(chordName) {
    if (!chordName) return 'C';
    let name = String(chordName).trim();
    if (!name) return 'C';

    // 1. Quitar bajo alternativo (ej. "D/F#" -> "D")
    if (name.includes('/')) {
      name = name.split('/')[0].trim();
    }

    // 2. Normalizar notación latina si corresponde (ej. "DO", "Re", "Mi", "Fa", "Sol", "La", "Si")
    const latinMatch = name.match(/^(DO|RE|MI|FA|SOL|LA|SI)(#|b)?(.*)$/i);
    if (latinMatch) {
      const latinRoot = latinMatch[1].toUpperCase();
      const accidental = latinMatch[2] || '';
      const suffix = latinMatch[3] || '';
      const angloRoot = LATIN_TO_ANGLO_MAP[latinRoot] || 'C';
      name = `${angloRoot}${accidental}${suffix}`;
    }

    // 3. Normalizar términos en español ("Mayor", "menor")
    name = name
      .replace(/\s+mayor/i, '')
      .replace(/\s+menor/i, 'm')
      .replace(/maj/i, 'maj');

    return name;
  }

  /**
   * Simplifica un acorde complejo a su tríada básica o menor
   * @param {string} chord
   * @returns {string}
   */
  static simplifyChord(chord) {
    if (!chord) return 'C';
    const clean = this.normalizeChordKey(chord);
    const match = clean.match(/^([A-G][#b]?)(.*)$/);
    if (!match) return clean;

    const [, root, extension] = match;
    if (extension.startsWith('m') && !extension.startsWith('maj')) {
      return `${root}m`;
    }
    return root;
  }

  /**
   * Mapeo de enarmónicos directos
   */
  static getEnharmonic(root) {
    const ENHARMONICS = {
      'Db': 'C#', 'C#': 'Db',
      'Eb': 'D#', 'D#': 'Eb',
      'Gb': 'F#', 'F#': 'Gb',
      'Ab': 'G#', 'G#': 'Ab',
      'Bb': 'A#', 'A#': 'Bb'
    };
    return ENHARMONICS[root] || null;
  }

  /**
   * Obtiene la lista de voicings / posiciones disponibles para un acorde e instrumento
   */
  static getVoicings(chordName, instrument = 'guitar') {
    const key = this.normalizeChordKey(chordName);
    if (instrument === 'piano') {
      return [
        { index: 0, name: 'Posición Fundamental', detail: 'Tónica en el bajo (1 - 3 - 5)' },
        { index: 1, name: '1ª Inversión', detail: '3ª en el bajo (3 - 5 - 1)' },
        { index: 2, name: '2ª Inversión', detail: '5ª en el bajo (5 - 1 - 3)' }
      ];
    }

    const match = key.match(/^([A-G][#b]?)(.*)$/);
    const enh = match ? this.getEnharmonic(match[1]) : null;
    const enhKey = enh ? `${enh}${match[2]}` : null;

    if (instrument === 'ukulele') {
      const ukeVoicings = ALTERNATE_UKULELE_VOICINGS[key] || (enhKey ? ALTERNATE_UKULELE_VOICINGS[enhKey] : null);
      if (ukeVoicings) {
        return ukeVoicings.map((v, i) => ({ index: i, ...v }));
      }
      const base = this.getUkuleleChord(chordName);
      return [
        { index: 0, name: 'Posición Principal', detail: `Traste ${base.baseFret > 1 ? base.baseFret : '0 - 3'} · Sonido estándar`, ...base },
        { index: 1, name: 'Con Cejilla', detail: 'Forma cerrada en trastes medios' },
        { index: 2, name: 'Registro Agudo', detail: 'Tríada melódica para arreglos' }
      ];
    }

    // Guitarra
    const guitarVoicings = ALTERNATE_GUITAR_VOICINGS[key] || (enhKey ? ALTERNATE_GUITAR_VOICINGS[enhKey] : null);
    if (guitarVoicings) {
      return guitarVoicings.map((v, i) => ({ index: i, ...v }));
    }
    const v0 = this.getGuitarChord(chordName, 0);
    const v1 = this._computeCagedGuitarVoicing(key, 1) || (enhKey ? this._computeCagedGuitarVoicing(enhKey, 1) : null) || { name: 'Con Cejilla', detail: 'Forma de barra transportable', ...v0, baseFret: (v0.baseFret || 1) + 3 };
    const v2 = this._computeCagedGuitarVoicing(key, 2) || (enhKey ? this._computeCagedGuitarVoicing(enhKey, 2) : null) || { name: 'Registro Agudo', detail: 'Tríada alta en agudo', ...v0, baseFret: (v0.baseFret || 1) + 7 };
    return [
      { index: 0, name: 'Posición Abierta', detail: `Traste ${v0.baseFret > 1 ? v0.baseFret : '0 - 3'} · Sonido estándar`, ...v0 },
      { index: 1, ...v1 },
      { index: 2, ...v2 }
    ];
  }

  /**
   * Genera de forma algorítmica una variación CAGED real con cejilla y registro agudo
   * para cualquier acorde no contemplado explícitamente en el diccionario estático.
   */
  static _computeCagedGuitarVoicing(key, voicingIndex) {
    const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const match = key.match(/^([A-G][#b]?)(.*)$/);
    if (!match) return null;
    let root = match[1];
    const suffix = match[2].toLowerCase();
    let rootIdx = NOTES.indexOf(root);
    if (rootIdx === -1) {
      const enh = this.getEnharmonic(root);
      if (enh) rootIdx = NOTES.indexOf(enh);
    }
    if (rootIdx === -1) return null;

    const isMinor = suffix.startsWith('m') && !suffix.startsWith('maj');
    const is7 = suffix.includes('7') && !suffix.includes('maj');

    if (voicingIndex === 1) {
      const aRootFret = (rootIdx - 9 + 12) % 12 || 12;
      if (aRootFret >= 1 && aRootFret <= 9) {
        if (is7) {
          return { name: `Con Cejilla (Traste ${aRootFret})`, detail: `Traste ${aRootFret} · Forma de A7 con cejilla`, frets: [-1, aRootFret, aRootFret + 2, aRootFret, aRootFret + 2, aRootFret], fingers: [0, 1, 3, 1, 4, 1], baseFret: aRootFret, barres: [aRootFret] };
        } else if (isMinor) {
          return { name: `Con Cejilla (Traste ${aRootFret})`, detail: `Traste ${aRootFret} · Forma de Am con cejilla`, frets: [-1, aRootFret, aRootFret + 2, aRootFret + 2, aRootFret + 1, aRootFret], fingers: [0, 1, 3, 4, 2, 1], baseFret: aRootFret, barres: [aRootFret] };
        } else {
          return { name: `Con Cejilla (Traste ${aRootFret})`, detail: `Traste ${aRootFret} · Forma de A con cejilla`, frets: [-1, aRootFret, aRootFret + 2, aRootFret + 2, aRootFret + 2, aRootFret], fingers: [0, 1, 2, 3, 4, 1], baseFret: aRootFret, barres: [aRootFret] };
        }
      }
      const eRootFret = (rootIdx - 4 + 12) % 12 || 12;
      if (is7) {
        return { name: `Con Cejilla (Traste ${eRootFret})`, detail: `Traste ${eRootFret} · Forma de E7 con cejilla`, frets: [eRootFret, eRootFret + 2, eRootFret, eRootFret + 1, eRootFret, eRootFret], fingers: [1, 3, 1, 2, 1, 1], baseFret: eRootFret, barres: [eRootFret] };
      } else if (isMinor) {
        return { name: `Con Cejilla (Traste ${eRootFret})`, detail: `Traste ${eRootFret} · Forma de Em con cejilla`, frets: [eRootFret, eRootFret + 2, eRootFret + 2, eRootFret, eRootFret, eRootFret], fingers: [1, 3, 4, 1, 1, 1], baseFret: eRootFret, barres: [eRootFret] };
      } else {
        return { name: `Con Cejilla (Traste ${eRootFret})`, detail: `Traste ${eRootFret} · Forma de E con cejilla`, frets: [eRootFret, eRootFret + 2, eRootFret + 2, eRootFret + 1, eRootFret, eRootFret], fingers: [1, 3, 4, 2, 1, 1], baseFret: eRootFret, barres: [eRootFret] };
      }
    } else if (voicingIndex === 2) {
      const eRootFret = (rootIdx - 4 + 12) % 12 || 12;
      const targetFret = eRootFret >= 5 ? eRootFret : eRootFret + 12;
      if (isMinor) {
        return { name: `Registro Agudo (Traste ${targetFret})`, detail: `Trastes ${targetFret} - ${targetFret + 3} · Tríada melódica`, frets: [-1, -1, targetFret + 2, targetFret + 2, targetFret, targetFret], fingers: [0, 0, 3, 4, 1, 1], baseFret: targetFret, barres: [targetFret] };
      } else {
        return { name: `Registro Agudo (Traste ${targetFret})`, detail: `Trastes ${targetFret} - ${targetFret + 3} · Tríada brillante`, frets: [-1, -1, targetFret + 2, targetFret + 1, targetFret, targetFret], fingers: [0, 0, 3, 2, 1, 1], baseFret: targetFret, barres: [targetFret] };
      }
    }
    return null;
  }

  /**
   * Obtiene el voicing de guitarra verificado de forma determinista
   * @param {string} chordName
   * @param {number} voicingIndex
   * @returns {Object}
   */
  static getGuitarChord(chordName, voicingIndex = 0) {
    if (!chordName) return GUITAR_CHORDS['C'];
    const key = this.normalizeChordKey(chordName);

    const match = key.match(/^([A-G][#b]?)(.*)$/);
    const enh = match ? this.getEnharmonic(match[1]) : null;
    const enhKey = enh ? `${enh}${match[2]}` : null;

    // Revisar voicings alternativos específicos
    if (ALTERNATE_GUITAR_VOICINGS[key] && ALTERNATE_GUITAR_VOICINGS[key][voicingIndex]) {
      return ALTERNATE_GUITAR_VOICINGS[key][voicingIndex];
    }
    if (enhKey && ALTERNATE_GUITAR_VOICINGS[enhKey] && ALTERNATE_GUITAR_VOICINGS[enhKey][voicingIndex]) {
      return ALTERNATE_GUITAR_VOICINGS[enhKey][voicingIndex];
    }

    if (voicingIndex > 0) {
      const computed = this._computeCagedGuitarVoicing(key, voicingIndex) || (enhKey ? this._computeCagedGuitarVoicing(enhKey, voicingIndex) : null);
      if (computed) return computed;
    }

    if (GUITAR_CHORDS[key]) return GUITAR_CHORDS[key];

    // Búsqueda con enarmónico
    if (enhKey && GUITAR_CHORDS[enhKey]) {
      return GUITAR_CHORDS[enhKey];
    }

    // Búsqueda simplificada
    const simplified = this.simplifyChord(key);
    if (GUITAR_CHORDS[simplified]) return GUITAR_CHORDS[simplified];

    const simpMatch = simplified.match(/^([A-G][#b]?)(.*)$/);
    if (simpMatch) {
      const enh = this.getEnharmonic(simpMatch[1]);
      if (enh && GUITAR_CHORDS[`${enh}${simpMatch[2]}`]) {
        return GUITAR_CHORDS[`${enh}${simpMatch[2]}`];
      }
    }

    return GUITAR_CHORDS['C'];
  }

  /**
   * Obtiene el voicing de ukelele verificado de forma determinista (Failsafe Chord Library)
   * Garantiza que 'E' devuelva { frets: [4, 4, 4, 2], fingers: [2, 3, 4, 1], baseFret: 1, barres: [2] }
   * @param {string} chordName
   * @param {number} voicingIndex
   * @returns {Object}
   */
  static getUkuleleChord(chordName, voicingIndex = 0) {
    if (!chordName) return UKULELE_CHORDS['C'];
    const key = this.normalizeChordKey(chordName);

    const match = key.match(/^([A-G][#b]?)(.*)$/);
    const enh = match ? this.getEnharmonic(match[1]) : null;
    const enhKey = enh ? `${enh}${match[2]}` : null;

    // Revisar voicings alternativos específicos
    if (ALTERNATE_UKULELE_VOICINGS[key] && ALTERNATE_UKULELE_VOICINGS[key][voicingIndex]) {
      return ALTERNATE_UKULELE_VOICINGS[key][voicingIndex];
    }
    if (enhKey && ALTERNATE_UKULELE_VOICINGS[enhKey] && ALTERNATE_UKULELE_VOICINGS[enhKey][voicingIndex]) {
      return ALTERNATE_UKULELE_VOICINGS[enhKey][voicingIndex];
    }

    if (UKULELE_CHORDS[key]) return UKULELE_CHORDS[key];

    // Búsqueda con enarmónico
    if (enhKey && UKULELE_CHORDS[enhKey]) {
      return UKULELE_CHORDS[enhKey];
    }

    // Búsqueda simplificada
    const simplified = this.simplifyChord(key);
    if (UKULELE_CHORDS[simplified]) return UKULELE_CHORDS[simplified];

    const simpMatch = simplified.match(/^([A-G][#b]?)(.*)$/);
    if (simpMatch) {
      const enh = this.getEnharmonic(simpMatch[1]);
      if (enh && UKULELE_CHORDS[`${enh}${simpMatch[2]}`]) {
        return UKULELE_CHORDS[`${enh}${simpMatch[2]}`];
      }
    }

    return UKULELE_CHORDS['C'];
  }

  /**
   * Renderiza SVG de Guitarra con colores semánticos compatibles con modo oscuro
   * @param {string} chordName
   * @param {boolean} isLeftHanded
   * @param {number} voicingIndex
   * @returns {string}
   */
  static renderGuitar(chordName, isLeftHanded = false, voicingIndex = 0, displayName = null) {
    const chord = this.getGuitarChord(chordName, voicingIndex);
    if (!chord) return `<div class="chord-not-found">Acorde no disponible</div>`;

    const label = displayName || chordName;
    const width = 150;
    const height = 175;
    const startX = 25;
    const startY = 36;
    const stringGap = 20;
    const fretGap = 24;
    const numStrings = 6;
    const numFrets = 5;

    let frets = [...chord.frets];
    let fingers = [...(chord.fingers || [])];

    if (isLeftHanded) {
      frets.reverse();
      fingers.reverse();
    }

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="chord-diagram-svg guitar-svg" role="img" aria-label="Diagrama de guitarra ${label}">
        <text x="${width / 2}" y="20" text-anchor="middle" class="chord-diagram-title" fill="var(--text-primary, #ffffff)" font-weight="900" font-size="14">${label} (Guitarra)</text>

        ${chord.baseFret > 1 
          ? `<text x="10" y="${startY + 16}" fill="var(--accent-secondary, #00e5ff)" font-size="11" font-weight="bold">${chord.baseFret}fr</text>`
          : `<line x1="${startX}" y1="${startY}" x2="${startX + stringGap * (numStrings - 1)}" y2="${startY}" stroke="var(--chord-nut-color, var(--text-primary, #ffffff))" stroke-width="4" stroke-linecap="round"/>`
        }

        <!-- Trastes -->
        ${Array.from({ length: numFrets + 1 }, (_, f) => `
          <line class="chord-fret-line" x1="${startX}" y1="${startY + f * fretGap}" x2="${startX + stringGap * (numStrings - 1)}" y2="${startY + f * fretGap}" stroke="var(--chord-fret-color, rgba(255, 255, 255, 0.45))" stroke-width="1.5"/>
        `).join('')}

        <!-- Cuerdas Interactivas con Pluck Cuerda a Cuerda -->
        ${Array.from({ length: numStrings }, (_, s) => {
          const x = startX + s * stringGap;
          const fret = frets[s];
          return `
            <g class="chord-interactive-string" data-string-idx="${s}" data-fret="${fret}" style="cursor: pointer;">
              <line class="chord-string-line" x1="${x}" y1="${startY}" x2="${x}" y2="${startY + numFrets * fretGap}" stroke="var(--chord-string-color, rgba(255, 255, 255, 0.85))" stroke-width="1.6"/>
              <line class="chord-string-hitarea" x1="${x}" y1="${startY - 14}" x2="${x}" y2="${startY + numFrets * fretGap + 8}" stroke="transparent" stroke-width="16"/>
            </g>
          `;
        }).join('')}

        <!-- Marcadores Mute / Open -->
        ${frets.map((fret, s) => {
          const x = startX + s * stringGap;
          if (fret === -1) return `<text x="${x}" y="${startY - 6}" text-anchor="middle" fill="var(--status-danger, #ff5252)" font-size="12" font-weight="bold">✕</text>`;
          if (fret === 0) return `<circle cx="${x}" cy="${startY - 10}" r="3.5" fill="none" stroke="var(--status-success, #22c55e)" stroke-width="2"/>`;
          return '';
        }).join('')}

        <!-- Puntos y dedos -->
        ${frets.map((fret, s) => {
          if (fret > 0) {
            const displayFret = fret - (chord.baseFret > 1 ? chord.baseFret - 1 : 0);
            if (displayFret >= 1 && displayFret <= numFrets) {
              const cx = startX + s * stringGap;
              const cy = startY + (displayFret - 0.5) * fretGap;
              const finger = fingers[s] || '';
              return `
                <circle cx="${cx}" cy="${cy}" r="6.5" class="chord-finger-dot" fill="var(--accent-primary, #ff5722)"/>
                ${finger ? `<text x="${cx}" y="${cy + 3.5}" text-anchor="middle" fill="#ffffff" font-size="9" font-weight="900">${finger}</text>` : ''}
              `;
            }
          }
          return '';
        }).join('')}
      </svg>
    `;
  }

  /**
   * Renderiza SVG de Ukelele con colores semánticos compatibles con modo oscuro
   * @param {string} chordName
   * @param {boolean} isLeftHanded
   * @param {number} voicingIndex
   * @returns {string}
   */
  static renderUkulele(chordName, isLeftHanded = false, voicingIndex = 0, displayName = null) {
    const chord = this.getUkuleleChord(chordName, voicingIndex);
    if (!chord) return `<div class="chord-not-found">Acorde no disponible</div>`;

    const label = displayName || chordName;
    const width = 150;
    const height = 175;
    const startX = 35;
    const startY = 36;
    const stringGap = 26;
    const fretGap = 24;
    const numStrings = 4;
    const numFrets = 5;

    let frets = [...chord.frets];
    let fingers = [...(chord.fingers || [])];

    if (isLeftHanded) {
      frets.reverse();
      fingers.reverse();
    }

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="chord-diagram-svg ukulele-svg" role="img" aria-label="Diagrama de ukelele ${label}">
        <text x="${width / 2}" y="20" text-anchor="middle" class="chord-diagram-title" fill="var(--text-primary, #ffffff)" font-weight="900" font-size="14">${label} (Ukelele)</text>

        ${chord.baseFret > 1 
          ? `<text x="18" y="${startY + 16}" fill="var(--accent-secondary, #00e5ff)" font-size="11" font-weight="bold">${chord.baseFret}fr</text>`
          : `<line x1="${startX}" y1="${startY}" x2="${startX + stringGap * (numStrings - 1)}" y2="${startY}" stroke="var(--chord-nut-color, var(--text-primary, #ffffff))" stroke-width="4" stroke-linecap="round"/>`
        }

        <!-- Trastes -->
        ${Array.from({ length: numFrets + 1 }, (_, f) => `
          <line class="chord-fret-line" x1="${startX}" y1="${startY + f * fretGap}" x2="${startX + stringGap * (numStrings - 1)}" y2="${startY + f * fretGap}" stroke="var(--chord-fret-color, rgba(255, 255, 255, 0.45))" stroke-width="1.5"/>
        `).join('')}

        <!-- Cuerdas Interactivas con Pluck Cuerda a Cuerda -->
        ${Array.from({ length: numStrings }, (_, s) => {
          const x = startX + s * stringGap;
          const fret = frets[s];
          return `
            <g class="chord-interactive-string" data-string-idx="${s}" data-fret="${fret}" style="cursor: pointer;">
              <line class="chord-string-line" x1="${x}" y1="${startY}" x2="${x}" y2="${startY + numFrets * fretGap}" stroke="var(--chord-string-color, rgba(255, 255, 255, 0.85))" stroke-width="1.6"/>
              <line class="chord-string-hitarea" x1="${x}" y1="${startY - 14}" x2="${x}" y2="${startY + numFrets * fretGap + 8}" stroke="transparent" stroke-width="16"/>
            </g>
          `;
        }).join('')}

        <!-- Marcadores Mute / Open -->
        ${frets.map((fret, s) => {
          const x = startX + s * stringGap;
          if (fret === -1) return `<text x="${x}" y="${startY - 6}" text-anchor="middle" fill="var(--status-danger, #ff5252)" font-size="12" font-weight="bold">✕</text>`;
          if (fret === 0) return `<circle cx="${x}" cy="${startY - 10}" r="3.5" fill="none" stroke="var(--status-success, #22c55e)" stroke-width="2"/>`;
          return '';
        }).join('')}

        <!-- Puntos y dedos -->
        ${frets.map((fret, s) => {
          if (fret > 0) {
            const displayFret = fret - (chord.baseFret > 1 ? chord.baseFret - 1 : 0);
            if (displayFret >= 1 && displayFret <= numFrets) {
              const cx = startX + s * stringGap;
              const cy = startY + (displayFret - 0.5) * fretGap;
              const finger = fingers[s] || '';
              return `
                <circle cx="${cx}" cy="${cy}" r="7" class="chord-finger-dot" fill="var(--accent-secondary, #00e5ff)"/>
                ${finger ? `<text x="${cx}" y="${cy + 3.5}" text-anchor="middle" fill="#090d16" font-size="9" font-weight="900">${finger}</text>` : ''}
              `;
            }
          }
          return '';
        }).join('')}
      </svg>
    `;
  }

  /**
   * Renderiza SVG de Teclado de Piano con colores semánticos compatibles con modo oscuro
   * @param {string} chordName
   * @param {number} voicingIndex
   * @returns {string}
   */
  static renderPiano(chordName, voicingIndex = 0, displayName = null) {
    const match = chordName.match(/^([A-G][#b]?)(.*)$/);
    const enh = match ? this.getEnharmonic(match[1]) : null;
    const enhChordName = enh ? `${enh}${match[2]}` : null;
    const cleanName = this.simplifyChord(chordName);
    const enhCleanName = enhChordName ? this.simplifyChord(enhChordName) : null;

    let voicing = PIANO_VOICINGS[chordName] || 
                  (enhChordName ? PIANO_VOICINGS[enhChordName] : null) || 
                  PIANO_VOICINGS[cleanName] || 
                  (enhCleanName ? PIANO_VOICINGS[enhCleanName] : null) || 
                  [{ key: 'C', oct: 4 }, { key: 'E', oct: 4 }, { key: 'G', oct: 4 }];

    // Inversiones para piano
    if (voicingIndex === 1 && voicing.length >= 2) {
      voicing = [...voicing.slice(1), { ...voicing[0], oct: (voicing[0].oct || 4) + 1 }];
    } else if (voicingIndex === 2 && voicing.length >= 3) {
      voicing = [...voicing.slice(2), { ...voicing[0], oct: (voicing[0].oct || 4) + 1 }, { ...voicing[1], oct: (voicing[1].oct || 4) + 1 }];
    }

    const label = displayName || chordName;
    const width = 210;
    const height = 110;
    const startX = 10;
    const startY = 24;
    const whiteKeyWidth = 13.5;
    const whiteKeyHeight = 75;
    const blackKeyWidth = 9;
    const blackKeyHeight = 46;

    const whiteKeys = [
      { note: 'C', oct: 4 }, { note: 'D', oct: 4 }, { note: 'E', oct: 4 },
      { note: 'F', oct: 4 }, { note: 'G', oct: 4 }, { note: 'A', oct: 4 }, { note: 'B', oct: 4 },
      { note: 'C', oct: 5 }, { note: 'D', oct: 5 }, { note: 'E', oct: 5 },
      { note: 'F', oct: 5 }, { note: 'G', oct: 5 }, { note: 'A', oct: 5 }, { note: 'B', oct: 5 }
    ];

    const blackKeys = [
      { note: 'C#', oct: 4, pos: 0 }, { note: 'D#', oct: 4, pos: 1 },
      { note: 'F#', oct: 4, pos: 3 }, { note: 'G#', oct: 4, pos: 4 }, { note: 'A#', oct: 4, pos: 5 },
      { note: 'C#', oct: 5, pos: 7 }, { note: 'D#', oct: 5, pos: 8 },
      { note: 'F#', oct: 5, pos: 10 }, { note: 'G#', oct: 5, pos: 11 }, { note: 'A#', oct: 5, pos: 12 }
    ];

    const isWhiteActive = (k) => voicing.some(v => v.key === k.note && (v.oct === k.oct || (!v.oct && k.oct === 4)));
    const isBlackActive = (k) => voicing.some(v => {
      const vKey = v.key === 'Db' ? 'C#' : (v.key === 'Eb' ? 'D#' : (v.key === 'Gb' ? 'F#' : (v.key === 'Ab' ? 'G#' : (v.key === 'Bb' ? 'A#' : v.key))));
      return vKey === k.note && (v.oct === k.oct || (!v.oct && k.oct === 4));
    });

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="chord-diagram-svg piano-svg" role="img" aria-label="Diagrama de teclado ${label}">
        <text x="${width / 2}" y="15" text-anchor="middle" class="chord-diagram-title" fill="var(--text-primary, #ffffff)" font-weight="900" font-size="12">${label} (Piano)</text>

        ${whiteKeys.map((k, i) => {
          const x = startX + i * whiteKeyWidth;
          const active = isWhiteActive(k);
          return `
            <rect x="${x}" y="${startY}" width="${whiteKeyWidth}" height="${whiteKeyHeight}" rx="2" fill="${active ? 'var(--accent-primary, #ff5722)' : 'var(--piano-white-key, #ffffff)'}" stroke="var(--border-strong, #444444)" stroke-width="1.5"/>
            ${active ? `
              <circle cx="${x + whiteKeyWidth / 2}" cy="${startY + whiteKeyHeight - 12}" r="4" fill="#100d1c"/>
              <text x="${x + whiteKeyWidth / 2}" y="${startY + whiteKeyHeight - 9.5}" text-anchor="middle" fill="#ffffff" font-size="6.5" font-weight="900">${k.note}</text>
            ` : `
              <text x="${x + whiteKeyWidth / 2}" y="${startY + whiteKeyHeight - 4}" text-anchor="middle" fill="#222222" font-size="6" font-weight="700">${k.note}</text>
            `}
          `;
        }).join('')}

        ${blackKeys.map((k) => {
          const x = startX + (k.pos + 1) * whiteKeyWidth - (blackKeyWidth / 2);
          const active = isBlackActive(k);
          return `
            <rect x="${x}" y="${startY}" width="${blackKeyWidth}" height="${blackKeyHeight}" rx="2" fill="${active ? 'var(--accent-secondary, #00e5ff)' : 'var(--piano-black-key, #141420)'}" stroke="var(--border-strong, #333333)" stroke-width="1"/>
            ${active ? `
              <circle cx="${x + blackKeyWidth / 2}" cy="${startY + blackKeyHeight - 10}" r="3.5" fill="#100d1c"/>
              <text x="${x + blackKeyWidth / 2}" y="${startY + blackKeyHeight - 7.5}" text-anchor="middle" fill="#ffffff" font-size="5.5" font-weight="900">${k.note}</text>
            ` : ''}
          `;
        }).join('')}
      </svg>
    `;
  }
}

export default ChordSvgRenderer;
