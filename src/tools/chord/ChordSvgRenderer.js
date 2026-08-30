/**
 * @file ChordSvgRenderer.js
 * @description Generador visual SVG para diagramas de Guitarra, Ukelele y Piano.
 */

import { GUITAR_CHORDS, UKULELE_CHORDS, PIANO_VOICINGS } from './ChordDefinitions.js';

export class ChordSvgRenderer {
  static simplifyChord(chord) {
    if (!chord) return 'C';
    const clean = chord.trim();
    const baseChord = clean.split('/')[0];
    const match = baseChord.match(/^([A-G][#b]?)(.*)$/);
    if (!match) return baseChord;

    const [, root, extension] = match;
    if (extension.startsWith('m') && !extension.startsWith('maj')) {
      return `${root}m`;
    }
    return root;
  }

  static getGuitarChord(chordName) {
    if (!chordName) return null;
    const name = chordName.trim();
    if (GUITAR_CHORDS[name]) return GUITAR_CHORDS[name];
    const simplified = this.simplifyChord(name);
    return GUITAR_CHORDS[simplified] || GUITAR_CHORDS['C'];
  }

  static getUkuleleChord(chordName) {
    if (!chordName) return null;
    const name = chordName.trim();
    if (UKULELE_CHORDS[name]) return UKULELE_CHORDS[name];
    const simplified = this.simplifyChord(name);
    return UKULELE_CHORDS[simplified] || UKULELE_CHORDS['C'];
  }

  static renderGuitar(chordName, isLeftHanded = false) {
    const chord = this.getGuitarChord(chordName);
    if (!chord) return `<div class="chord-not-found">Acorde no disponible</div>`;

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
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="chord-diagram-svg guitar-svg" role="img" aria-label="Diagrama de guitarra ${chordName}">
        <text x="${width / 2}" y="20" text-anchor="middle" class="chord-diagram-title" fill="var(--accent-primary)" font-weight="900" font-size="14">${chordName} (Guitarra)</text>

        ${chord.baseFret > 1 
          ? `<text x="10" y="${startY + 16}" fill="var(--accent-secondary, #00e5ff)" font-size="11" font-weight="bold">${chord.baseFret}fr</text>`
          : `<line x1="${startX}" y1="${startY}" x2="${startX + stringGap * (numStrings - 1)}" y2="${startY}" stroke="var(--text-primary)" stroke-width="4"/>`
        }

        ${Array.from({ length: numFrets + 1 }, (_, f) => `
          <line x1="${startX}" y1="${startY + f * fretGap}" x2="${startX + stringGap * (numStrings - 1)}" y2="${startY + f * fretGap}" stroke="var(--border-strong)" stroke-width="1.5"/>
        `).join('')}

        ${Array.from({ length: numStrings }, (_, s) => `
          <line x1="${startX + s * stringGap}" y1="${startY}" x2="${startX + s * stringGap}" y2="${startY + numFrets * fretGap}" stroke="var(--border-strong)" stroke-width="1.5"/>
        `).join('')}

        ${frets.map((fret, s) => {
          const x = startX + s * stringGap;
          if (fret === -1) return `<text x="${x}" y="${startY - 6}" text-anchor="middle" fill="var(--error-color, #e53935)" font-size="11" font-weight="bold">✕</text>`;
          if (fret === 0) return `<circle cx="${x}" cy="${startY - 10}" r="3.5" fill="none" stroke="var(--success-color, #00e676)" stroke-width="2"/>`;
          return '';
        }).join('')}

        ${frets.map((fret, s) => {
          if (fret > 0) {
            const displayFret = fret - (chord.baseFret > 1 ? chord.baseFret - 1 : 0);
            if (displayFret >= 1 && displayFret <= numFrets) {
              const cx = startX + s * stringGap;
              const cy = startY + (displayFret - 0.5) * fretGap;
              const finger = fingers[s] || '';
              return `
                <circle cx="${cx}" cy="${cy}" r="6.5" class="chord-finger-dot"/>
              ${finger ? `<text x="${cx}" y="${cy + 3.5}" text-anchor="middle" fill="var(--bg-base)" font-size="9" font-weight="900">${finger}</text>` : ''}
              `;
            }
          }
          return '';
        }).join('')}
      </svg>
    `;
  }

  static renderUkulele(chordName, isLeftHanded = false) {
    const chord = this.getUkuleleChord(chordName);
    if (!chord) return `<div class="chord-not-found">Acorde no disponible</div>`;

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
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="chord-diagram-svg ukulele-svg" role="img" aria-label="Diagrama de ukelele ${chordName}">
        <text x="${width / 2}" y="20" text-anchor="middle" fill="var(--accent-secondary, #00e5ff)" font-weight="900" font-size="14">${chordName} (Ukelele)</text>

        ${chord.baseFret > 1 
          ? `<text x="18" y="${startY + 16}" fill="var(--accent-secondary, #00e5ff)" font-size="11" font-weight="bold">${chord.baseFret}fr</text>`
          : `<line x1="${startX}" y1="${startY}" x2="${startX + stringGap * (numStrings - 1)}" y2="${startY}" stroke="var(--text-primary)" stroke-width="4"/>`
        }

        ${Array.from({ length: numFrets + 1 }, (_, f) => `
          <line x1="${startX}" y1="${startY + f * fretGap}" x2="${startX + stringGap * (numStrings - 1)}" y2="${startY + f * fretGap}" stroke="var(--border-strong)" stroke-width="1.5"/>
        `).join('')}

        ${Array.from({ length: numStrings }, (_, s) => `
          <line x1="${startX + s * stringGap}" y1="${startY}" x2="${startX + s * stringGap}" y2="${startY + numFrets * fretGap}" stroke="var(--border-strong)" stroke-width="1.5"/>
        `).join('')}

        ${frets.map((fret, s) => {
          const x = startX + s * stringGap;
          if (fret === -1) return `<text x="${x}" y="${startY - 6}" text-anchor="middle" fill="var(--error-color, #e53935)" font-size="11" font-weight="bold">✕</text>`;
          if (fret === 0) return `<circle cx="${x}" cy="${startY - 10}" r="3.5" fill="none" stroke="var(--success-color, #00e676)" stroke-width="2"/>`;
          return '';
        }).join('')}

        ${frets.map((fret, s) => {
          if (fret > 0) {
            const displayFret = fret - (chord.baseFret > 1 ? chord.baseFret - 1 : 0);
            if (displayFret >= 1 && displayFret <= numFrets) {
              const cx = startX + s * stringGap;
              const cy = startY + (displayFret - 0.5) * fretGap;
              const finger = fingers[s] || '';
              return `
                <circle cx="${cx}" cy="${cy}" r="7" fill="var(--accent-secondary, #00e5ff)"/>
                ${finger ? `<text x="${cx}" y="${cy + 3.5}" text-anchor="middle" fill="#000000" font-size="9" font-weight="900">${finger}</text>` : ''}
              `;
            }
          }
          return '';
        }).join('')}
      </svg>
    `;
  }

  static renderPiano(chordName) {
    const cleanName = this.simplifyChord(chordName);
    const voicing = PIANO_VOICINGS[chordName] || PIANO_VOICINGS[cleanName] || [{ key: 'C', oct: 4 }, { key: 'E', oct: 4 }, { key: 'G', oct: 4 }];

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
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="chord-diagram-svg piano-svg" role="img" aria-label="Diagrama de teclado ${chordName}">
        <text x="${width / 2}" y="15" text-anchor="middle" fill="var(--accent-primary)" font-weight="900" font-size="12">${chordName} (Piano)</text>

        ${whiteKeys.map((k, i) => {
          const x = startX + i * whiteKeyWidth;
          const active = isWhiteActive(k);
          return `
            <rect x="${x}" y="${startY}" width="${whiteKeyWidth}" height="${whiteKeyHeight}" rx="2" fill="${active ? 'var(--accent-primary)' : 'var(--bg-surface-solid)'}" stroke="var(--border-strong)" stroke-width="1.5"/>
            ${active ? `
              <circle cx="${x + whiteKeyWidth / 2}" cy="${startY + whiteKeyHeight - 12}" r="4" fill="var(--bg-surface-solid)"/>
              <text x="${x + whiteKeyWidth / 2}" y="${startY + whiteKeyHeight - 9.5}" text-anchor="middle" fill="var(--text-primary)" font-size="6.5" font-weight="900">${k.note}</text>
            ` : `
              <text x="${x + whiteKeyWidth / 2}" y="${startY + whiteKeyHeight - 4}" text-anchor="middle" fill="var(--text-muted)" font-size="6">${k.note}</text>
            `}
          `;
        }).join('')}

        ${blackKeys.map((k) => {
          const x = startX + (k.pos + 1) * whiteKeyWidth - (blackKeyWidth / 2);
          const active = isBlackActive(k);
          return `
            <rect x="${x}" y="${startY}" width="${blackKeyWidth}" height="${blackKeyHeight}" rx="2" fill="${active ? 'var(--accent-secondary, #00e5ff)' : 'var(--text-primary)'}" stroke="var(--border-strong)" stroke-width="1"/>
            ${active ? `
              <circle cx="${x + blackKeyWidth / 2}" cy="${startY + blackKeyHeight - 10}" r="3.5" fill="var(--bg-surface-solid)"/>
              <text x="${x + blackKeyWidth / 2}" y="${startY + blackKeyHeight - 7.5}" text-anchor="middle" fill="var(--text-primary)" font-size="5.5" font-weight="900">${k.note}</text>
            ` : ''}
          `;
        }).join('')}
      </svg>
    `;
  }
}

export default ChordSvgRenderer;
