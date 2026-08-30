const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com'
]);

function normalizeKey(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export const KNOWN_SONG_YOUTUBE_VIDEOS = {
  // Queen
  'killerqueen': '2ZBtPf7FOoM',
  'queenkillerqueen': '2ZBtPf7FOoM',
  'bohemianrhapsody': 'fJ9rUzIMcZQ',
  'queenbohemianrhapsody': 'fJ9rUzIMcZQ',
  'dontstopmenow': 'HgzGwKwLmgM',
  'queendontstopmenow': 'HgzGwKwLmgM',
  'wewillrockyou': '-tJYN-eG1zk',
  'queenwewillrockyou': '-tJYN-eG1zk',
  'wearethechampions': '04854XqcfCY',
  'queenwearethechampions': '04854XqcfCY',
  'somebodytolove': 'kijpcUv-b8M',
  'queensomebodytolove': 'kijpcUv-b8M',
  'iwanttobreakfree': 'f4Mc-NY53H8',
  'queeniwanttobreakfree': 'f4Mc-NY53H8',
  'underpressure': 'a01QQZyl-_I',
  'queenunderpressure': 'a01QQZyl-_I',
  'theshowmustgoon': 't99KH0TR-J4',
  'queentheshowmustgoon': 't99KH0TR-J4',
  'anotheronebitesthedust': 'rY0WxgSXdEE',
  'queenanotheronebitesthedust': 'rY0WxgSXdEE',
  'radiogaga': 'azdwsXLmrHE',
  'queenradiogaga': 'azdwsXLmrHE',

  // The Beatles
  'blackbird': 'Man4Xw8Xypo',
  'thebeatlesblackbird': 'Man4Xw8Xypo',
  'letitbe': 'QDYfEBY9NM4',
  'thebeatlesletitbe': 'QDYfEBY9NM4',
  'yesterday': 'NrgmdOz227I',
  'thebeatlesyesterday': 'NrgmdOz227I',
  'heyjude': 'A_MjCqQoLLA',
  'thebeatlesheyjude': 'A_MjCqQoLLA',
  'herecomesthesun': 'KQetemT1sWc',
  'thebeatlesherecomesthesun': 'KQetemT1sWc',
  'cometogether': '45cYwDMibGo',
  'thebeatlescometogether': '45cYwDMibGo',
  'something': 'UelDrZ1aFeY',
  'thebeatlessomething': 'UelDrZ1aFeY',
  'inmylife': 'YBcdt6DsLQA',
  'thebeatlesinmylife': 'YBcdt6DsLQA',
  'twistandshout': '2RicaUqd9Hg',
  'thebeatlestwistandshout': '2RicaUqd9Hg',
  'help': '2Q_ZzBGPdqE',
  'thebeatleshelp': '2Q_ZzBGPdqE',
  'yellowsubmarine': 'm2uTFF_3MaA',
  'thebeatlesyellowsubmarine': 'm2uTFF_3MaA',
  'allyouneedislove': '_7xMfIp-irg',
  'thebeatlesallyouneedislove': '_7xMfIp-irg',

  // Imagine Dragons
  'believer': '7wtfhZwyrcc',
  'imaginedragonsbeliever': '7wtfhZwyrcc',
  'radioactive': 'ktvTqvkSCRU',
  'imaginedragonsradioactive': 'ktvTqvkSCRU',
  'demons': 'mWRsgZuwf_8',
  'imaginedragonsdemons': 'mWRsgZuwf_8',
  'thunder': 'fKopy74weus',
  'imaginedragonsthunder': 'fKopy74weus',
  'bones': 'TO-_3tck2tg',
  'imaginedragonsbones': 'TO-_3tck2tg',
  'enemy': 'D9G1VOjN_84',
  'imaginedragonsenemy': 'D9G1VOjN_84',
  'natural': '0I647GU3Jsc',
  'imaginedragonsnatural': '0I647GU3Jsc',
  'whateverittakes': 'gOsM-DYAEhY',
  'imaginedragonswhateverittakes': 'gOsM-DYAEhY',
  'badliar': 'I-QfPUz1es8',
  'imaginedragonsbadliar': 'I-QfPUz1es8',
  'itstime': 'sENM2wA_NGo',
  'imaginedragonsitstime': 'sENM2wA_NGo',
  'sharks': 'Te3_VlimRw4',
  'imagineddragonssharks': 'Te3_VlimRw4',
  'walkingthewire': '1nv9br7Sm7E',
  'imagineddragonswalkingthewire': '1nv9br7Sm7E',

  // Olivia Rodrigo
  'driverslicense': 'ZmDBbnmKpqQ',
  'oliviarodrigodriverslicense': 'ZmDBbnmKpqQ',
  'vampire': 'RlPNh_wAKEc',
  'oliviarodrigovampire': 'RlPNh_wAKEc',
  'good4u': 'gNi_6U5Pm_o',
  'oliviarodrigogood4u': 'gNi_6U5Pm_o',
  'dejavu': 'cii6ruuycKA',
  'oliviarodrigodejavu': 'cii6ruuycKA',
  'traitor': 'CRrf3h9vhp8',
  'oliviarodrigotraitor': 'CRrf3h9vhp8',
  'badidearight': 'Dj9q84UPp60',
  'oliviarodrigobadidearight': 'Dj9q84UPp60',
  'gethimback': 'ZsJ-BHpHXi8',
  'oliviarodrigogethimback': 'ZsJ-BHpHXi8',
  'happier': 'Z-9gQjUZMm0',
  'oliviarodrigohappier': 'Z-9gQjUZMm0',

  // Ariana Grande
  '7rings': 'QYh6mYIJG2Y',
  'arianagrande7rings': 'QYh6mYIJG2Y',
  'thankunext': 'gl1aHhXnN1k',
  'arianagrandethankunext': 'gl1aHhXnN1k',
  'positions': 'tcYodQoapMg',
  'arianagrandepositions': 'tcYodQoapMg',
  'notearslefttocry': 'ffxKSjUwKdU',
  'arianagrandenotearslefttocry': 'ffxKSjUwKdU',
  'sidetoside': 'SXiSVQZLje8',
  'arianagrandesidetoside': 'SXiSVQZLje8',
  'wecantbefriends': 'KNtJGQkC-WI',
  'wecantbefriendswaitforyourlove': 'KNtJGQkC-WI',
  'arianagrandewecantbefriends': 'KNtJGQkC-WI',
  'intoyou': '1ekZEVeXwek',
  'arianagrandeintoyou': '1ekZEVeXwek',
  'dangerouswoman': '9WbCfHutDSE',
  'arianagrandedangerouswoman': '9WbCfHutDSE',
  'godisawoman': 'kHLHSlExFis',
  'arianagrandegodisawoman': 'kHLHSlExFis',
  'onelasttime': 'BPgEgaPk62M',
  'arianagrandeonelasttime': 'BPgEgaPk62M',
  'breakfree': 'L8eRzOYhLuw',
  'arianagrandebreakfree': 'L8eRzOYhLuw',
  'santatellme': 'nlR0MkrRklg',
  'arianagrandesantatellme': 'nlR0MkrRklg',

  // The Weeknd
  'blindinglights': '4NRXx6U8ABQ',
  'theweekndblindinglights': '4NRXx6U8ABQ',
  'starboy': '34Na4j8AVgA',
  'theweekndstarboy': '34Na4j8AVgA',
  'saveyourtears': 'XXYlFuWEuKI',
  'theweekndsaveyourtears': 'XXYlFuWEuKI',
  'thehills': 'yzTuBuRdAyA',
  'theweekndthehills': 'yzTuBuRdAyA',
  'dieforyou': 'u9n7Cw-4_PE',
  'theweeknddieforyou': 'u9n7Cw-4_PE',
  'cantfeelmyface': 'KEI4qSrkPAs',
  'theweekndcantfeelmyface': 'KEI4qSrkPAs',

  // Oasis
  'wonderwall': '6hzrDeceEKc',
  'oasiswonderwall': '6hzrDeceEKc',
  'dontlookbackinanger': 'r8OipmKFDeM',
  'oasisdontlookbackinanger': 'r8OipmKFDeM',
  'champagnesupernova': 'tI-5uv4wryI',
  'oasischampagnesupernova': 'tI-5uv4wryI',
  'standbyme': 'maTP315XZCQ',
  'oasisstandbyme': 'maTP315XZCQ',

  // Katy Perry
  'darkhorse': '0KSOMA3QBU0',
  'katyperrydarkhorse': '0KSOMA3QBU0',
  'roar': 'CevxZvSJLk8',
  'katyperryroar': 'CevxZvSJLk8',
  'firework': 'QGJuMBdaqIw',
  'katyperryfirework': 'QGJuMBdaqIw',

  // Ed Sheeran
  'perfect': '2Vv-BfVoq4g',
  'edsheeranperfect': '2Vv-BfVoq4g',
  'shapeofyou': 'JGwWNGJdvx8',
  'edsheeranshapeofyou': 'JGwWNGJdvx8',
  'thinkingoutloud': 'lp-EO5I60KA',
  'edsheeranthinkingoutloud': 'lp-EO5I60KA',
  'photograph': 'nSDgHBxUbVQ',
  'edsheeranphotograph': 'nSDgHBxUbVQ',
  'badhabits': 'orJSJGHjBLI',
  'edsheeranbadhabits': 'orJSJGHjBLI',
  'shivers': 'Il0S8BoucSA',
  'edsheeranshivers': 'Il0S8BoucSA',

  // Coldplay
  'yellow': 'yKNxeF4KMsY',
  'coldplayyellow': 'yKNxeF4KMsY',
  'vivalavida': 'dvgZkm1xWPE',
  'coldplayvivalavida': 'dvgZkm1xWPE',
  'thescientist': 'RB-RcX5DS5A',
  'coldplaythescientist': 'RB-RcX5DS5A',
  'fixyou': 'k4V3Ui687Gw',
  'coldplayfixyou': 'k4V3Ui687Gw',
  'askyfullofstars': 'VPRjCeoBqrI',
  'coldplayaskyfullofstars': 'VPRjCeoBqrI',

  // Nirvana & Rock Legends
  'smellsliketeenspirit': 'hTWKbfoikeg',
  'nirvanasmellsliketeenspirit': 'hTWKbfoikeg',
  'comeasyouare': 'vabnZ9-ex7o',
  'nirvanacomeasyouare': 'vabnZ9-ex7o',
  'heartshapedbox': 'n6P0SitRwy8',
  'lithium': 'pkcJEvMcnEg',
  'nothingelsematters': 'tAGnKpE4NCI',
  'metallicanothingelsematters': 'tAGnKpE4NCI',
  'entersandman': 'CD-E-LDc384',
  'metallicaentersandman': 'CD-E-LDc384',
  'masterofpuppets': 'E0ozmU9cJDg',
  'theunforgiven': 'Ckom3gf57Yw',
  'hotelcalifornia': '09839DpTctU',
  'eagleshotelcalifornia': '09839DpTctU',
  'creep': 'XFkzRNyygfk',
  'radioheadcreep': 'XFkzRNyygfk',
  'karmapolice': '1uYWYWPc9HU',
  'nosurprises': 'u5CVsCnxyXg',
  'backinblack': 'pAgnJDJN4VA',
  'acdcbackinblack': 'pAgnJDJN4VA',
  'highwaytohell': 'gEPmA3USJdI',
  'thunderstruck': 'v2AC41dglnM',
  'zombie': '6Ejga4kJUts',
  'thecranberrieszombie': '6Ejga4kJUts',
  'wishyouwerehere': 'hjpF8ukSrvk',
  'pinkfloydwishyouwerehere': 'hjpF8ukSrvk',
  'dustinthewind': 'tH2w6Oxx0kQ',
  'kansasdustinthewind': 'tH2w6Oxx0kQ',
  'tearsinheaven': 'JxPj3GAYYZ0',
  'ericclaptontearsinheaven': 'JxPj3GAYYZ0',

  // Taylor Swift & Billie Eilish
  'cruelsummer': 'ic8j13piAhQ',
  'taylorswiftcruelsummer': 'ic8j13piAhQ',
  'antihero': 'b1kbLwvqugk',
  'taylorswiftantihero': 'b1kbLwvqugk',
  'blankspace': 'e-ORhEE9VVg',
  'shakeitoff': 'nfWlot6h_JM',
  'lovestory': '8xg3vE8Ie_E',
  'alltoowell': 'tollGa3S0o8',
  'badguy': 'DyDfgMOUjCI',
  'billieeilishbadguy': 'DyDfgMOUjCI',
  'oceaneyes': 'viimfQi_pUw',
  'whenthepartysover': 'pbMwTqkKSps',
  'everythingiwanted': 'EgBJmlPo8Xw',
  'happierthanever': '5GJWxDKyk3A',
  'birdsofafeather': 'd5gf9dXbPi0',
  'whatwasimadefor': 'cW8VLC9nnTo',

  // Spanish / Latin Classics
  'soldaditomarinero': 'Gq-3y1f5s0Y',
  'fitofitipaldissoldaditomarinero': 'Gq-3y1f5s0Y',
  'laflaca': 'r2g0p13Xl3Y',
  'jarabedepalolaflaca': 'r2g0p13Xl3Y',
  'clavadoenunbar': 'g_qHwgFqP9U',
  'manaclavadoenunbar': 'g_qHwgFqP9U',
  'demusicaligera': 'T_FkEw27XJ0',
  'sodastereodemusicaligera': 'T_FkEw27XJ0',
  'dejame': '8d9sN_dK4mI',
  'lossecretosdejame': '8d9sN_dK4mI',
  'standby': 'jS2E6rGqP-Q',
  'extremodurostandby': 'jS2E6rGqP-Q',
  'antologia': 'xL1Fk4_yP9A',
  'shakiraantologia': 'xL1Fk4_yP9A',
  'entredostierras': '1U_f0l-1Z3A',
  'heroesdelsilencioentredostierras': '1U_f0l-1Z3A',
  'corazonpartio': '1P9k-J_7VvQ',
  'alejandrosanzcorazonpartio': '1P9k-J_7VvQ',
  'flaca': '1e9W-tKx_2w',
  'andrescalamaroflaca': '1e9W-tKx_2w',

  // Harry Styles, Bruno Mars, Dua Lipa
  'asitwas': 'H5v3kku4y6Q',
  'harrystylesasitwas': 'H5v3kku4y6Q',
  'watermelonsugar': 'E07s5ZYygMg',
  'signofthetimes': 'qN4ooNx77u0',
  'wheniwasyourman': 'ekzHIWGv8b0',
  'brunomarswheniwasyourman': 'ekzHIWGv8b0',
  'justthewayyouare': 'LjhCEhWiKXk',
  'lockedoutofheaven': 'e-fA-gBCkj0',
  'levitating': 'TUVcZfQe-Kw',
  'dualipalevitating': 'TUVcZfQe-Kw',
  'dontstartnow': 'oygrmJFKYZY',
  'dancethenight': 'OiC1rgCPmUQ',
  'riptide': 'uJ_1HMAGb4k',
  'vancejoyriptide': 'uJ_1HMAGb4k',
  'hallelujah': 'ttEMYvpoHA8',
  'leonardcohenhallelujah': 'ttEMYvpoHA8',
  'shallow': 'bo_efYhAK2A',
  'ladygagashallow': 'bo_efYhAK2A'
};

export function findKnownYouTubeVideoId(title, artist) {
  const normTitle = normalizeKey(title);
  const normArtist = normalizeKey(artist);
  if (!normTitle) return '';

  return KNOWN_SONG_YOUTUBE_VIDEOS[normArtist + normTitle]
    || KNOWN_SONG_YOUTUBE_VIDEOS[normTitle + normArtist]
    || KNOWN_SONG_YOUTUBE_VIDEOS[normTitle]
    || '';
}

export function extractYouTubeVideoId(value) {
  const candidate = String(value || '').trim();
  if (VIDEO_ID_PATTERN.test(candidate)) return candidate;
  try {
    const url = new URL(candidate);
    const host = url.hostname.toLocaleLowerCase();
    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0] || '';
      return VIDEO_ID_PATTERN.test(id) ? id : '';
    }
    if (!YOUTUBE_HOSTS.has(host)) return '';
    const queryId = url.searchParams.get('v') || '';
    if (VIDEO_ID_PATTERN.test(queryId)) return queryId;
    const segments = url.pathname.split('/').filter(Boolean);
    const markerIndex = segments.findIndex((segment) => ['embed', 'shorts', 'live'].includes(segment));
    const pathId = markerIndex >= 0 ? (segments[markerIndex + 1] || '') : '';
    return VIDEO_ID_PATTERN.test(pathId) ? pathId : '';
  } catch {
    return '';
  }
}

