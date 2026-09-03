/**
 * @file SongMetadataResolver.js
 * @description Tabla maestra de tempos y dificultades reales para canciones icónicas y generador determinista.
 */

export const KNOWN_SONG_METADATA = {
  'back in black ac/dc': { tempo: 92, difficulty: 'Intermedio' },
  'highway to hell ac/dc': { tempo: 116, difficulty: 'Principiante' },
  'thunderstruck ac/dc': { tempo: 133, difficulty: 'Avanzado' },
  'you shook me all night long ac/dc': { tempo: 127, difficulty: 'Intermedio' },
  't.n.t. ac/dc': { tempo: 126, difficulty: 'Principiante' },
  'hells bells ac/dc': { tempo: 106, difficulty: 'Intermedio' },
  'hotel california eagles': { tempo: 75, difficulty: 'Avanzado' },
  'take it easy eagles': { tempo: 139, difficulty: 'Principiante' },
  'desperado eagles': { tempo: 60, difficulty: 'Intermedio' },
  'sweet child o\' mine guns n\' roses': { tempo: 125, difficulty: 'Avanzado' },
  'november rain guns n\' roses': { tempo: 79, difficulty: 'Avanzado' },
  'paradise city guns n\' roses': { tempo: 100, difficulty: 'Avanzado' },
  'patience guns n\' roses': { tempo: 88, difficulty: 'Principiante' },
  'wonderwall oasis': { tempo: 87, difficulty: 'Principiante' },
  'don\'t look back in anger oasis': { tempo: 84, difficulty: 'Intermedio' },
  'champagne supernova oasis': { tempo: 75, difficulty: 'Intermedio' },
  'stand by me oasis': { tempo: 84, difficulty: 'Principiante' },
  'blackbird the beatles': { tempo: 94, difficulty: 'Intermedio' },
  'let it be the beatles': { tempo: 72, difficulty: 'Principiante' },
  'yesterday the beatles': { tempo: 97, difficulty: 'Principiante' },
  'here comes the sun the beatles': { tempo: 129, difficulty: 'Intermedio' },
  'hey jude the beatles': { tempo: 75, difficulty: 'Principiante' },
  'come together the beatles': { tempo: 82, difficulty: 'Intermedio' },
  'something the beatles': { tempo: 66, difficulty: 'Intermedio' },
  'bohemian rhapsody queen': { tempo: 72, difficulty: 'Avanzado' },
  'we will rock you queen': { tempo: 81, difficulty: 'Principiante' },
  'another one bites the dust queen': { tempo: 110, difficulty: 'Principiante' },
  'radio ga ga queen': { tempo: 112, difficulty: 'Intermedio' },
  'dont stop me now queen': { tempo: 156, difficulty: 'Intermedio' },
  'under pressure queen': { tempo: 114, difficulty: 'Intermedio' },
  'smells like teen spirit nirvana': { tempo: 116, difficulty: 'Intermedio' },
  'come as you are nirvana': { tempo: 120, difficulty: 'Intermedio' },
  'heart-shaped box nirvana': { tempo: 103, difficulty: 'Intermedio' },
  'lithium nirvana': { tempo: 124, difficulty: 'Intermedio' },
  'the man who sold the world nirvana': { tempo: 117, difficulty: 'Principiante' },
  'all apologies nirvana': { tempo: 114, difficulty: 'Principiante' },
  'nothing else matters metallica': { tempo: 142, difficulty: 'Avanzado' },
  'enter sandman metallica': { tempo: 123, difficulty: 'Intermedio' },
  'master of puppets metallica': { tempo: 212, difficulty: 'Experto' },
  'the unforgiven metallica': { tempo: 69, difficulty: 'Intermedio' },
  'fade to black metallica': { tempo: 114, difficulty: 'Avanzado' },
  'one metallica': { tempo: 104, difficulty: 'Experto' },
  'the scientist coldplay': { tempo: 73, difficulty: 'Principiante' },
  'yellow coldplay': { tempo: 88, difficulty: 'Principiante' },
  'fix you coldplay': { tempo: 69, difficulty: 'Principiante' },
  'viva la vida coldplay': { tempo: 138, difficulty: 'Intermedio' },
  'clocks coldplay': { tempo: 131, difficulty: 'Intermedio' },
  'billie jean michael jackson': { tempo: 117, difficulty: 'Intermedio' },
  'beat it michael jackson': { tempo: 138, difficulty: 'Avanzado' },
  'smooth criminal michael jackson': { tempo: 118, difficulty: 'Intermedio' },
  'thriller michael jackson': { tempo: 118, difficulty: 'Intermedio' },
  'shape of you ed sheeran': { tempo: 96, difficulty: 'Principiante' },
  'perfect ed sheeran': { tempo: 63, difficulty: 'Principiante' },
  'photograph ed sheeran': { tempo: 108, difficulty: 'Principiante' },
  'thinking out loud ed sheeran': { tempo: 79, difficulty: 'Principiante' },
  'rolling in the deep adele': { tempo: 105, difficulty: 'Intermedio' },
  'someone like you adele': { tempo: 67, difficulty: 'Principiante' },
  'set fire to the rain adele': { tempo: 108, difficulty: 'Intermedio' },
  'hello adele': { tempo: 79, difficulty: 'Principiante' },
  'creep radiohead': { tempo: 92, difficulty: 'Principiante' },
  'karma police radiohead': { tempo: 75, difficulty: 'Intermedio' },
  'no surprises radiohead': { tempo: 76, difficulty: 'Intermedio' },
  'zombie the cranberries': { tempo: 84, difficulty: 'Intermedio' },
  'linger the cranberries': { tempo: 78, difficulty: 'Principiante' },
  'knockin on heavens door bob dylan': { tempo: 68, difficulty: 'Principiante' },
  'blowin in the wind bob dylan': { tempo: 88, difficulty: 'Principiante' },
  'like a rolling stone bob dylan': { tempo: 96, difficulty: 'Intermedio' },
  'wish you were here pink floyd': { tempo: 60, difficulty: 'Principiante' },
  'comfortably numb pink floyd': { tempo: 64, difficulty: 'Avanzado' },
  'another brick in the wall pink floyd': { tempo: 104, difficulty: 'Intermedio' },
  'time pink floyd': { tempo: 120, difficulty: 'Avanzado' },
  'stairway to heaven led zeppelin': { tempo: 82, difficulty: 'Avanzado' },
  'kashmir led zeppelin': { tempo: 80, difficulty: 'Avanzado' },
  'whole lotta love led zeppelin': { tempo: 89, difficulty: 'Intermedio' },
  'californication red hot chili peppers': { tempo: 96, difficulty: 'Intermedio' },
  'under the bridge red hot chili peppers': { tempo: 84, difficulty: 'Avanzado' },
  'can\'t stop red hot chili peppers': { tempo: 91, difficulty: 'Intermedio' },
  'scar tissue red hot chili peppers': { tempo: 89, difficulty: 'Principiante' },
  'take me to church hozier': { tempo: 129, difficulty: 'Intermedio' },
  'shallow lady gaga': { tempo: 96, difficulty: 'Intermedio' },
  'blinding lights the weeknd': { tempo: 171, difficulty: 'Principiante' },
  'starboy the weeknd': { tempo: 186, difficulty: 'Intermedio' },
  'as it was harry styles': { tempo: 174, difficulty: 'Principiante' },
  'watermelon sugar harry styles': { tempo: 95, difficulty: 'Principiante' },
  'dust in the wind kansas': { tempo: 93, difficulty: 'Avanzado' },
  'tears in heaven eric clapton': { tempo: 76, difficulty: 'Avanzado' },
  'layla eric clapton': { tempo: 115, difficulty: 'Avanzado' },
  'stand by me ben e. king': { tempo: 118, difficulty: 'Principiante' },
  'sweet home alabama lynyrd skynyrd': { tempo: 98, difficulty: 'Intermedio' },
  'de musica ligera soda stereo': { tempo: 126, difficulty: 'Intermedio' },
  'persiana americana soda stereo': { tempo: 130, difficulty: 'Intermedio' },
  'flaca andres calamaro': { tempo: 96, difficulty: 'Principiante' },
  'estadio azteca andres calamaro': { tempo: 85, difficulty: 'Principiante' },
  'rayando el sol mana': { tempo: 74, difficulty: 'Principiante' },
  'clandestino manu chao': { tempo: 92, difficulty: 'Principiante' },
  'la camisa negra juanes': { tempo: 97, difficulty: 'Principiante' },
  'stay rihanna': { tempo: 56, difficulty: 'Principiante' },
  'diamonds rihanna': { tempo: 92, difficulty: 'Principiante' },
  'umbrella rihanna': { tempo: 87, difficulty: 'Principiante' },
  'love on the brain rihanna': { tempo: 57, difficulty: 'Intermedio' },
  'stay with me sam smith': { tempo: 84, difficulty: 'Principiante' },
  'love yourself justin bieber': { tempo: 100, difficulty: 'Principiante' },
  'ghost justin bieber': { tempo: 154, difficulty: 'Principiante' },
  'when i was your man bruno mars': { tempo: 73, difficulty: 'Intermedio' },
  'falling harry styles': { tempo: 54, difficulty: 'Principiante' },
  'sign of the times harry styles': { tempo: 60, difficulty: 'Intermedio' },
  'easy on me adele': { tempo: 70, difficulty: 'Principiante' },
  'all of me john legend': { tempo: 63, difficulty: 'Principiante' },
  '19 dias y 500 noches joaquin sabina': { tempo: 112, difficulty: 'Intermedio' },
  'y nos dieron las diez joaquin sabina': { tempo: 90, difficulty: 'Principiante' },
  'por la boca vive el pez fito & fitipaldis': { tempo: 128, difficulty: 'Intermedio' },
  'la casa por el tejado fito & fitipaldis': { tempo: 130, difficulty: 'Intermedio' },
  'mil horas andres calamaro': { tempo: 116, difficulty: 'Principiante' },
  'lamento boliviano los enanitos verdes': { tempo: 124, difficulty: 'Principiante' },
  'she will be loved maroon 5': { tempo: 102, difficulty: 'Principiante' }
};

