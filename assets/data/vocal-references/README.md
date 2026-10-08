# Public vocal note references

563 validated single-voice charts from https://github.com/razzertronic/usdx-songs at commit e278c5851844b88734eaab0dcb34a3218a77e5f1. The repository declares Unlicense; its license is preserved in LICENSE.repository.txt. Each JSON retains the original path, revision and Git blob SHA. Only numerical pitch/time data are converted and bundled; lyric text and media are not copied from this collection.

130 exact normalized title + artist matches were found in the 10,616-entry app catalog. The full set is accessible through Inicio > Filtros y más opciones > Melodías disponibles para cantar. No chart is certified against an original recording. Match the audio edition before using its pitch lane.

Unversioned charts whose pitches exceed the supported vocal display range may be moved as a whole by an integer number of octaves. octaveShiftSemitones records that adaptation. Intervals and times remain intact and scoring accepts any octave. Corrupt/overlapping/zero-duration/unsupported relative or duet charts are rejected, not silently repaired. Import inventory and rejection reasons: reports/public-references/inventory.json.

Conversion: node scripts/import-public-vocal-references.mjs. Supported user imports: UltraStar TXT and JSON with units milliseconds and notes { startTime, duration, midi, text?, isInterlude? }.