function songStorageKey(song) {
  const identity = [
    song?.id || '', song?.title || '', song?.artist || '',
    song?.versionId || song?.selectedVersionId || song?.versionName || ''
  ].map((part) => String(part).trim().toLocaleLowerCase()).join('::');
  return `app_youtube_video:${encodeURIComponent(identity)}`;
}

export function getSongYouTubeVideoId(song, storage = globalThis.localStorage) {
  const explicit = [song?.youtubeVideoId, song?.videoId, song?.youtubeUrl, song?.youtube_url,
    song?.videoUrl, song?.originalVideoUrl].map(extractYouTubeVideoId).find(Boolean);
  if (explicit) return explicit;
  try {
    const fromStorage = extractYouTubeVideoId(storage?.getItem(songStorageKey(song)) || '');
    if (fromStorage) return fromStorage;
  } catch {
    // Fallthrough to dictionary lookup
  }
  return findKnownYouTubeVideoId(song?.title, song?.artist);
}

export function saveSongYouTubeVideoId(song, value, storage = globalThis.localStorage) {
  const videoId = extractYouTubeVideoId(value);
  if (!videoId) return '';
  try {
    storage?.setItem(songStorageKey(song), videoId);
  } catch {
    // Playback still works for the current render when storage is unavailable.
  }
  return videoId;
}

export function buildYouTubeSearchUrl(song) {
  const query = [song?.artist, song?.title, 'official audio'].filter(Boolean).join(' ');
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