export const POPURRI_PRIORITY = [
  'bohemian rhapsody queen',
  'blackbird the beatles',
  'back in black ac/dc',
  'smells like teen spirit nirvana',
  'hotel california eagles',
  'wonderwall oasis',
  'the scientist coldplay',
  'nothing else matters metallica',
  'billie jean michael jackson',
  'shape of you ed sheeran',
  'sweet child o\' mine guns n\' roses',
  'wish you were here pink floyd',
  'zombie the cranberries',
  'rolling in the deep adele',
  'knockin on heavens door bob dylan',
  'creep radiohead',
  'stairway to heaven led zeppelin',
  'californication red hot chili peppers',
  'take me to church hozier',
  'let it be the beatles',
  'highway to hell ac/dc',
  'yellow coldplay',
  'come as you are nirvana',
  'don\'t look back in anger oasis',
  'we will rock you queen',
  'enter sandman metallica',
  'beat it michael jackson',
  'perfect ed sheeran',
  'comfortably numb pink floyd',
  'someone like you adele',
  'shallow lady gaga',
  'blinding lights the weeknd',
  'as it was harry styles',
  'under the bridge red hot chili peppers',
  'here comes the sun the beatles',
  'thunderstruck ac/dc',
  'fix you coldplay',
  'heart-shaped box nirvana',
  'another one bites the dust queen',
  'smooth criminal michael jackson',
  'photograph ed sheeran',
  'set fire to the rain adele',
  'dust in the wind kansas',
  'tears in heaven eric clapton',
  'de musica ligera soda stereo',
  'flaca andres calamaro',
  'rayando el sol mana',
  'la camisa negra juanes'
];

