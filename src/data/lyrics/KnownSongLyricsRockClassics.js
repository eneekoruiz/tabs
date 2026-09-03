/**
 * @file KnownSongLyricsRockClassics.js
 * @description Base de datos de letras 100% completas, auténticas y acordes oficiales para 83 grandes clásicos de rock.
 * Incluye Intro, Verso 1, Coro, Verso 2, Puente, Solo con acordes y Outro con acordes oficiales en formato ChordPro exacto.
 */

import { getBeatlesLyrics } from './rock/beatles.js';
import { getQueenLyrics } from './rock/queen.js';
import { getPinkFloydLedZepLyrics } from './rock/pinkFloydLedZep.js';
import { getNirvanaMetallicaLyrics } from './rock/nirvanaMetallica.js';
import { getRhcpGreenDayLyrics } from './rock/rhcpGreenDay.js';
import { getBlinkLinkinLyrics } from './rock/blinkLinkin.js';
import { getArcticAcdcLyrics } from './rock/arcticACDC.js';
import { getOasisRadioheadFooLyrics } from './rock/oasisRadioheadFoo.js';
import { getStonesBowieKillersStrokesLyrics } from './rock/stonesBowieKillersStrokes.js';

export function getRockClassicsSongLyrics(title, artist) {
  const t = (title || '').toLowerCase().trim();
  const a = (artist || '').toLowerCase().trim();

  // 1-10: The Beatles
  const beatlesMatch = getBeatlesLyrics(t, a);
  if (beatlesMatch) return beatlesMatch;

  // 11-17: Queen
  const queenMatch = getQueenLyrics(t, a);
  if (queenMatch) return queenMatch;

  // 18-27: Pink Floyd & Led Zeppelin
  const pinkFloydLedZepMatch = getPinkFloydLedZepLyrics(t, a);
  if (pinkFloydLedZepMatch) return pinkFloydLedZepMatch;

  // 28-39: Nirvana & Metallica
  const nirvanaMetallicaMatch = getNirvanaMetallicaLyrics(t, a);
  if (nirvanaMetallicaMatch) return nirvanaMetallicaMatch;

  // 40-49: Red Hot Chili Peppers & Green Day
  const rhcpGreenDayMatch = getRhcpGreenDayLyrics(t, a);
  if (rhcpGreenDayMatch) return rhcpGreenDayMatch;

  // 50-59: Blink-182 & Linkin Park
  const blinkLinkinMatch = getBlinkLinkinLyrics(t, a);
  if (blinkLinkinMatch) return blinkLinkinMatch;

  // 60-68: Arctic Monkeys & AC/DC
  const arcticAcdcMatch = getArcticAcdcLyrics(t, a);
  if (arcticAcdcMatch) return arcticAcdcMatch;

  // 69-76: Oasis, Radiohead & Foo Fighters
  const oasisRadioheadFooMatch = getOasisRadioheadFooLyrics(t, a);
  if (oasisRadioheadFooMatch) return oasisRadioheadFooMatch;

  // 77-83: The Rolling Stones, David Bowie, The Killers & The Strokes
  const stonesBowieKillersStrokesMatch = getStonesBowieKillersStrokesLyrics(t, a);
  if (stonesBowieKillersStrokesMatch) return stonesBowieKillersStrokesMatch;

  return null;
}

export default getRockClassicsSongLyrics;
