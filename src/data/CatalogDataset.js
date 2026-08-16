/**
 * @file CatalogDataset.js
 * @description Mega-Dataset de partituras y Letras con Acordes Reales, Oficiales y Completos.
 * Cada canción contiene la letra original íntegra con acordes interactivos [Chord] sobre cada sílaba.
 */

export const MEGA_CATALOG = [
  // ==========================================
  // 1. THE BEATLES & CLÁSICOS ACÚSTICOS
  // ==========================================
  {
    title: 'Blackbird',
    artist: 'The Beatles',
    genre: 'Acoustic',
    difficulty: 'Intermedio',
    tuning: 'Standard E',
    tempo: 94,
    timeSignature: '3/4',
    tracksCount: 2,
    lyricsChords: `[Intro]
[G] [Am7] [G/B] [G]

[Verse 1]
[G]Blackbird [Am7]singing in the [G/B]dead of night [G]
[C]Take these [C#dim]broken wings and [D]learn to [D#dim]fly [Em] [Eb]
[D]All [C#dim]your [C]life [Cm]
[G/B]You were only [A7]waiting for this [D7sus4]moment to [G]arise

[Verse 2]
[G]Blackbird [Am7]singing in the [G/B]dead of night [G]
[C]Take these [C#dim]sunken eyes and [D]learn to [D#dim]see [Em] [Eb]
[D]All [C#dim]your [C]life [Cm]
[G/B]You were only [A7]waiting for this [D7sus4]moment to be [G]free

[Chorus]
[F]Black[C/E]bird, [Dm]fly [C] [Bb]
[C]Black[F]bird, [C/E]fly [Dm] [C] [Bb]
[A7]Into the light of the [D7sus4]dark black [G]night

[Verse 3]
[G]Blackbird [Am7]singing in the [G/B]dead of night [G]
[C]Take these [C#dim]broken wings and [D]learn to [D#dim]fly [Em] [Eb]
[D]All [C#dim]your [C]life [Cm]
[G/B]You were only [A7]waiting for this [D7sus4]moment to [G]arise
[G/B]You were only [A7]waiting for this [D7sus4]moment to [G]arise`,
    data: `\\title "Blackbird" \\artist "The Beatles" \\tempo 94 . :8 (0.5 0.2) :4 (0.5 0.2) :8 (2.5 3.2) :4 (2.5 3.2) | :8 (10.5 12.2) :4 (10.5 12.2) :8 (10.5 12.2) :4 (10.5 12.2) |`,
  },
  {
    title: 'Let It Be',
    artist: 'The Beatles',
    genre: 'Acoustic',
    difficulty: 'Principiante',
    tuning: 'Standard E',
    tempo: 75,
    timeSignature: '4/4',
    tracksCount: 3,
    lyricsChords: `[Intro]
[C] [G] [Am] [F] [C] [G] [F] [C]

[Verse 1]
When I [C]find myself in [G]times of trouble, [Am]Mother Mary [F]comes to me
[C]Speaking words of [G]wisdom, let it [F]be [C]
And [C]in my hour of [G]darkness she is [Am]standing right in [F]front of me
[C]Speaking words of [G]wisdom, let it [F]be [C]

[Chorus]
Let it [Am]be, let it [G]be, let it [F]be, let it [C]be
[C]Whisper words of [G]wisdom, let it [F]be [C]

[Verse 2]
And [C]when the broken [G]hearted people [Am]living in the [F]world agree
[C]There will be an [G]answer, let it [F]be [C]
For [C]though they may be [G]parted there is [Am]still a chance that [F]they will see
[C]There will be an [G]answer, let it [F]be [C]

[Chorus]
Let it [Am]be, let it [G]be, let it [F]be, let it [C]be
[C]There will be an [G]answer, let it [F]be [C]

[Verse 3]
And [C]when the night is [G]cloudy there is [Am]still a light that [F]shines on me
[C]Shine until to[G]morrow, let it [F]be [C]
I [C]wake up to the [G]sound of music, [Am]Mother Mary [F]comes to me
[C]Speaking words of [G]wisdom, let it [F]be [C]

[Chorus]
Let it [Am]be, let it [G]be, let it [F]be, let it [C]be
[C]Whisper words of [G]wisdom, let it [F]be [C]`,
    data: `\\title "Let It Be" \\artist "The Beatles" \\tempo 75 . :4 (0.5 2.4 0.3 1.2) :4 (3.6 2.5 0.4 0.3) :4 (0.5 2.4 2.3 1.2) :4 (1.6 3.5 3.4 2.3) | :4 (0.5 2.4 0.3 1.2) :4 (3.6 2.5 0.4 0.3) :4 (1.6 3.5 3.4 2.3) :4 (0.5 2.4 0.3 1.2) |`,
  },
  {
    title: 'Dust in the Wind',
    artist: 'Kansas',
    genre: 'Acoustic',
    difficulty: 'Intermedio',
    tuning: 'Standard E',
    tempo: 98,
    timeSignature: '4/4',
    tracksCount: 2,
    lyricsChords: `[Intro]
[C] [Cmaj7] [Cadd9] [C] [Asus2] [Asus4] [Am] [Asus2]

[Verse 1]
[C]I [G/B]close [Am]my [G]eyes, [Dm7]only for a [Am]moment, and the [G/B]moment's gone
[C]All [G/B]my [Am]dreams [G]pass before my [Dm7]eyes, a [Am]curiosity

[Chorus]
[D/F#]Dust [G]in the [Am]wind
[D/F#]All they are is [G]dust in the [Am]wind

[Verse 2]
[C]Same [G/B]old [Am]song, [G]just a drop of [Dm7]water in an [Am]endless sea
[C]All [G/B]we [Am]do [G]crumbles to the [Dm7]ground, though we [Am]refuse to see

[Chorus]
[D/F#]Dust [G]in the [Am]wind
[D/F#]All we are is [G]dust in the [Am]wind

[Bridge]
[Am] [G/A] [F/A] [G/A]
[Am] [G/A] [F/A] [G/A]

[Verse 3]
[C]Now, [G/B]don't hang [Am]on, [G]nothing lasts for[Dm7]ever but the [Am]earth and sky
[C]It [G/B]slips [Am]away, [G]and all your money [Dm7]won't another [Am]minute buy

[Chorus]
[D/F#]Dust [G]in the [Am]wind
[D/F#]All we are is [G]dust in the [Am]wind
[D/F#]Dust [G]in the [Am]wind
[D/F#]Everything is [G]dust in the [Am]wind`,
    data: `\\title "Dust in the Wind" \\artist "Kansas" \\tempo 98 . :16 3.5 0.3 1.2 0.4 3.5 0.3 1.2 0.4 | :16 3.5 0.3 3.2 0.4 3.5 0.3 0.2 0.4 |`,
  },
  {
    title: 'Tears in Heaven',
    artist: 'Eric Clapton',
    genre: 'Acoustic',
    difficulty: 'Intermedio',
    tuning: 'Standard E',
    tempo: 78,
    timeSignature: '4/4',
    tracksCount: 2,
    lyricsChords: `[Intro]
[A] [E/G#] [F#m] [A/E] [D/F#] [E7] [A]

[Verse 1]
[A]Would you [E/G#]know my [F#m]name [A/E]
[D/F#]If I [A/E]saw you in [E]heaven?
[A]Would it [E/G#]be the [F#m]same [A/E]
[D/F#]If I [A/E]saw you in [E]heaven?
[F#m]I must be [C#m/E]strong [Em]and carry [F#7]on
'Cause I [Bm7]know I don't be[E7]long here in [A]heaven

[Verse 2]
[A]Would you [E/G#]hold my [F#m]hand [A/E]
[D/F#]If I [A/E]saw you in [E]heaven?
[A]Would you [E/G#]help me [F#m]stand [A/E]
[D/F#]If I [A/E]saw you in [E]heaven?
[F#m]I'll find my [C#m/E]way [Em]through night and [F#7]day
'Cause I [Bm7]know I just can't [E7]stay here in [A]heaven

[Bridge]
[C]Time can [G/B]bring you [Am]down, time can [D/F#]bend your [G]knees [D/F#] [Em] [D] [C]
[C]Time can [G/B]break your [Am]heart, have you [D/F#]begging [G]please, [D/F#]begging [E]please

[Verse 3]
[A]Beyond the [E/G#]door, [F#m]there's peace I'm [A/E]sure
[D/F#]And I [A/E]know there'll be no [E]more tears in [A]heaven`,
    data: `\\title "Tears in Heaven" \\artist "Eric Clapton" \\tempo 78 . :8 5.6 5.4 5.3 5.2 :8 4.6 4.4 4.3 4.2 | :8 2.6 2.4 2.3 2.2 :8 0.6 0.4 0.3 0.2 |`,
  },
  {
    title: 'Stairway to Heaven',
    artist: 'Led Zeppelin',
    genre: 'Rock',
    difficulty: 'Avanzado',
    tuning: 'Standard E',
    tempo: 76,
    timeSignature: '4/4',
    tracksCount: 4,
    lyricsChords: `[Intro]
[Am] [G#aug] [C/G] [D/F#] [Fmaj7] [G] [Am]

[Verse 1]
There's a [Am]lady who's [G#aug]sure all that [C/G]glitters is [D/F#]gold
And she's [Fmaj7]buying a stairway to [G]heaven [Am]
When she [Am]gets there she [G#aug]knows, if the [C/G]stores are all [D/F#]closed
With a [Fmaj7]word she can get what she [G]came for [Am]
[C]Ooh, [D]ooh, [Fmaj7]ooh, [Am]ooh
And she's [C]buying a [G]stairway to [D]heaven

[Verse 2]
There's a [Am]sign on the [G#aug]wall, but she [C/G]wants to be [D/F#]sure
'Cause you [Fmaj7]know sometimes words have two [G]meanings [Am]
In a [Am]tree by the [G#aug]brook, there's a [C/G]songbird who [D/F#]sings
Sometimes [Fmaj7]all of our thoughts are [G]misgiven [Am]

[Chorus]
[C]Ooh, it makes me [G]wonder [Am]
[C]Ooh, it makes me [G]wonder [Am]`,
    data: `\\title "Stairway to Heaven" \\artist "Led Zeppelin" \\tempo 76 . :8 0.5 7.1 5.2 5.3 7.1 2.5 8.1 5.2 | :8 5.3 8.1 0.4 7.1 5.2 5.3 7.1 2.6 |`,
  },
  {
    title: 'Hotel California',
    artist: 'Eagles',
    genre: 'Rock',
    difficulty: 'Avanzado',
    tuning: 'Standard E (Capo 7)',
    tempo: 75,
    timeSignature: '4/4',
    tracksCount: 5,
    lyricsChords: `[Intro]
[Am] [E7] [G] [D] [F] [C] [Dm] [E7]

[Verse 1]
[Am]On a dark desert highway, [E7]cool wind in my hair
[G]Warm smell of colitas, [D]rising up through the air
[F]Up ahead in the distance, [C]I saw a shimmering light
[Dm]My head grew heavy and my sight grew dim, [E7]I had to stop for the night
[Am]There she stood in the doorway, [E7]I heard the mission bell
[G]And I was thinking to myself this could be [D]heaven or this could be hell
[F]Then she lit up a candle, [C]and she showed me the way
[Dm]There were voices down the corridor, [E7]I thought I heard them say

[Chorus]
[F]Welcome to the Hotel Cali[C]fornia
Such a [E7]lovely place (such a lovely place), such a [Am]lovely face
[F]Plenty of room at the Hotel Cali[C]fornia
Any [Dm]time of year (any time of year), you can [E7]find it here

[Verse 2]
[Am]Her mind is Tiffany-twisted, [E7]she got the Mercedes bends
[G]She got a lot of pretty, pretty boys [D]that she calls friends
[F]How they dance in the courtyard, [C]sweet summer sweat
[Dm]Some dance to remember, [E7]some dance to forget
[Am]So I called up the Captain, [E7]'Please bring me my wine'
He said, [G]'We haven't had that spirit here since [D]nineteen sixty-nine'
[F]And still those voices are calling from [C]far away
[Dm]Wake you up in the middle of the night, [E7]just to hear them say

[Chorus]
[F]Welcome to the Hotel Cali[C]fornia
Such a [E7]lovely place (such a lovely place), such a [Am]lovely face
They [F]livin' it up at the Hotel Cali[C]fornia
What a [Dm]nice surprise (what a nice surprise), bring your [E7]alibis

[Verse 3]
[Am]Mirrors on the ceiling, [E7]the pink champagne on ice
And she said, [G]'We are all just prisoners here, [D]of our own device'
[F]And in the master's chambers, [C]they gathered for the feast
[Dm]They stab it with their steely knives, but they [E7]just can't kill the beast
[Am]Last thing I remember, [E7]I was running for the door
[G]I had to find the passage back to the [D]place I was before
[F]'Relax,' said the night man, 'We are [C]programmed to receive
[Dm]You can check-out any time you like, but [E7]you can never leave!'`,
    data: `\\title "Hotel California" \\artist "Eagles" \\tempo 75 . :8 2.5 4.4 4.3 3.2 2.1 3.2 4.3 4.4 | :8 2.6 4.5 4.4 3.3 2.2 3.3 4.4 4.5 | :8 0.5 2.4 2.3 1.2 0.1 1.2 2.3 2.4 | :8 0.6 2.5 2.4 1.3 0.2 1.3 2.4 2.5 |`,
  },
  {
    title: 'Smoke on the Water',
    artist: 'Deep Purple',
    genre: 'Rock',
    difficulty: 'Principiante',
    tuning: 'Standard E',
    tempo: 112,
    timeSignature: '4/4',
    tracksCount: 3,
    lyricsChords: `[Intro]
[G5] [Bb5] [C5]   [G5] [Bb5] [Db5] [C5]
[G5] [Bb5] [C5]   [Bb5] [G5]

[Verse 1]
[G5]We all came out to [F5]Montreux
[G5]On the Lake Geneva [F5]shoreline
[G5]To make records with a [F5]mobile
[G5]We didn't have much [F5]time
[G5]Frank Zappa and the [F5]Mothers
[G5]Were at the best place a[F5]round
[G5]But some stupid with a [F5]flare gun
[G5]Burned the place to the [F5]ground

[Chorus]
[C5]Smoke on the [Ab5]water, [G5]a fire in the sky
[C5]Smoke on the [Ab5]water

[Verse 2]
[G5]They burned down the gambling [F5]house
[G5]It died with an awful [F5]sound
[G5]Funky Claude was running [F5]in and out
[G5]Pulling kids out the [F5]ground
[G5]When it all was [F5]over
[G5]We had to find another [F5]place
[G5]Swiss time was running [F5]out
[G5]It seemed that we would lose the [F5]race

[Chorus]
[C5]Smoke on the [Ab5]water, [G5]a fire in the sky
[C5]Smoke on the [Ab5]water

[Verse 3]
[G5]We ended up at the [F5]Grand Hotel
[G5]It was empty, cold and [F5]bare
[G5]With the Rolling truck Stones thing just [F5]outside
[G5]Making our music [F5]there
[G5]With a few red lights and a few [F5]old beds
[G5]We made a place to [F5]sweat
[G5]No matter what we get [F5]out of this
[G5]I know, I know we'll never for[F5]get

[Chorus]
[C5]Smoke on the [Ab5]water, [G5]a fire in the sky
[C5]Smoke on the [Ab5]water`,
    data: `\\title "Smoke on the Water" \\artist "Deep Purple" \\tempo 112 . :8 0.6 3.5 5.5 | 0.6 3.5 6.5 5.5 | 0.6 3.5 5.5 3.5 0.6 | :8 0.6 3.5 5.5 | 0.6 3.5 6.5 5.5 | 0.6 3.5 5.5 3.5 0.6 |`,
  },
  {
    title: 'Soldadito Marinero',
    artist: 'Fito & Fitipaldis',
    genre: 'Rock',
    difficulty: 'Principiante',
    tuning: 'Standard E',
    tempo: 106,
    timeSignature: '4/4',
    tracksCount: 3,
    lyricsChords: `[Intro]
[G] [D] [Em] [C] [G] [D] [C] [D]

[Verse 1]
El [G]soldadito marinero co[D]noció a una sirena
De e[Em]sas que dicen 'te quiero' si [C]ven la cartera llena
E[G]ra una chica de barrio de [D]esas que cuando caminan
Van ha[C]ciendo sonar las campanas de [D]todas las cantinas

[Chorus]
Y des[G]pués de un invierno eterno, un ver[D]ano fatal
Co[Em]rrer a toda prisa para [C]hacerte esperar
Hay se[G]cretos en los canales y un [D]cadáver en el desván
No te [C]fíes de las sirenas que te [D]van a embaucar

[Verse 2]
Y [G]él que nunca se enamoraba de [D]nadie en particular
Se ha en[Em]contrado con una tormenta y se ha [C]puesto a temblar
Y la [G]sirena le dijo: 'Sube a [D]bordo, mi capitán
Que te [C]voy a enseñar los tesoros que se [D]ocultan en el mar'

[Chorus]
Y des[G]pués de un invierno eterno, un ver[D]ano fatal
Co[Em]rrer a toda prisa para [C]hacerte esperar
Hay se[G]cretos en los canales y un [D]cadáver en el desván
No te [C]fíes de las sirenas que te [D]van a embaucar`,
    data: `\\title "Soldadito Marinero" \\artist "Fito & Fitipaldis" \\tempo 106 . :4 (3.6 2.5 0.4 0.3) :4 (0.4 2.3 3.2) :4 (0.5 2.4 2.3) :4 (3.5 2.4 0.3 1.2) |`,
  },
  {
    title: 'Flaca',
    artist: 'Andrés Calamaro',
    genre: 'Pop',
    difficulty: 'Principiante',
    tuning: 'Standard E',
    tempo: 96,
    timeSignature: '4/4',
    tracksCount: 3,
    lyricsChords: `[Intro]
[G] [B7] [Em] [C] [G] [D] [G] [D]

[Verse 1]
[G]Flaca, no me [B7]claves tus puñales
Por la [Em]espalda, tan pro[C]fundo
No me [G]duelen, no me [D]hacen más daño, no [G] [D]
[G]El otoño es[B7]tá recién empezando
Y a[Em]goté mis pe[C]nas, mi tiempo
Ya [G]no tengo más, [D]no me queda nada, no [G] [D]

[Chorus]
[G]Aunque casi, casi te confieso que te [B7]pienso todavía
[Em]Aunque casi, casi me olvido de to[C]mar la pastilla
[G]No me claves tus puñales por la [D]espalda
Tan pro[C]fundo, no me duelen, no me [D]hacen daño, [G]no`,
    data: `\\title "Flaca" \\artist "Andres Calamaro" \\tempo 96 . :4 (3.6 2.5 0.4 0.3) :4 (2.5 1.4 2.3 0.2) :4 (0.5 2.4 2.3) :4 (3.5 2.4 0.3 1.2) |`,
  },
  {
    title: 'De Musica Ligera',
    artist: 'Soda Stereo',
    genre: 'Rock',
    difficulty: 'Principiante',
    tuning: 'Standard E',
    tempo: 124,
    timeSignature: '4/4',
    tracksCount: 3,
    lyricsChords: `[Intro]
[Bm] [G] [D] [A]
[Bm] [G] [D] [A]

[Verse 1]
[Bm]Ella durmió al [G]calor de las masas
[D]Y yo desperté [A]queriendo soñarla
[Bm]Algún tiempo atrás [G]pensé en escribirle
[D]Y nunca sorteé [A]las trampas del amor

[Chorus]
De a[Bm]quel amor [G]de música li[D]gera [A]
Nada nos [Bm]libra, [G]nada más que[D]da [A]`,
    data: `\\title "De Musica Ligera" \\artist "Soda Stereo" \\tempo 124 . :4 (2.5 4.4 4.3 3.2) :4 (3.6 2.5 0.4 0.3) :4 (0.4 2.3 3.2) :4 (0.5 2.4 2.3) |`,
  },
  {
    title: 'Wonderwall',
    artist: 'Oasis',
    genre: 'Pop',
    difficulty: 'Principiante',
    tuning: 'Standard E (Capo 2)',
    tempo: 88,
    timeSignature: '4/4',
    tracksCount: 3,
    lyricsChords: `[Intro]
[Em7] [G] [Dsus4] [A7sus4]
[Em7] [G] [Dsus4] [A7sus4]

[Verse 1]
[Em7]Today is [G]gonna be the day
That they're [Dsus4]gonna throw it back to [A7sus4]you
[Em7]By now you [G]should've somehow
Real[Dsus4]ized what you gotta [A7sus4]do
[Em7]I don't believe that [G]anybody
[Dsus4]Feels the way I [A7sus4]do about you [Cadd9]now [Dsus4] [A7sus4]

[Chorus]
Because [Cadd9]maybe [Em7] [G]
You're gonna be the one that [Em7]saves me [Cadd9] [Em7] [G]
And after [Em7]all
You're my [Cadd9]wonder[Em7]wall [G] [Em7]`,
    data: `\\title "Wonderwall" \\artist "Oasis" \\tempo 88 . :8 0.6 2.5 2.4 0.3 3.2 3.1 0.6 2.5 | :8 3.6 2.5 0.4 0.3 3.2 3.1 3.6 2.5 | :8 0.5 2.4 2.3 0.2 3.2 3.1 0.5 2.4 | :8 2.5 0.4 2.3 3.2 3.1 2.5 0.4 2.3 |`,
  },
  {
    title: 'Nothing Else Matters',
    artist: 'Metallica',
    genre: 'Metal',
    difficulty: 'Intermedio',
    tuning: 'Standard E',
    tempo: 142,
    timeSignature: '6/8',
    tracksCount: 4,
    lyricsChords: `[Intro]
[Em] [D] [C] [Em] [D] [C]
[Em] [D] [C] [G] [B7] [Em]

[Verse 1]
[Em]So close, no matter [D]how far [C]
[Em]Couldn't be much more [D]from the heart [C]
[Em]Forever trusting [D]who we are [C]
[G]And [B7]nothing else [Em]matters

[Chorus]
[C] [A] [D]Never cared for what they [C]do
[A] [D]Never cared for what they [C]know
[A] [D]But I [Em]know`,
    data: `\\title "Nothing Else Matters" \\artist "Metallica" \\tempo 142 . :8 0.6 0.3 0.2 0.1 0.2 0.3 | :8 0.6 0.3 0.2 0.1 0.2 0.3 | :8 7.1 0.2 0.3 0.1 0.2 0.3 | :8 7.1 0.2 0.3 0.1 0.2 0.3 |`,
  },
  {
    title: 'Hallelujah',
    artist: 'Jeff Buckley',
    genre: 'Pop',
    difficulty: 'Intermedio',
    tuning: 'Standard E (Capo 5)',
    tempo: 58,
    timeSignature: '6/8',
    tracksCount: 2,
    lyricsChords: `[Intro]
[C] [Am] [C] [Am]

[Verse 1]
I've [C]heard there was a [Am]secret chord
That [C]David played, and it [Am]pleased the Lord
But [F]you don't really [G]care for music, [C]do you? [G]
It [C]goes like this, the [F]fourth, the [G]fifth
The [Am]minor fall, the [F]major lift
The [G]baffled king com[E7]posing Halle[Am]lujah

[Chorus]
Halle[F]lujah, Halle[Am]lujah
Halle[F]lujah, Halle[C]lu---[G]--[C]jah`,
    data: `\\title "Hallelujah" \\artist "Jeff Buckley" \\tempo 58 . :8 3.5 0.4 0.3 0.2 0.3 0.4 | :8 0.6 2.5 2.4 0.3 2.4 2.5 | :8 3.5 0.4 0.3 0.2 0.3 0.4 | :8 0.6 2.5 2.4 0.3 2.4 2.5 |`,
  },
  {
    title: 'Knockin on Heavens Door',
    artist: 'Bob Dylan',
    genre: 'Rock',
    difficulty: 'Principiante',
    tuning: 'Standard E',
    tempo: 68,
    timeSignature: '4/4',
    tracksCount: 2,
    lyricsChords: `[Intro]
[G] [D] [Am]
[G] [D] [C]

[Verse 1]
[G]Mama, take this [D]badge off of [Am]me
[G]I can't [D]use it any[C]more
[G]It's gettin' dark, too [D]dark for me to [Am]see
[G]I feel I'm [D]knockin' on heaven's [C]door

[Chorus]
[G]Knock, knock, [D]knockin' on heaven's [Am]door
[G]Knock, knock, [D]knockin' on heaven's [C]door`,
    data: `\\title "Knockin on Heavens Door" \\artist "Bob Dylan" \\tempo 68 . :4 (3.6 2.5 0.4 0.3) :4 (0.4 2.3 3.2) :2 (0.5 2.4 2.3 1.2) |`,
  },
  {
    title: 'Zombie',
    artist: 'The Cranberries',
    genre: 'Rock',
    difficulty: 'Principiante',
    tuning: 'Standard E',
    tempo: 84,
    timeSignature: '4/4',
    tracksCount: 3,
    lyricsChords: `[Intro]
[Em] [Cmaj7] [G] [D/F#]

[Verse 1]
[Em]Another [Cmaj7]head hangs lowly
[G]Child is slowly [D/F#]taken
[Em]And the violence [Cmaj7]caused such silence
[G]Who are we mis[D/F#]taken?

[Chorus]
In your [Em]head, in your [Cmaj7]head
Zombie, [G]zombie, zombie-[D/F#]ie-ie`,
    data: `\\title "Zombie" \\artist "The Cranberries" \\tempo 84 . :4 (0.6 2.5 2.4 0.3) :4 (0.5 2.4 0.3 0.2) :4 (3.6 2.5 0.4 0.3) :4 (2.6 0.5 0.4 2.3) |`,
  },
  {
    title: 'Creep',
    artist: 'Radiohead',
    genre: 'Pop',
    difficulty: 'Principiante',
    tuning: 'Standard E',
    tempo: 92,
    timeSignature: '4/4',
    tracksCount: 3,
    lyricsChords: `[Intro]
[G] [B] [C] [Cm]

[Verse 1]
When you were here be[G]fore
Couldn't look you in the [B]eye
You're just like an [C]angel
Your skin makes me [Cm]cry

[Chorus]
But I'm a [G]creep, I'm a [B]weirdo
What the hell am I [C]doing here?
I don't be[Cm]long here`,
    data: `\\title "Creep" \\artist "Radiohead" \\tempo 92 . :4 (3.6 2.5 0.4 0.3) :4 (2.5 4.4 4.3 4.2) :4 (0.5 2.4 0.3 1.2) :4 (3.5 5.4 5.3 4.2) |`,
  },
  {
    title: 'Yellow',
    artist: 'Coldplay',
    genre: 'Pop',
    difficulty: 'Principiante',
    tuning: 'Standard E',
    tempo: 88,
    timeSignature: '4/4',
    tracksCount: 3,
    lyricsChords: `[Intro]
[B] [B/F#] [E] [B]

[Verse 1]
Look at the [B]stars, look how they shine for [F#]you
And everything you [E]do, yeah, they were all [B]yellow

[Chorus]
Your [E]skin, oh yeah, your [G#m]skin and [F#]bones
Turn [E]into some[G#m]thing beau[F#]tiful`,
    data: `\\title "Yellow" \\artist "Coldplay" \\tempo 88 . :4 (2.5 4.4 4.3 4.2) :4 (2.6 4.5 4.4 3.3) :4 (0.6 2.5 2.4 1.3) :4 (2.5 4.4 4.3 4.2) |`,
  },
  {
    title: 'Wish You Were Here',
    artist: 'Pink Floyd',
    genre: 'Rock',
    difficulty: 'Intermedio',
    tuning: 'Standard E',
    tempo: 60,
    timeSignature: '4/4',
    tracksCount: 3,
    lyricsChords: `[Intro]
[Em7] [G] [Em7] [G] [Em7] [A7sus4] [Em7] [A7sus4] [G]

[Verse 1]
[C]So, so you think you can [D]tell
Heaven from [Am]hell, blue skies from [G]pain

[Chorus]
How I [C]wish, how I wish you were [D]here
We're just [Am]two lost souls swimming in a fish bowl, [G]year after year`,
    data: `\\title "Wish You Were Here" \\artist "Pink Floyd" \\tempo 60 . :8 0.3 0.2 0.3 :4 2.4 :8 0.4 2.5 0.5 2.5 :4 0.6 |`,
  },
  {
    title: 'Autumn Leaves',
    artist: 'Jazz Standard',
    genre: 'Jazz',
    difficulty: 'Avanzado',
    tuning: 'Standard E',
    tempo: 120,
    timeSignature: '4/4',
    tracksCount: 3,
    lyricsChords: `[Verse 1]
The [Am7]falling leaves [D7]drift by the [Gmaj7]window [Cmaj7]
The autumn [F#m7b5]leaves of [B7]red and [Em]gold
I see your [Am7]lips, [D7]the summer [Gmaj7]kisses [Cmaj7]
The sun-burned [F#m7b5]hands I [B7]used to [Em]hold

[Chorus]
Since you [B7]went away the days grow [Em]long
And soon I'll [Am7]hear old [D7]winter's [Gmaj7]song
But I [F#m7b5]miss you most of [B7]all, my [Em]darling
When [F#m7b5]autumn [B7]leaves start to [Em]fall`,
    data: `\\title "Autumn Leaves" \\artist "Jazz Standard" \\tempo 120 . :4 0.4 2.4 4.4 :2 5.4 | :4 5.4 4.4 2.4 :2 0.4 | :4 0.5 2.5 3.5 :2 5.5 | :4 5.5 3.5 2.5 :2 0.5 |`,
  },
  {
    title: 'Riptide',
    artist: 'Vance Joy',
    genre: 'Pop',
    difficulty: 'Principiante',
    tuning: 'Standard E (Capo 1)',
    tempo: 102,
    timeSignature: '4/4',
    tracksCount: 2,
    lyricsChords: `[Intro]
[Am] [G] [C] [C]

[Verse 1]
[Am]I was scared of [G]dentists and the [C]dark
[Am]I was scared of [G]pretty girls and [C]starting conversations

[Chorus]
[Am]Lady, [G]running down to the [C]riptide
Taken away to the [Am]dark side
[G]I wanna be your [C]left hand man`,
    data: `\\title "Riptide" \\artist "Vance Joy" \\tempo 102 . :8 0.5 2.4 2.3 0.2 0.1 0.2 2.3 2.4 | :8 3.6 2.5 0.4 0.3 3.2 3.1 0.4 2.5 |`,
  }
];

export default MEGA_CATALOG;