export function resolveSongMetadata(title, artist, genre, hashFn) {
  const normKey = `${(title || '').toLowerCase()} ${(artist || '').toLowerCase()}`.trim();
  const known = KNOWN_SONG_METADATA[normKey];

  let difficulty = known?.difficulty;
  if (!difficulty) {
    const fn = typeof hashFn === 'function' ? hashFn : defaultHash;
    const h = Math.abs(fn((title || '') + (artist || '')));
    const mod = h % 100;
    if (mod < 30) difficulty = 'Principiante';
    else if (mod < 76) difficulty = 'Intermedio';
    else if (mod < 93) difficulty = 'Avanzado';
    else difficulty = 'Experto';
  }

  let tempo = known?.tempo;
  if (!tempo) {
    const fn = typeof hashFn === 'function' ? hashFn : defaultHash;
    const h = Math.abs(fn((title || '') + (artist || '')));
    const g = (genre || '').toLowerCase();
    if (g.includes('acoustic') || g.includes('folk')) tempo = 68 + (h % 34);
    else if (g.includes('metal') || g.includes('punk')) tempo = 126 + (h % 46);
    else if (g.includes('rock')) tempo = 92 + (h % 44);
    else if (g.includes('latin') || g.includes('reggae')) tempo = 86 + (h % 34);
    else if (g.includes('r&b') || g.includes('soul') || g.includes('blues')) tempo = 72 + (h % 38);
    else tempo = 88 + (h % 40);
  }

  return { difficulty, tempo };
}

function defaultHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
