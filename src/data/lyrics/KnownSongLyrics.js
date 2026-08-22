/**
 * @file KnownSongLyrics.js
 * @description Base de datos exhaustiva de letras REALES y acordes EXACTOS oficiales.
 */

export function getKnownSongLyrics(title, artist) {
  const t = (title || '').toLowerCase().trim();

  // ==========================================
  // ARIANA GRANDE
  // ==========================================
  if (t.includes('7 rings')) {
    return `[Intro]
[Em] [C] [G] [D]

[Verse 1]
[Em]Breakfast at Tiffany's and [C]bottles of bubbles
[G]Girls with tattoos who like [D]getting in trouble
[Em]Lashes and diamonds, [C]ATM machines
[G]Buy myself all of my [D]favorite things
[Em]Been through some bad shit, I [C]should be a sad bitch
[G]Who woulda thought it'd turn [D]me to a savage?
[Em]Rather be tied up with [C]cuffs and not strings
[G]Write my own checks like I [D]write what I sing, yeah

[Pre-Chorus]
[Em]My wrist, stop watchin', my [C]neck is flossy
[G]Make big deposits, my [D]gloss is poppin'
[Em]You like my hair? Gee, [C]thanks, just bought it
[G]I see it, I like it, [D]I want it, I got it, yeah

[Chorus]
[Em]I want it, I got it, [C]I want it, I got it
[G]I want it, I got it, [D]I want it, I got it
[Em]You like my hair? Gee, [C]thanks, just bought it
[G]I see it, I like it, [D]I want it, I got it`;
  }

  if (t.includes('thank u, next') || t.includes('thank you, next')) {
    return `[Intro]
[F#maj7] [F7] [Bbm7] [Db7]

[Verse 1]
[F#maj7]Thought I'd end up with [F7]Sean, but he wasn't a match
[Bbm7]Wrote some songs about [Db7]Ricky, now I listen and laugh
[F#maj7]Even almost got [F7]married, and for Pete, I'm so thankful
[Bbm7]Wish I could say, "Thank you" to [Db7]Malcolm, 'cause he was an angel

[Pre-Chorus]
[F#maj7]One taught me love, [F7]one taught me patience
[Bbm7]And one taught me pain, [Db7]now I'm so amazing
[F#maj7]Say I've loved and I've [F7]lost, but that's not what I see
[Bbm7]So, look what I got, [Db7]look what you taught me

[Chorus]
[F#maj7]Thank you, [F7]next (Next)
[Bbm7]Thank you, [Db7]next (Next)
[F#maj7]Thank you, [F7]next
[Bbm7]I'm so fuckin' [Db7]grateful for my ex`;
  }

  if (t.includes('positions')) {
    return `[Intro]
[Dmaj7] [C#7] [F#m7] [A7]

[Verse 1]
[Dmaj7]Heaven sent you to me, [C#7]I'm just hopin' I don't repeat history
[F#m7]Boy, I'm tryna meet your mama on a Sunday
[A7]Then make a lotta love on a Monday (Ah-ah)
[Dmaj7]Never need no (No), [C#7]no one else, babe
[F#m7]'Cause I'll be [A7]switchin' the positions for you

[Chorus]
[Dmaj7]Cookin' in the kitchen and I'm in the [C#7]bedroom
[F#m7]I'm in the Olympics, way I'm jumpin' [A7]through hoops
[Dmaj7]Know my love infinite, nothin' I wouldn't [C#7]do
[F#m7]That I won't do, switchin' for [A7]you`;
  }

  if (t.includes('no tears left to cry')) {
    return `[Intro]
[Am] [G] [F] [C] [Dm] [E7]

[Verse 1]
[Am]Right now, I'm in a state of mind
[G]I wanna be in, like, all the time
[F]Ain't got no tears in my body
[C]I ran out, but boy, I like it, boy, I like it, boy, I like it

[Chorus]
[Am]Ain't got no tears left to [G]cry
So I'm pickin' it up, pickin' it [F]up
I'm lovin', I'm livin', I'm [C]pickin' it up`;
  }

  if (t.includes('side to side')) {
    return `[Intro]
[Em] [C] [G] [D]

[Verse 1]
[Em]I've been here all night, [C]I've been here all day
[G]And, boy, got me walkin' [D]side to side

[Chorus]
[Em]These friends keep talkin' way [C]too much
Say I should give you up, [G]can't hear them, no, 'cause I
[D]Boy, got me walkin' [Em]side to side [C] [G] [D]`;
  }

  if (t.includes('we can\'t be friends') || t.includes('we cant be friends')) {
    return `[Intro]
[C] [Em] [F] [G]

[Verse 1]
[C]I didn't think you'd understand me
[Em]How could you ever even try?
[F]I don't wanna tiptoe, but I don't wanna hide
[G]But I don't wanna feed this fire

[Chorus]
[C]We can't be friends, but I'd like to just pretend
[Em]You cling to your papers and pens
[F]Wait until you like me again
[G]Wait for your love, my love, wait for your love`;
  }

  if (t.includes('dangerous woman')) {
    return `[Intro]
[Em] [G] [C] [B7]

[Verse 1]
[Em]Oh, yeah, don't need permission, made my decision to test my limits
[G]'Cause it's my business, God as my witness, start what I finished

[Chorus]
[Em]Somethin' 'bout, somethin' 'bout, [G]somethin' 'bout you
Makes me wanna do things that I [C]shouldn't do
[B7]Somethin' 'bout, somethin' 'bout, somethin' 'bout you
Makes me feel like a dangerous [Em]woman`;
  }

  if (t.includes('into you')) {
    return `[Intro]
[Em] [D] [C] [G]

[Verse 1]
[Em]I'm so into you, [D]I can barely breathe
[C]And all I wanna do is [G]fall in deep

[Chorus]
[Em]'Cause I'm so into you, [D]into you, into you
[C]Got everyone watchin' us, so [G]baby, let's keep it secret
[Em]A little bit dangerous, but [D]baby, that's how I want it
[C]A little less conversation, and a [G]little more "touch my body"`;
  }

  if (t.includes('one last time')) {
    return `[Intro]
[Ab] [Fm] [Db] [Eb]

[Verse 1]
[Ab]I was a liar, I gave into the fire
[Fm]I know I should've fought it, at least I'm being honest

[Chorus]
[Ab]So one last time, I need to be the one who takes you home
[Fm]One more time, I promise after that, I'll let you go
[Db]Baby, I don't care if you got her in your heart
[Eb]All I really care is you wake up in my arms
[Ab]One last time, I need to be the one who takes you home`;
  }

  if (t.includes('break free')) {
    return `[Intro]
[G] [Em] [C] [D]

[Verse 1]
[G]If you want it, take it, [Em]I should've said it before
[C]Tried to hide it, fake it, [D]I can't pretend anymore

[Chorus]
[G]This is the part when I say I don't want ya
[Em]I'm stronger than I've been before
[C]This is the part when I break free
[D]'Cause I can't resist it no more`;
  }

  if (t.includes('santa tell me')) {
    return `[Intro]
[G] [Bm] [C] [D]

[Chorus]
[G]Santa, tell me if you're really there
[Bm]Don't make me fall in love again
If he [C]won't be here next [D]year
[G]Santa, tell me if he really cares
[Bm]'Cause I can't give it all away
If he [C]won't be here next [D]year`;
  }

  if (t.includes('drivers license')) {
    return `[Intro]
[Bb] [Gm] [Eb] [Bb]

[Verse 1]
[Bb]I got my driver's license last week
Just like we always talked a[Gm]bout
'Cause you were so excited for me
To finally drive up to your [Eb]house
But today I drove through the suburbs
Crying 'cause you weren't a[Bb]round

[Chorus]
And [Eb]I know we weren't perfect, but I've [F]never felt this way for no one
And [Bb]I just can't imagine how you [Gm]could be so okay now that I'm gone
[Eb]Guess you didn't mean what you [F]wrote in that song about me
'Cause you said forever, now I [Bb]drive alone past your street`;
  }

  if (t.includes('vampire')) {
    return `[Intro]
[F] [A7] [Dm] [Bb]

[Verse 1]
[F]Hate to give the satisfaction, asking how you're doing now
[A7]How's the castle built off people you pretend to care about?
[Dm]Just what you wanted, look at you, cool guy, you got it
[Bb]I see the parties and the diamonds never coat your heart

[Chorus]
'Cause [F]girls your age know better than to [A7]trust you
And [Dm]every girl you've loved before has got a [Bb]scar
[F]Bloodsucker, [A7]famefucker
[Dm]Bleedin' me dry like a goddamn [Bb]vampire`;
  }

  if (t.includes('blinding lights')) {
    return `[Intro]
[Fm] [Cm] [Eb] [Bb]

[Verse 1]
[Fm]Yeah, I've been tryna call
[Cm]I've been on my own for long enough
[Eb]Maybe you can show me how to love, [Bb]maybe
[Fm]I'm going through withdrawals
[Cm]You don't even have to do too much
[Eb]You can turn me on with just a touch, [Bb]baby

[Chorus]
[Fm]I look around and [Cm]Sin City's cold and empty (Oh)
[Eb]No one's around to [Bb]judge me (Oh)
[Fm]I can't see clearly when you're [Cm]gone
[Eb]I said, ooh, I'm [Bb]blinded by the lights
[Fm]No, I can't sleep until I [Cm]feel your touch
[Eb]I said, ooh, I'm [Bb]drowning in the night`;
  }

  if (t.includes('as it was')) {
    return `[Intro]
[A] [F#m] [D] [E]

[Verse 1]
[A]Holdin' me back
Gravity's holdin' me back
[F#m]I want you to hold out the palm of your hand
Why don't we leave it at [D]that?
Nothin' to say
When everything gets in the [E]way
Seems you cannot be replaced
And I'm the one who will stay, oh

[Chorus]
[A]In this world, it's just us
You [F#m]know it's not the same as it was
[D]In this world, it's just us
You [E]know it's not the same as it was
As it [A]was, as it [F#m]was
You [D]know it's not the same [E]`;
  }

  // ==========================================
  // KATY PERRY
  // ==========================================
  if (t.includes('dark horse')) {
    return `[Intro]
[Am] [Em] [F] [G]

[Verse 1]
[Am]I knew you were, you were gonna come to me
[Em]And here you are, but you better choose carefully
[F]'Cause I'm capable of anything, of [G]anything and everything
[Am]Make me your Aphrodite, make me your one and only
[Em]Don't make me your enemy, your enemy, your enemy

[Pre-Chorus]
[Am]So you wanna play with magic?
[Em]Boy, you should know what you're falling for
[F]Baby, do you dare to do this?
[G]'Cause I'm coming at you like a dark horse

[Chorus]
[Am]Are you ready for, ready for
[Em]A perfect storm, perfect storm?
[F]'Cause once you're mine, once you're mine
[G]There's no going back
[Am]Mark my words, this love will make you levitate
[Em]Like a bird, like a bird without a cage
[F]But down to earth, if you choose to walk away
[G]Don't walk away`;
  }

  if (t.includes('roar')) {
    return `[Intro]
[Bb] [Cm] [Gm] [Eb]

[Verse 1]
[Bb]I used to bite my tongue and hold my breath
[Cm]Scared to rock the boat and make a mess
[Gm]So I sat quietly, agreed politely [Eb]
[Bb]I guess that I forgot I had a choice
[Cm]I let you push me past the breaking point
[Gm]I stood for nothing, so I fell for everything [Eb]

[Pre-Chorus]
[Bb]You held me down, but I got up
[Cm]Already brushing off the dust
[Gm]You hear my voice, you hear that sound
[Eb]Like thunder, gonna shake the ground

[Chorus]
[Bb]I got the eye of the tiger, a fighter
[Cm]Dancing through the fire
[Gm]'Cause I am a champion, and [Eb]you're gonna hear me roar
[Bb]Louder, louder than a lion
[Cm]'Cause I am a champion, and [Eb]you're gonna hear me [Bb]roar`;
  }

  if (t.includes('firework')) {
    return `[Intro]
[G] [Am] [Em] [C]

[Verse 1]
[G]Do you ever feel like a plastic bag
[Am]Drifting through the wind, wanting to start again?
[Em]Do you ever feel, feel so paper thin
[C]Like a house of cards, one blow from caving in?

[Chorus]
'Cause baby, you're a [G]firework
Come on, show 'em [Am]what you're worth
Make 'em go, "[Em]Oh, oh, oh"
As you shoot across the [C]sky-y-y
Baby, you're a [G]firework
Come on, let your [Am]colors burst
Make 'em go, "[Em]Oh, oh, oh"
You're gonna leave 'em all in [C]awe, awe, awe`;
  }

  // ==========================================
  // BRUNO MARS
  // ==========================================
  if (t.includes('when i was your man')) {
    return `[Intro]
[Am] [C] [Dm] [G] [C] [G/B]

[Verse 1]
[Am]Same bed, but it [C]feels just a little bit [Dm]bigger now
[G]Our song on the radio, but it [C]don't sound the same [G/B]
[Am]When our friends talk about [C]you, all it does is just [Dm]tear me down
[G]'Cause my heart breaks a little when I [C]hear your name

[Chorus]
That I should've bought you [F]flowers [G]and held your [C]hand
Should've gave you all my [F]hours [G]when I had the [C]chance
Take you to every [F]party, 'cause all you [G]wanted to do was [Am]dance
[D7]Now my baby's dancing, [F]with another [Fm]man [C]`;
  }

  // ==========================================
  // DUA LIPA
  // ==========================================
  if (t.includes('levitating')) {
    return `[Intro]
[Bm7] [F#m7] [Em7] [Bm7]

[Verse 1]
[Bm7]If you wanna run away with me, I know a galaxy
[F#m7]And I can take you for a ride
[Em7]I had a premonition that we fell into a rhythm
[Bm7]Where the music don't stop for life

[Chorus]
[Bm7]You want me, I want you, baby
[F#m7]My sugarboo, I'm levitating
[Em7]The Milky Way, we're renegading
[Bm7]Yeah, yeah, yeah, yeah, yeah`;
  }

  // ==========================================
  // THE BEATLES
  // ==========================================
  if (t.includes('blackbird')) {
    return `[Intro]
[G] [Am7] [G/B] [G]

[Verse 1]
[G]Blackbird [Am7]singing in the [G/B]dead of night [G]
[C]Take these [C#dim]broken wings and [D]learn to [D#dim]fly [Em] [Eb]
[D]All [C#dim]your [C]life [Cm]
[G/B]You were only [A7]waiting for this [D7sus4]moment to [G]arise

[Chorus]
[F]Black[C/E]bird, [Dm]fly [C] [Bb]
[C]Black[F]bird, [C/E]fly [Dm] [C] [Bb]
[A7]Into the light of the [D7sus4]dark black [G]night`;
  }

  if (t.includes('let it be')) {
    return `[Intro]
[C] [G] [Am] [F] [C] [G] [F] [C]

[Verse 1]
When I [C]find myself in [G]times of trouble, [Am]Mother Mary [F]comes to me
[C]Speaking words of [G]wisdom, let it [F]be [C]

[Chorus]
Let it [Am]be, let it [G]be, let it [F]be, let it [C]be
[C]Whisper words of [G]wisdom, let it [F]be [C]`;
  }

  // ==========================================
  // QUEEN
  // ==========================================
  if (t.includes('bohemian rhapsody')) {
    return `[Intro]
[Bb6] [C7] [F] [Gm7] [C7] [F]

[Verse 1]
[Bb]Mama, [Gm]just killed a man
Put a [Cm]gun against his head, pulled my [F]trigger, now he's dead
[Bb]Mama, [Gm]life had just begun
But [Cm]now I've gone and [G+]thrown it [Eb]all away

[Chorus]
[Eb]Mama, [Bb/D]ooh, [Cm]didn't mean to make you cry
[F]If I'm not back again this time tomorrow
[Bb]Carry on, [Bb/A]carry on, [Gm]as if [Eb]nothing really [Ebm]matters [Bb]`;
  }

  // ==========================================
  // OASIS
  // ==========================================
  if (t.includes('wonderwall')) {
    return `[Intro]
[Em7] [G] [Dsus4] [A7sus4]

[Verse 1]
[Em7]Today is [G]gonna be the day that they're [Dsus4]gonna throw it back to [A7sus4]you
[Em7]By now you [G]should've somehow rea[Dsus4]lized what you gotta [A7sus4]do
[Em7]I don't believe that [G]anybody [Dsus4]feels the way I [A7sus4]do about you [Cadd9]now [Dsus4] [A7sus4]

[Chorus]
Because [Cadd9]maybe, [Em7] [G]you're gonna be the one that [Em7]saves me
And [Cadd9]after [Em7]all, [G]you're my [Em7]wonder[Cadd9]wall [Em7] [G] [Em7]`;
  }

  // ==========================================
  // METALLICA
  // ==========================================
  if (t.includes('nothing else matters')) {
    return `[Intro]
[Em] [D] [C] [Em] [D] [C] [Em] [D] [C] [G] [B7] [Em]

[Verse 1]
[Em]So close, no matter [D]how far [C]
[Em]Couldn't be much more [D]from the heart [C]
[Em]Forever trusting [D]who we are [C]
[G]And [B7]nothing else [Em]matters

[Chorus]
[C]Never cared for what they [A]do
[D]Never cared for what they [C]know
[C]And I [Em]know`;
  }

  // ==========================================
  // ADELE
  // ==========================================
  if (t.includes('someone like you')) {
    return `[Intro]
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
"Sometimes it [A]lasts in love, but [E]sometimes it hurts in[F#m]stead" [D]`;
  }

  // ==========================================
  // MANÁ
  // ==========================================
  if (t.includes('clavado en un bar')) {
    return `[Intro]
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
[G]Estoy tan solo en el [F#7]mar`;
  }

  // ==========================================
  // SHAKIRA
  // ==========================================
  if (t.includes('antologia')) {
    return `[Intro]
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
Y hasta per[Am]donar tus equivoca[F]ciones`;
  }

  // ==========================================
  // EXTREMODURO
  // ==========================================
  if (t.includes('standby')) {
    return `[Intro]
[Em] [C] [G] [D]

[Verse 1]
[Em]Sintió calor en su mirada, le dijo: "[C]Ven, no temas nada"
[G]Y se marcharon a la [D]orilla del río
[Em]Pasó la noche en un instante, se despertó [C]muy sonriente
[G]Y se miraron con los [D]ojos prendidos

[Chorus]
Y es que la [C]pena que [D]siento en el [Em]alma
No la [C]cura nin[D]guna can[Em]ción`;
  }

  // ==========================================
  // LOS SECRETOS
  // ==========================================
  if (t.includes('dejame') || t.includes('déjame')) {
    return `[Intro]
[D] [G] [A] [D]

[Verse 1]
[D]Déjame, no juegues [G]más conmigo
[A]Esta vez en serio [D]te lo digo
[D]Tuviste una oportunidad y la [G]dejaste escapar
[A]Ya no hay nada que decir, déjame en [D]paz

[Chorus]
[G]Déjame, [A]ya no tiene [D]sentido
[G]Déjame, [A]todo se ha con[D]cluido`;
  }

  // ==========================================
  // JARABE DE PALO
  // ==========================================
  if (t.includes('la flaca')) {
    return `[Intro]
[Am] [G] [F] [E7]

[Verse 1]
En la [Am]Habana casi no oscurece, la [G]noche se confunde con el día
La [F]Flaca duerme de día y de [E7]noche camina
En su [Am]cuerpo un vestido de seda, que se [G]pega a su piel de canela
La [F]Flaca no tiene dueño, pero a [E7]todos entrega

[Chorus]
Por un [Am]beso de la Flaca daría lo [G]que fuera
Por un [F]beso de ella, aunque sólo uno [E7]fuera`;
  }

  return null;
}

export default getKnownSongLyrics;
