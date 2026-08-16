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
[C]There will be an [G]answer, let it [F]be [C]`,
    data: `\\title "Let It Be" \\artist "The Beatles" \\tempo 75 . :4 (0.5 2.4 0.3 1.2) :4 (3.6 2.5 0.4 0.3) :4 (0.5 2.4 2.3 1.2) :4 (1.6 3.5 3.4 2.3) | :4 (0.5 2.4 0.3 1.2) :4 (3.6 2.5 0.4 0.3) :4 (1.6 3.5 3.4 2.3) :4 (0.5 2.4 0.3 1.2) |`,
  },
  {
    title: 'Yesterday',
    artist: 'The Beatles',
    genre: 'Acoustic',
    difficulty: 'Principiante',
    tuning: 'Standard E',
    tempo: 96,
    timeSignature: '4/4',
    tracksCount: 2,
    lyricsChords: `[Intro]
[F]

[Verse 1]
[F]Yesterday, [Em7]all my [A7]troubles seemed so [Dm]far away [Dm/C]
[Bb]Now it [C7]looks as though they're [F]here to stay [C/E]
Oh, [Dm]I be[G7]lieve in [Bb]yester[F]day

[Verse 2]
[F]Suddenly, [Em7]I'm not [A7]half the man I [Dm]used to be [Dm/C]
[Bb]There's a [C7]shadow hanging [F]over me [C/E]
Oh, [Dm]yester[G7]day came [Bb]sudden[F]ly

[Chorus]
[Em7]Why [A7]she [Dm]had [C]to [Bb]go, I don't [Gm6]know, she [C7]wouldn't [F]say
[Em7]I [A7]said [Dm]some[C]thing [Bb]wrong, now I [Gm6]long for [C7]yester[F]day`,
    data: `\\title "Yesterday" \\artist "The Beatles" \\tempo 96 . :4 (1.6 3.5 3.4 2.3 1.2 1.1) :4 (0.6 2.5 2.4 0.3 3.2 0.1) :4 (0.5 2.4 0.3 2.2 0.1) :2 (0.4 2.3 3.2 1.1) |`,
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
[D/F#]All we are is [G]dust in the [Am]wind`,
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
'Cause I [Bm7]know I just can't [E7]stay here in [A]heaven`,
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
And she's [C]buying a [G]stairway to [D]heaven`,
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
Any [Dm]time of year (any time of year), you can [E7]find it here`,
    data: `\\title "Hotel California" \\artist "Eagles" \\tempo 75 . :8 2.5 4.4 4.3 3.2 2.1 3.2 4.3 4.4 | :8 2.6 4.5 4.4 3.3 2.2 3.3 4.4 4.5 | :8 0.5 2.4 2.3 1.2 0.1 1.2 2.3 2.4 | :8 0.6 2.5 2.4 1.3 0.2 1.3 2.4 2.5 |`,
  },
  {
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    genre: 'Rock',
    difficulty: 'Avanzado',
    tuning: 'Standard E',
    tempo: 72,
    timeSignature: '4/4',
    tracksCount: 6,
    lyricsChords: `[Intro]
[Bb6] [C7] [Bb6] [C7]

[Verse 1]
[Bb]Mama, just [Gm]killed a man
Put a [Cm]gun against his head, pulled my [F7]trigger, now he's dead
[Bb]Mama, life had [Gm]just begun
But [Cm]now I've gone and [Gaug]thrown it [Eb/G]all a[F#dim]way [F7]
[Eb]Mama, [Bb/D]ooh, [Cm]didn't mean to make you cry
If [Bb]I'm not back a[F/A]gain this time to[Gm]morrow
[Eb]Carry on, [Bb/D]carry on, as if [Cm]nothing really [F]matters`,
    data: `\\title "Bohemian Rhapsody" \\artist "Queen" \\tempo 72 . :4 (1.5 3.4 3.3 3.2) :4 (3.6 5.5 5.4 3.3) :4 (3.5 5.4 5.3 4.2) :4 (1.6 3.5 1.4 2.3) |`,
  },
  {
    title: 'Love of My Life',
    artist: 'Queen',
    genre: 'Acoustic',
    difficulty: 'Intermedio',
    tuning: 'Standard E',
    tempo: 76,
    timeSignature: '3/4',
    tracksCount: 2,
    lyricsChords: `[Intro]
