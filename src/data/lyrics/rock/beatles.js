/**
 * @file beatles.js
 * @description The Beatles - Letras y acordes 100% completos y oficiales en formato ChordPro.
 */

export function getBeatlesLyrics(t, a) {
  // ==========================================
  // 1. The Beatles - Here Comes The Sun
  // ==========================================
  if (t.includes('here comes the sun')) {
    return `[Intro]
[D] [G] [A7]
[D] [G] [A7]

[Chorus]
[D]Here comes the sun, doo-doo-doo-doo
[G]Here comes the [E7]sun, and I say
[D]It's all right [G] [D/F#] [Em] [D] [A7]

[Verse 1]
[D]Little darling, it's been a [G]long, cold, lonely [A7]winter
[D]Little darling, it feels like [G]years since it's been [A7]here

[Chorus]
[D]Here comes the sun, doo-doo-doo-doo
[G]Here comes the [E7]sun, and I say
[D]It's all right [G] [D/F#] [Em] [D] [A7]

[Verse 2]
[D]Little darling, the smiles re[G]turning to their [A7]faces
[D]Little darling, it seems like [G]years since it's been [A7]here

[Chorus]
[D]Here comes the sun, doo-doo-doo-doo
[G]Here comes the [E7]sun, and I say
[D]It's all right [G] [D/F#] [Em] [D] [A7]

[Bridge]
[F]Sun, [C]sun, [G]sun, here it [D]comes [A7]
[F]Sun, [C]sun, [G]sun, here it [D]comes [A7]
[F]Sun, [C]sun, [G]sun, here it [D]comes [A7]
[F]Sun, [C]sun, [G]sun, here it [D]comes [A7]
[F]Sun, [C]sun, [G]sun, here it [D]comes [A7]

[Verse 3]
[D]Little darling, I feel that [G]ice is slowly [A7]melting
[D]Little darling, it seems like [G]years since it's been [A7]clear

[Chorus]
[D]Here comes the sun, doo-doo-doo-doo
[G]Here comes the [E7]sun, and I say
[D]It's all right [G] [D/F#] [Em] [D] [A7]

[Outro]
[D]Here comes the sun, doo-doo-doo-doo
[G]Here comes the [E7]sun
[D]It's all right [G] [D/F#] [Em] [D] [A7]
[D]It's all right [G] [D/F#] [Em] [D] [A7] [D]`;
  }

  // ==========================================
  // 2. The Beatles - Come Together
  // ==========================================
  if (t.includes('come together')) {
    return `[Intro]
[Dm] [Dm] [Dm] [Dm]

[Verse 1]
[Dm]Here come old flat top, he come groovin' up slowly
He got joo-joo eyeball, he one holy roller
He got hair down to his knee
[A7]Got to be a joker, he just do what he please

[Verse 2]
[Dm]He wear no shoeshine, he got toe-jam football
He got monkey finger, he shoot Coca-Cola
He say, "I know you, you know me"
[A7]One thing I can tell you is you got to be free

[Chorus]
[Bm]Come together, [G]right [A]now, [Dm]over me

[Verse 3]
[Dm]He bag production, he got walrus gumboot
He got Ono sideboard, he one spinal cracker
He got feet down below his knee
[A7]Hold you in his armchair, you can feel his disease

[Chorus]
[Bm]Come together, [G]right [A]now, [Dm]over me

[Guitar Solo]
[Dm] [Dm] [Dm] [Dm]
[A7] [A7]

[Verse 4]
[Dm]He roller-coaster, he got early warning
He got muddy water, he one mojo filter
He say, "One and one and one is three"
[A7]Got to be good-looking 'cause he's so hard to see

[Chorus]
[Bm]Come together, [G]right [A]now, [Dm]over me

[Outro]
[Dm]Come together, yeah
Come together, yeah
Come together, yeah
Come together, yeah
[Dm]Come together, yeah
Come together, yeah [Dm]`;
  }

  // ==========================================
  // 3. The Beatles - Something
  // ==========================================
  if (t.includes('something') && (a.includes('beatles') || a.includes('harrison') || !a)) {
    return `[Intro]
[F] [Eb] [G] [C]

[Verse 1]
[C]Something in the way she [Cmaj7]moves
[C7]Attracts me like no other [F]lover
[D7]Something in the way she [G]woos me
[Am]I don't wanna leave her [Am/G#]now
[Am/G]You know I believe and [D9]how [F] [Eb] [G]

[Verse 2]
[C]Somewhere in her smile she [Cmaj7]knows
[C7]That I don't need no other [F]lover
[D7]Something in her style that [G]shows me
[Am]I don't wanna leave her [Am/G#]now
[Am/G]You know I believe and [D9]how [F] [Eb] [G]

[Bridge]
[A]You're askin' me will my [C#m]love grow [F#m] [A]
I don't [D]know, [G]I don't [A]know
[A]You stick around and it [C#m]may show [F#m] [A]
I don't [D]know, [G]I don't [C]know

[Guitar Solo]
[C] [Cmaj7] [C7] [F] [D7] [G]
[Am] [Am/G#] [Am/G] [D9] [F] [Eb] [G]

[Verse 3]
[C]Something in the way she [Cmaj7]knows
[C7]And all I have to do is [F]think of her
[D7]Something in the things she [G]shows me
[Am]I don't wanna leave her [Am/G#]now
[Am/G]You know I believe and [D9]how

[Outro]
[F] [Eb] [G] [A]
[F] [Eb] [G] [C]`;
  }

  // ==========================================
  // 4. The Beatles - In My Life
  // ==========================================
  if (t.includes('in my life')) {
    return `[Intro]
[A] [E] [A] [E]

[Verse 1]
There are [A]places I'll re[E]member
All my [F#m]life, [A7]though some have [D]changed [Dm]
Some for[A]ever, not for [E]better
Some have [F#m]gone, [A7]and some re[D]main [Dm]

[Chorus 1]
All these [F#m]places have their [D]moments
With [G]lovers and friends I [A]still can recall
Some are [F#m]dead and some are [B7]living
In [Dm]my life, I've [A]loved them all [E]

[Verse 2]
But of [A]all these friends and [E]lovers
There is [F#m]no one [A7]compares with [D]you [Dm]
And these [A]memories lose their [E]meaning
When I [F#m]think of love [A7]as something [D]new [Dm]

[Chorus 2]
Though I [F#m]know I'll never lose af[D]fection
For [G]people and things that [A]went before
I [F#m]know I'll often stop and think a[B7]bout them
In [Dm]my life, I'll [A]love you more

[Keyboard Solo]
[A] [E] [F#m] [A7] [D] [Dm]
[A] [E] [F#m] [A7] [D] [Dm]

[Chorus 3]
Though I [F#m]know I'll never lose af[D]fection
For [G]people and things that [A]went before
I [F#m]know I'll often stop and think a[B7]bout them
In [Dm]my life, I'll [A]love you more

[Outro]
In [Dm]my life, I'll love you [A]more
[E] [A]`;
  }

  // ==========================================
  // 5. The Beatles - Help!
  // ==========================================
  if (t === 'help' || t === 'help!' || t.includes('help!')) {
    return `[Intro]
[Bm]Help! I need somebody
[G]Help! Not just anybody
[E7]Help! You know I need someone
[A]Help!

[Verse 1]
When I was [A]younger, so much younger than [C#m]today
I never [F#m]needed anybody's [D]help in [G]any [A]way
But now these [A]days are gone, I'm not so self as[C#m]sured
Now I [F#m]find I've changed my mind and [D]opened [G]up the [A]doors

[Chorus]
[Bm]Help me if you can, I'm feeling down
And I [G]do appreciate you being 'round
[E7]Help me get my feet back on the ground
Won't you [A]please, please help me?

[Verse 2]
And now my [A]life has changed in oh so many [C#m]ways
My inde[F#m]pendence seems to vanish [D]in the [G]haze [A]
But every [A]now and then I feel so inse[C#m]cure
I know that [F#m]I just need you like I've [D]never [G]done be[A]fore

[Chorus]
[Bm]Help me if you can, I'm feeling down
And I [G]do appreciate you being 'round
[E7]Help me get my feet back on the ground
Won't you [A]please, please help me?

[Verse 3]
When I was [A]younger, so much younger than [C#m]today
I never [F#m]needed anybody's [D]help in [G]any [A]way
But now these [A]days are gone, I'm not so self as[C#m]sured
Now I [F#m]find I've changed my mind and [D]opened [G]up the [A]doors

[Chorus]
[Bm]Help me if you can, I'm feeling down
And I [G]do appreciate you being 'round
[E7]Help me get my feet back on the ground
Won't you [A]please, please help me?

[Outro]
Won't you [F#m]please, please help me?
Help [A]me, help me, [A6]ooh`;
  }

  // ==========================================
  // 6. The Beatles - Hey Jude
  // ==========================================
  if (t.includes('hey jude')) {
    return `[Intro]
[F] [C]

[Verse 1]
Hey [F]Jude, don't make it [C]bad
Take a [C7]sad song and make it [F]better
Re[Bb]member to let her into your [F]heart
Then you can [C]start to make it [F]better

[Verse 2]
Hey [F]Jude, don't be a[C]fraid
You were [C7]made to go out and [F]get her
The [Bb]minute you let her under your [F]skin
Then you be[C]gin to make it [F]better

[Bridge 1]
[F7]And anytime you feel the [Bb]pain, hey Jude, re[Gm7]frain
Don't carry the [C7]world upon your [F]shoulders
[F7]For well you know that it's a [Bb]fool who plays it [Gm7]cool
By making his [C7]world a little [F]colder
[F] [F7] [C7]Da da da da da, da da da da

[Verse 3]
Hey [F]Jude, don't let me [C]down
You have [C7]found her, now go and [F]get her
Re[Bb]member to let her into your [F]heart
Then you can [C]start to make it [F]better

[Bridge 2]
[F7]So let it out and let it [Bb]in, hey Jude, be[Gm7]gin
You're waiting for [C7]someone to per[F]form with
[F7]And don't you know that it's just [Bb]you, hey Jude, you'll [Gm7]do
The movement you [C7]need is on your [F]shoulder
[F] [F7] [C7]Da da da da da, da da da da

[Verse 4]
Hey [F]Jude, don't make it [C]bad
Take a [C7]sad song and make it [F]better
Re[Bb]member to let her under your [F]skin
Then you'll be[C]gin to make it [F]better, better, better, better, better, yeah!

[Outro]
[F]Na na na, [Eb]na na na na
[Bb]Na na na na, hey [F]Jude
[F]Na na na, [Eb]na na na na
[Bb]Na na na na, hey [F]Jude
[F]Na na na, [Eb]na na na na
[Bb]Na na na na, hey [F]Jude
[F]Na na na, [Eb]na na na na
[Bb]Na na na na, hey [F]Jude [F]`;
  }

  // ==========================================
  // 7. The Beatles - Yesterday
  // ==========================================
  if (t === 'yesterday' || t.includes('yesterday')) {
    return `[Intro]
[F] [F]

[Verse 1]
[F]Yesterday, [Em7]all my [A7]troubles seemed so [Dm]far away [Dm/C]
[Bb]Now it [C7]looks as though they're [F]here to stay [F/E]
Oh, [Dm]I be[G7]lieve in [Bb]yes[F]terday

[Verse 2]
[F]Suddenly, [Em7]I'm not [A7]half the man I [Dm]used to be [Dm/C]
[Bb]There's a [C7]shadow hanging [F]over me [F/E]
Oh, [Dm]yester[G7]day came [Bb]sud[F]denly

[Chorus 1]
[Em7]Why [A7]she [Dm]had [C]to [Bb]go, I don't [Gm6]know, she [C7]wouldn't [F]say
[Em7]I [A7]said [Dm]some[C]thing [Bb]wrong, now I [Gm6]long for [C7]yester[F]day

[Verse 3]
[F]Yesterday, [Em7]love was [A7]such an easy [Dm]game to play [Dm/C]
[Bb]Now I [C7]need a place to [F]hide away [F/E]
Oh, [Dm]I be[G7]lieve in [Bb]yes[F]terday

[Chorus 2]
[Em7]Why [A7]she [Dm]had [C]to [Bb]go, I don't [Gm6]know, she [C7]wouldn't [F]say
[Em7]I [A7]said [Dm]some[C]thing [Bb]wrong, now I [Gm6]long for [C7]yester[F]day

[Verse 4]
[F]Yesterday, [Em7]love was [A7]such an easy [Dm]game to play [Dm/C]
[Bb]Now I [C7]need a place to [F]hide away [F/E]
Oh, [Dm]I be[G7]lieve in [Bb]yes[F]terday

[Outro]
[Dm]Mm mm [G7]mm mm [Bb]mm [F]mm`;
  }

  // ==========================================
  // 8. The Beatles - Twist and Shout
  // ==========================================
  if (t.includes('twist and shout')) {
    return `[Intro]
[D] [G] [A] [A7]
[D] [G] [A] [A7]

[Verse 1]
Well, shake it up, [D]baby, now, ([G]shake it up, [A]baby)
Twist and [D]shout, ([G]twist and [A]shout)
C'mon, c'mon, c'mon, c'mon, [D]baby, now, ([G]come on, [A]baby)
Come on and work it on [D]out, ([G]work it on [A]out)

[Verse 2]
Well, work it on [D]out, honey, ([G]work it on [A]out)
You know you look so [D]good, ([G]look so [A]good)
You know you got me [D]goin' now, ([G]got me [A]goin')
Just like I knew you [D]would, ([G]like I knew you [A]would)

[Chorus]
Well, shake it up, [D]baby, now, ([G]shake it up, [A]baby)
Twist and [D]shout, ([G]twist and [A]shout)
C'mon, c'mon, c'mon, c'mon, [D]baby, now, ([G]come on, [A]baby)
Come on and work it on [D]out, ([G]work it on [A]out)

[Verse 3]
You know you twist, little [D]girl, ([G]twist, little [A]girl)
You know you twist so [D]fine, ([G]twist so [A]fine)
Come on and twist a little [D]closer now, ([G]twist a little [A]closer)
And let me know that you're [D]mine, ([G]let me know you're [A]mine)

[Guitar Solo]
[D] [G] [A] [A7]
[D] [G] [A] [A7]
[D] [G] [A] [A7]
[D] [G] [A] [A7]

[Bridge]
[A]Ah, [A7]ah, ah, ah, ah, yeah!

[Chorus]
Shake it up, [D]baby, now, ([G]shake it up, [A]baby)
Twist and [D]shout, ([G]twist and [A]shout)
C'mon, c'mon, c'mon, c'mon, [D]baby, now, ([G]come on, [A]baby)
Come on and work it on [D]out, ([G]work it on [A]out)

[Outro]
You know you twist, little [D]girl, ([G]twist, little [A]girl)
You know you twist so [D]fine, ([G]twist so [A]fine)
Come on and twist a little [D]closer now, ([G]twist a little [A]closer)
And let me know that you're [D]mine, ([G]let me know you're [A]mine)
Well, shake it, shake it, shake it, baby, now
Shake it, shake it, shake it, baby, now
Shake it, shake it, shake it, baby, now
[A]Ah, [A7]ah, ah, ah, [D] [G] [D]`;
  }

  // ==========================================
  // 9. The Beatles - All You Need Is Love
  // ==========================================
  if (t.includes('all you need is love')) {
    return `[Intro]
[G] [D/F#] [Em] [G] [D/F#] [Em]
[C] [D7] [G]

[Verse 1]
[G]Love, [D/F#]love, [Em]love
[G]Love, [D/F#]love, [Em]love
[D7]Love, [G]love, [D7]love

[Verse 2]
[G]There's nothing you can [D/F#]do that can't be [Em]done
[G]Nothing you can [D/F#]sing that can't be [Em]sung
[Am]Nothing you can say, but you can [D7]learn how to play the game
It's [D7]easy

[Verse 3]
[G]There's nothing you can [D/F#]make that can't be [Em]made
[G]No one you can [D/F#]save that can't be [Em]saved
[Am]Nothing you can do, but you can [D7]learn how to be you in time
It's [D7]easy

[Chorus]
[G]All you [A7]need is love, [D7]
[G]All you [A7]need is love, [D7]
[G]All you [B7]need is love, [Em]love,
[C]Love is [D7]all you [G]need

[Guitar Solo]
[G] [D/F#] [Em]
[G] [D/F#] [Em]
[Am] [D7]

[Chorus]
[G]All you [A7]need is love, [D7]
[G]All you [A7]need is love, [D7]
[G]All you [B7]need is love, [Em]love,
[C]Love is [D7]all you [G]need

[Verse 4]
[G]There's nothing you can [D/F#]know that isn't [Em]known
[G]Nothing you can [D/F#]see that isn't [Em]shown
[Am]There's nowhere you can be that isn't [D7]where you're meant to be
It's [D7]easy

[Chorus]
[G]All you [A7]need is love, [D7]
[G]All you [A7]need is love, [D7]
[G]All you [B7]need is love, [Em]love,
[C]Love is [D7]all you [G]need

[Outro]
[G]All you [A7]need is love, [D7]
[G]All you [A7]need is love, [D7]
[G]All you [B7]need is love, [Em]love,
[C]Love is [D7]all you [G]need
Love is all you need, love is all you need, she loves you yeah yeah yeah
[G] [D7] [G]`;
  }

  // ==========================================
  // 10. The Beatles - A Hard Day's Night
  // ==========================================
  if (t.includes("hard day's night") || t.includes('hard days night')) {
    return `[Intro]
[G7sus4]

[Verse 1]
It's been a [G]hard [C]day's [G]night, and I've been [F]working like a [G]dog
It's been a [G]hard [C]day's [G]night, I should be [F]sleeping like a [G]log
But when I [C]get home to you, I find the [D]things that you do
Will make me [G]feel [C]all [G]right

[Verse 2]
You know I [G]work [C]all [G]day to get you [F]money to buy you [G]things
And it's [G]worth it just to [C]hear you [G]say you're gonna [F]give me every[G]thing
So why on [C]earth should I moan, 'cause when I [D]get you alone
You know I [G]feel [C]o[G]kay

[Bridge]
When I'm [Bm]home, [Em]everything seems to be [Bm]right
When I'm [G]home, [Em]feeling you holding me [C]tight, [D]tight, yeah

[Verse 3]
It's been a [G]hard [C]day's [G]night, and I've been [F]working like a [G]dog
It's been a [G]hard [C]day's [G]night, I should be [F]sleeping like a [G]log
But when I [C]get home to you, I find the [D]things that you do
Will make me [G]feel [C]all [G]right

[Guitar Solo]
[G] [C] [G] [F] [G]
[G] [C] [G] [F] [G]
[C] [D] [G] [C] [G]

[Bridge]
When I'm [Bm]home, [Em]everything seems to be [Bm]right
When I'm [G]home, [Em]feeling you holding me [C]tight, [D]tight, yeah

[Verse 4]
It's been a [G]hard [C]day's [G]night, and I've been [F]working like a [G]dog
It's been a [G]hard [C]day's [G]night, I should be [F]sleeping like a [G]log
But when I [C]get home to you, I find the [D]things that you do
Will make me [G]feel [C]all [G]right

[Outro]
You know I [G]feel [C]all [G]right
You know I [G]feel [C]all [G]right [Fadd9] [G]`;
  }

  return null;
}
