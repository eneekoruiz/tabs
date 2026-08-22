/**
 * @file CircleOfFifthsTool.js
 * @description Círculo de Quintas SVG Interactivo con análisis de grados armónicos y tonalidades relativas.
 */

export class CircleOfFifthsTool {
  constructor() {
    this.key = 'C';
  }

  getHarmonizedChords(key) {
    const harmonyMap = {
      'C':  { I: 'C',  ii: 'Dm',  iii: 'Em',  IV: 'F',   V: 'G7',  vi: 'Am',  dim: 'Bdim',  rel: 'Am',  v_of_v: 'D7'  },
      'G':  { I: 'G',  ii: 'Am',  iii: 'Bm',  IV: 'C',   V: 'D7',  vi: 'Em',  dim: 'F#dim', rel: 'Em',  v_of_v: 'A7'  },
      'D':  { I: 'D',  ii: 'Em',  iii: 'F#m', IV: 'G',   V: 'A7',  vi: 'Bm',  dim: 'C#dim', rel: 'Bm',  v_of_v: 'E7'  },
      'A':  { I: 'A',  ii: 'Bm',  iii: 'C#m', IV: 'D',   V: 'E7',  vi: 'F#m', dim: 'G#dim', rel: 'F#m', v_of_v: 'B7'  },
      'E':  { I: 'E',  ii: 'F#m', iii: 'G#m', IV: 'A',   V: 'B7',  vi: 'C#m', dim: 'D#dim', rel: 'C#m', v_of_v: 'F#7' },
      'B':  { I: 'B',  ii: 'C#m', iii: 'D#m', IV: 'E',   V: 'F#7', vi: 'G#m', dim: 'A#dim', rel: 'G#m', v_of_v: 'C#7' },
      'F':  { I: 'F',  ii: 'Gm',  iii: 'Am',  IV: 'Bb',  V: 'C7',  vi: 'Dm',  dim: 'Edim',  rel: 'Dm',  v_of_v: 'G7'  },
      'Bb': { I: 'Bb', ii: 'Cm',  iii: 'Dm',  IV: 'Eb',  V: 'F7',  vi: 'Gm',  dim: 'Adim',  rel: 'Gm',  v_of_v: 'C7'  },
      'Eb': { I: 'Eb', ii: 'Fm',  iii: 'Gm',  IV: 'Ab',  V: 'Bb7', vi: 'Cm',  dim: 'Ddim',  rel: 'Cm',  v_of_v: 'F7'  },
      'Ab': { I: 'Ab', ii: 'Bbm', iii: 'Cm',  IV: 'Db',  V: 'Eb7', vi: 'Fm',  dim: 'Gdim',  rel: 'Fm',  v_of_v: 'Bb7' },
      'Db': { I: 'Db', ii: 'Ebm', iii: 'Fm',  IV: 'Gb',  V: 'Ab7', vi: 'Bbm', dim: 'Cdim',  rel: 'Bbm', v_of_v: 'Eb7' },
      'F#': { I: 'F#', ii: 'G#m', iii: 'A#m', IV: 'B',   V: 'C#7', vi: 'D#m', dim: 'E#dim', rel: 'D#m', v_of_v: 'G#7' },
    };
    return harmonyMap[key] || harmonyMap['C'];
  }

  renderCircleSVG(selectedKey) {
    const keysOrder = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
    const minorKeys = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm'];

    const cx = 160, cy = 160;
    const outerR = 130, innerR = 85, minorR = 58;

    const segments = keysOrder.map((key, i) => {
      const angle = (i * 30 - 90) * (Math.PI / 180);
      const nextAngle = ((i + 1) * 30 - 90) * (Math.PI / 180);
      const isActive = key === selectedKey;

      const textAngle = (i * 30 - 90 + 15) * (Math.PI / 180);
      const textR = (outerR + innerR) / 2;
      const tx = cx + textR * Math.cos(textAngle);
      const ty = cy + textR * Math.sin(textAngle);

      const minorTextR = (innerR + minorR) / 2;
      const mtx = cx + minorTextR * Math.cos(textAngle);
      const mty = cy + minorTextR * Math.sin(textAngle);

      const x1 = cx + outerR * Math.cos(angle);
      const y1 = cy + outerR * Math.sin(angle);
      const x2 = cx + outerR * Math.cos(nextAngle);
      const y2 = cy + outerR * Math.sin(nextAngle);
      const x3 = cx + innerR * Math.cos(nextAngle);
      const y3 = cy + innerR * Math.sin(nextAngle);
      const x4 = cx + innerR * Math.cos(angle);
      const y4 = cy + innerR * Math.sin(angle);

      const mx1 = cx + innerR * Math.cos(angle);
      const my1 = cy + innerR * Math.sin(angle);
      const mx2 = cx + innerR * Math.cos(nextAngle);
      const my2 = cy + innerR * Math.sin(nextAngle);
      const mx3 = cx + minorR * Math.cos(nextAngle);
      const my3 = cy + minorR * Math.sin(nextAngle);
      const mx4 = cx + minorR * Math.cos(angle);
      const my4 = cy + minorR * Math.sin(angle);

      const majorFill = isActive ? '#ff5722' : 'rgba(255,87,34,0.08)';
      const majorStroke = isActive ? '#ff5722' : 'rgba(255,255,255,0.15)';
      const minorFill = 'rgba(0,229,255,0.08)';
      const minorStroke = 'rgba(0,229,255,0.15)';

      return `
        <path d="M ${x1} ${y1} A ${outerR} ${outerR} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 0 0 ${x4} ${y4} Z"
          fill="${majorFill}" stroke="${majorStroke}" stroke-width="1.5"
          class="circle-key-sector${isActive ? ' active' : ''}" data-key="${key}"
          style="cursor:pointer; transition: fill 0.2s;"/>
        <text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="middle"
          fill="${isActive ? '#ffffff' : 'var(--text-primary)'}" font-size="${isActive ? '13' : '12'}" font-weight="${isActive ? '900' : '700'}"
          class="circle-key-label" data-key="${key}" style="cursor:pointer; pointer-events:none;">
          ${key}
        </text>

        <path d="M ${mx1} ${my1} A ${innerR} ${innerR} 0 0 1 ${mx2} ${my2} L ${mx3} ${my3} A ${minorR} ${minorR} 0 0 0 ${mx4} ${my4} Z"
          fill="${minorFill}" stroke="${minorStroke}" stroke-width="1"
          class="circle-minor-sector" data-key="${key}" style="cursor:pointer;"/>
        <text x="${mtx}" y="${mty}" text-anchor="middle" dominant-baseline="middle"
          fill="rgba(0,229,255,0.85)" font-size="9" font-weight="600"
          style="pointer-events:none;">
          ${minorKeys[i]}
        </text>
      `;
    });

    return `
      <svg width="320" height="320" viewBox="0 0 320 320" class="circle-of-fifths-svg" role="img" aria-label="Círculo de quintas">
        <circle cx="${cx}" cy="${cy}" r="${minorR}" fill="rgba(18,18,24,0.95)" stroke="rgba(255,255,255,0.1)"/>
        <text x="${cx}" y="${cy - 8}" text-anchor="middle" fill="#ff5722" font-size="16" font-weight="bold">${selectedKey} M</text>
        <text x="${cx}" y="${cy + 12}" text-anchor="middle" fill="rgba(0,229,255,0.9)" font-size="11">Rel: ${minorKeys[keysOrder.indexOf(selectedKey)]}</text>
        <g>${segments.join('')}</g>
      </svg>
    `;
  }

