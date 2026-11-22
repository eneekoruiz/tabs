# Tabs & Chords

Offline guitar and bass tablature player, chord visualizer, and microphone chromatic tuner.

## Tech Stack

- **Frontend:** Vanilla JavaScript (ES6+), HTML5, Tailwind CSS
- **Audio Processing:** Web Audio API, Pitchy (McLeod Pitch Method)
- **Notation Engine:** AlphaTab (`@coderline/alphatab`)
- **Testing:** Playwright, `@axe-core/playwright`
- **Desktop Packaging:** Tauri CLI (optional)

## Architecture & Key Decisions

- **Synthesizer & Score Playback:** Leverages AlphaTab with Web Audio API soundfonts for in-browser multi-track tablature and standard notation playback with tempo control and looping.
- **Chromatic Tuner:** Analyzes microphone input using the McLeod Pitch Method algorithm (via Pitchy) inside an audio worklet, providing sub-cent pitch accuracy.
- **Offline-First PWA:** Tab catalog, soundfonts, and application assets cache locally for offline rehearsal.

## Local Setup

### Prerequisites

- Node.js 18+

### Installation & Run

```bash
git clone https://github.com/eneekoruiz/tabs.git
cd tabs
npm install

# Start local dev server (port 3000)
npm run dev

# Run end-to-end and audio verification tests
npm test
```