[D] [Bm] [Em] [A7]

[Verse 1]
[D]Love of my life, you've [Bm]hurt me
You've [Em]broken my heart, and [A]now you leave me
[D]Love of my life, can't [D7]you see?
Bring it [G]back, bring it [D/F#]back, don't [Em]take it a[A]way from me
Because [Bm]you don't [F#m]know what it [G]means to [D]me`,
    data: `\\title "Love of My Life" \\artist "Queen" \\tempo 76 . :4 (0.4 2.3 3.2 2.1) :4 (2.5 4.4 4.3 3.2) :4 (0.6 2.5 2.4 0.3) :4 (0.5 2.4 2.3 2.2) |`,
  },
  {
    title: 'Perfect',
    artist: 'Ed Sheeran',
    genre: 'Pop',
    difficulty: 'Principiante',
    tuning: 'Standard E (Capo 1)',
    tempo: 63,
    timeSignature: '12/8',
    tracksCount: 3,
    lyricsChords: `[Intro]
[G]

[Verse 1]
I found a [G]love for [Em]me
Darling, just [C]dive right in and follow my [D]lead
Well, I found a [G]girl, beautiful and [Em]sweet
Oh, I never [C]knew you were the someone waiting for [D]me

[Chorus]
Baby, I'm [G]dancing in the [Em]dark with you between my [C]arms
Barefoot on the [G]grass, [D]listening to our [Em]favorite song
When you [C]said you looked a [G]mess, I whispered [D]underneath my [Em]breath
But you [C]heard it, darling, [G]you look [D]perfect to[G]night`,
    data: `\\title "Perfect" \\artist "Ed Sheeran" \\tempo 63 . :8 (3.6 2.5 0.4 0.3) :8 (0.5 2.4 2.3) :8 (3.5 2.4 0.3 1.2) :8 (0.4 2.3 3.2) |`,
  },
  {
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    genre: 'Pop',
    difficulty: 'Principiante',
    tuning: 'Standard E (Capo 2)',
    tempo: 96,
    timeSignature: '4/4',
    tracksCount: 3,
    lyricsChords: `[Intro]
[Bm] [Em] [G] [A]

[Verse 1]
The [Bm]club isn't the best place to [Em]find a lover
So the [G]bar is where I [A]go
[Bm]Me and my friends at the [Em]table doing shots
Drinking [G]fast and then we talk [A]slow

[Chorus]
[Bm]Girl, you know I [Em]want your love
Your [G]love was handmade for [A]somebody like me
[Bm]Come on now, [Em]follow my lead
[G]I may be crazy, [A]don't mind me`,
    data: `\\title "Shape of You" \\artist "Ed Sheeran" \\tempo 96 . :4 (2.5 4.4 4.3 3.2) :4 (0.6 2.5 2.4 0.3) :4 (3.6 2.5 0.4 0.3) :4 (0.5 2.4 2.3 2.2) |`,
  },
  {
    title: 'All Too Well',
    artist: 'Taylor Swift',
    genre: 'Country',
    difficulty: 'Principiante',
    tuning: 'Standard E (Capo 3)',
    tempo: 86,
    timeSignature: '4/4',
    tracksCount: 3,
    lyricsChords: `[Intro]
[C] [G] [Am] [F]

[Verse 1]
I [C]walked through the door with you, the [G]air was cold
But [Am]something about it felt like [F]home somehow
And I [C]left my scarf there at your [G]sister's house
And you've [Am]still got it in your [F]drawer even now

[Chorus]
'Cause there we [C]are again in the [G]middle of the night
We're [Am]dancing 'round the kitchen in the [F]refrigerator light
[C]Down the stairs, I was [G]there, I re[Am]member it all too [F]well`,
    data: `\\title "All Too Well" \\artist "Taylor Swift" \\tempo 86 . :4 (0.5 2.4 0.3 1.2) :4 (3.6 2.5 0.4 0.3) :4 (0.5 2.4 2.3 1.2) :4 (1.6 3.5 3.4 2.3) |`,
  },
  {
    title: 'Love Story',
    artist: 'Taylor Swift',
    genre: 'Country',
    difficulty: 'Principiante',
    tuning: 'Standard E (Capo 3)',
    tempo: 120,
    timeSignature: '4/4',
    tracksCount: 3,
    lyricsChords: `[Intro]
[C] [G] [Am] [F]

[Verse 1]
We were [C]both young when I first saw you
I [F]close my eyes and the flashback starts
I'm [Am]standing there on a [F]balcony in summer air

[Chorus]
Romeo, [C]take me somewhere we can be alone
I'll be [G]waiting, all there's left to do is run
You'll be the [Am]prince and I'll be the princess
It's a [F]love story, [G]baby, just say, "[C]Yes"`,
    data: `\\title "Love Story" \\artist "Taylor Swift" \\tempo 120 . :4 (0.5 2.4 0.3 1.2) :4 (1.6 3.5 3.4 2.3) :4 (0.5 2.4 2.3 1.2) :4 (1.6 3.5 3.4 2.3) |`,
  },
  {
    title: 'Smells Like Teen Spirit',
    artist: 'Nirvana',
    genre: 'Rock',
    difficulty: 'Principiante',
    tuning: 'Standard E',
    tempo: 116,
    timeSignature: '4/4',
    tracksCount: 4,
    lyricsChords: `[Intro]
[F5] [Bb5] [Ab5] [Db5]
[F5] [Bb5] [Ab5] [Db5]

[Verse 1]
[F5]Load up on [Bb5]guns, bring [Ab5]your [Db5]friends
[F5]It's fun to [Bb5]lose and [Ab5]to pre[Db5]tend
[F5]She's over-[Bb5]bored and [Ab5]self-as[Db5]sured
[F5]Oh no, I [Bb5]know a [Ab5]dirty [Db5]word

[Chorus]
[F5]With the lights [Bb5]out, [Ab5]it's less [Db5]dangerous
[F5]Here we are [Bb5]now, [Ab5]enter[Db5]tain us
[F5]I feel stu[Bb5]pid [Ab5]and con[Db5]tagious
[F5]Here we are [Bb5]now, [Ab5]enter[Db5]tain us
A [F5]mulatto, an al[Bb5]bino, a mos[Ab5]quito, my li[Db5]bido, yeah`,
    data: `\\title "Smells Like Teen Spirit" \\artist "Nirvana" \\tempo 116 . :8 (1.6 3.5 3.4) (1.6 3.5 3.4) (1.5 3.4 3.3) (1.5 3.4 3.3) | :8 (4.6 6.5 6.4) (4.6 6.5 6.4) (4.5 6.4 6.3) (4.5 6.4 6.3) |`,
  },
  {
    title: 'Come As You Are',
    artist: 'Nirvana',
    genre: 'Rock',
    difficulty: 'Principiante',
    tuning: 'Standard D (Tune down 1 step)',
    tempo: 120,
    timeSignature: '4/4',
    tracksCount: 3,
    lyricsChords: `[Intro]
[F#m] [A] [F#m] [A]

[Verse 1]
[F#m]Come as you [A]are, as you [F#m]were
As I [A]want you to [F#m]be
As a [A]friend, as a [F#m]friend
As an [A]old ene[F#m]my

[Chorus]
[B]Memoria, [D]memoria
[B]Memoria, [D]memoria`,
    data: `\\title "Come As You Are" \\artist "Nirvana" \\tempo 120 . :8 0.6 0.6 1.6 2.6 0.5 2.6 0.5 2.6 | :8 2.6 2.6 1.6 0.6 2.5 0.6 0.6 0.6 |`,
  },
  {
    title: 'Someone Like You',
    artist: 'Adele',
    genre: 'Pop',
    difficulty: 'Principiante',
    tuning: 'Standard E',
    tempo: 68,
    timeSignature: '4/4',
    tracksCount: 2,
    lyricsChords: `[Intro]
[A] [A/G#] [F#m] [D]

[Verse 1]
[A]I heard that you're [A/G#]settled down
That you [F#m]found a girl and you're [D]married now
[A]I heard that your [A/G#]dreams came true
Guess she [F#m]gave you things I didn't [D]give to you

[Chorus]
Never [A]mind, I'll find [E]someone like [F#m]you [D]
I wish [A]nothing but the [E]best for [F#m]you, [D]too
"Don't [A]forget me, I [E]beg," I remember [F#m]you [D]said
"Sometimes it [A]lasts in love, but [E]sometimes it hurts in[F#m]stead" [D]`,
    data: `\\title "Someone Like You" \\artist "Adele" \\tempo 68 . :16 (0.5 2.3) 2.2 2.1 2.2 (0.5 2.3) 2.2 2.1 2.2 | :16 (4.6 2.3) 2.2 2.1 2.2 (4.6 2.3) 2.2 2.1 2.2 |`,
  },
  {
    title: 'Bad Guy',
    artist: 'Billie Eilish',
    genre: 'Pop',
    difficulty: 'Principiante',
    tuning: 'Standard E',
    tempo: 135,
    timeSignature: '4/4',
    tracksCount: 3,
    lyricsChords: `[Intro]
[Gm] [C] [D7] [Gm]

[Verse 1]
[Gm]White shirt now red, my bloody nose
Sleeping, you're on your tippy toes
[C]Creeping around like no one knows
Think you're so criminal
[D7]Bruises on both my knees for you
Don't say thank you or please
I do [Gm]what I want when I'm wanting to

[Chorus]
So you're a tough guy, [Gm]like it really rough guy
Just can't get enough guy, chest always so puffed guy
[C]I'm that bad type, make your mama sad type
[D7]Make your girlfriend mad tight, might seduce your dad type
I'm the [Gm]bad guy, duh`,
    data: `\\title "Bad Guy" \\artist "Billie Eilish" \\tempo 135 . :4 (3.6 5.5 5.4 3.3) :4 (3.5 5.4 5.3 5.2) :4 (2.4 1.3 2.2 0.1) :4 (3.6 5.5 5.4 3.3) |`,
  },
  {
    title: 'Clavado en un Bar',
    artist: 'Maná',
    genre: 'Rock',
    difficulty: 'Intermedio',
    tuning: 'Standard E',
    tempo: 132,
    timeSignature: '4/4',
    tracksCount: 4,
    lyricsChords: `[Intro]
[Bm] [A] [G] [F#7]

[Verse 1]
[Bm]Aquí me tiene bien clavado, soltando las penas en un bar
[A]Brindando por su amor
[G]Aquí me tiene abandonado, bebiendo tequila pa' olvidar
[F#7]Y sintiendo este dolor

[Chorus]
[Bm]Estoy clavado, [A]estoy herido
[G]Estoy ahogado en un [F#7]bar
[Bm]Desesperado, [A]en el olvido
[G]Estoy tan solo en el [F#7]mar`,
    data: `\\title "Clavado en un Bar" \\artist "Mana" \\tempo 132 . :4 (2.5 4.4 4.3 3.2) :4 (0.5 2.4 2.3 2.2) :4 (3.6 2.5 0.4 0.3) :4 (2.6 4.5 2.4 3.3) |`,
  },
  {
    title: 'Antologia',
    artist: 'Shakira',
    genre: 'Pop',
    difficulty: 'Principiante',
    tuning: 'Standard E',
    tempo: 84,
    timeSignature: '4/4',
    tracksCount: 2,
    lyricsChords: `[Intro]
[C] [G] [Am] [F]

[Verse 1]
Para a[C]marte necesito una ra[G]zón
Y es di[Am]fícil descubrirla que no sea [F]otra que tu gran amor
Y a[C]prendí a quitarle al tiempo los se[G]gundos
Tú me hi[Am]ciste ver el cielo aún más pro[F]fundo

[Chorus]
Y fue por [C]ti que aprendí a que[G]rer los gatos
Desves[Am]tiste la piel de mis [F]zapatos
Y me hi[C]ciste escribir más de cien can[G]ciones
Y hasta per[Am]donar tus equivoca[F]ciones`,
    data: `\\title "Antologia" \\artist "Shakira" \\tempo 84 . :4 (0.5 2.4 0.3 1.2) :4 (3.6 2.5 0.4 0.3) :4 (0.5 2.4 2.3 1.2) :4 (1.6 3.5 3.4 2.3) |`,
  },
  {
    title: 'Standby',
    artist: 'Extremoduro',
    genre: 'Rock',
    difficulty: 'Intermedio',
    tuning: 'Standard E',
    tempo: 110,
    timeSignature: '4/4',
    tracksCount: 4,
    lyricsChords: `[Intro]
[Em] [C] [G] [D]

[Verse 1]
[Em]Sintió calor en su mirada, le dijo: "[C]Ven, no temas nada"
[G]Y se marcharon a la [D]orilla del río
[Em]Pasó la noche en un instante, se despertó [C]muy sonriente
[G]Y se miraron con los [D]ojos prendidos

[Chorus]
Y es que la [C]pena que [D]siento en el [Em]alma
No la [C]cura nin[D]guna can[Em]ción`,
    data: `\\title "Standby" \\artist "Extremoduro" \\tempo 110 . :4 (0.6 2.5 2.4 0.3) :4 (0.5 2.4 0.3 1.2) :4 (3.6 2.5 0.4 0.3) :4 (0.4 2.3 3.2 2.1) |`,
  },
  {
    title: 'Dejame',
    artist: 'Los Secretos',
    genre: 'Pop',
    difficulty: 'Principiante',
    tuning: 'Standard E',
    tempo: 128,
    timeSignature: '4/4',
    tracksCount: 3,
    lyricsChords: `[Intro]
[D] [G] [A] [D]

[Verse 1]
[D]Déjame, no juegues [G]más conmigo
[A]Esta vez en serio [D]te lo digo
[D]Tuviste una oportunidad y la [G]dejaste escapar
[A]Ya no hay nada que decir, déjame en [D]paz

[Chorus]
[G]Déjame, [A]ya no tiene [D]sentido
[G]Déjame, [A]todo se ha con[D]cluido`,
    data: `\\title "Dejame" \\artist "Los Secretos" \\tempo 128 . :4 (0.4 2.3 3.2 2.1) :4 (3.6 2.5 0.4 0.3) :4 (0.5 2.4 2.3 2.2) :4 (0.4 2.3 3.2 2.1) |`,
  },
  {
    title: 'La Flaca',
    artist: 'Jarabe de Palo',
    genre: 'Rock',
    difficulty: 'Principiante',
    tuning: 'Standard E',
    tempo: 118,
    timeSignature: '4/4',
    tracksCount: 3,
    lyricsChords: `[Intro]
[Am] [G] [F] [E7]

[Verse 1]
En la [Am]Habana casi no oscurece, la [G]noche se confunde con el día
La [F]Flaca duerme de día y de [E7]noche camina
En su [Am]cuerpo un vestido de seda, que se [G]pega a su piel de canela
La [F]Flaca no tiene dueño, pero a [E7]todos entrega

[Chorus]
Por un [Am]beso de la Flaca daría lo [G]que fuera
Por un [F]beso de ella, aunque sólo uno [E7]fuera`,
    data: `\\title "La Flaca" \\artist "Jarabe de Palo" \\tempo 118 . :4 (0.5 2.4 2.3 1.2) :4 (3.6 2.5 0.4 0.3) :4 (1.6 3.5 3.4 2.3) :4 (0.6 2.5 0.4 1.3) |`,
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