  updateUI(container) {
    const svgBox = container?.querySelector('#circleSvgViewport');
    const chords = this.getHarmonizedChords(this.key);
    const keyTitle = container?.querySelector('#circleSelectedKeyTitle');
    const degreesBox = container?.querySelector('#circleHarmonizedDegrees');

    if (svgBox) svgBox.innerHTML = this.renderCircleSVG(this.key);
    if (keyTitle) keyTitle.textContent = `Tonalidad: ${this.key} Mayor / ${chords.rel} Menor`;

    if (degreesBox) {
      degreesBox.innerHTML = `
        <div class="degree-card tonic">
          <span class="degree-badge">I (Tónica)</span>
          <strong>${chords.I}</strong>
        </div>
        <div class="degree-card subdominant">
          <span class="degree-badge">IV (Subdominante)</span>
          <strong>${chords.IV}</strong>
        </div>
        <div class="degree-card dominant">
          <span class="degree-badge">V7 (Dominante)</span>
          <strong>${chords.V}</strong>
        </div>
        <div class="degree-card relative">
          <span class="degree-badge">vi (Relativa menor)</span>
          <strong>${chords.vi}</strong>
        </div>
        <div class="degree-card secondary">
          <span class="degree-badge">ii (Super-tónica)</span>
          <strong>${chords.ii}</strong>
        </div>
        <div class="degree-card secondary">
          <span class="degree-badge">iii (Mediante)</span>
          <strong>${chords.iii}</strong>
        </div>
      `;
    }
  }

  renderModal() {
    const chords = this.getHarmonizedChords(this.key);
    return `
      <div class="tool-modal-overlay active" id="modal-circle">
        <div class="tool-modal-dialog">
          <div class="tool-modal-header">
            <div class="tool-modal-title">
              <span class="tool-modal-icon">⭕</span>
              <div>
                <span class="tool-badge-studio">ARMONÍA & COMPOSICIÓN</span>
                <h2>Círculo de Quintas Interactivo</h2>
              </div>
            </div>
            <button class="btn-close-tool-modal btn-close-modal" id="btnCloseToolModal">✕</button>
          </div>

          <div class="tool-panoramic-layout">
            <div class="tool-panoramic-main">
              <div class="circle-svg-wrapper" id="circleSvgViewport">
                ${this.renderCircleSVG(this.key)}
              </div>
              <p class="circle-hint">Haz clic en cualquier tonalidad del círculo para ver su familia armónica</p>
            </div>

            <div class="tool-panoramic-side">
              <div class="circle-harmony-panel">
                <h3 class="circle-panel-title" id="circleSelectedKeyTitle">Tonalidad: ${this.key} Mayor / ${chords.rel} Menor</h3>
                <label class="metro-param-label">Familia de Acordes Armonizados</label>
                <div class="degrees-grid" id="circleHarmonizedDegrees">
                  <div class="degree-card tonic">
                    <span class="degree-badge">I (Tónica)</span>
                    <strong>${chords.I}</strong>
                  </div>
                  <div class="degree-card subdominant">
                    <span class="degree-badge">IV (Subdominante)</span>
                    <strong>${chords.IV}</strong>
                  </div>
                  <div class="degree-card dominant">
                    <span class="degree-badge">V7 (Dominante)</span>
                    <strong>${chords.V}</strong>
                  </div>
                  <div class="degree-card relative">
                    <span class="degree-badge">vi (Relativa menor)</span>
                    <strong>${chords.vi}</strong>
                  </div>
                  <div class="degree-card secondary">
                    <span class="degree-badge">ii (Super-tónica)</span>
                    <strong>${chords.ii}</strong>
                  </div>
                  <div class="degree-card secondary">
                    <span class="degree-badge">iii (Mediante)</span>
                    <strong>${chords.iii}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

export default CircleOfFifthsTool;
