import { parseVocalReference } from '../audio/VocalReference.js';
import { KaraokeBackingStore } from './KaraokeBackingStore.js';
const root = new URL('../../assets/practice/', import.meta.url);
let pending;
const safeFile = value => typeof value === 'string' && /^[a-z0-9-]+\.(txt|json|mp3|ogg)$/.test(value);
export function getReadyKaraokes() {
 return pending ||= fetch(new URL('index.json',root)).then(async response => {
  if(!response.ok) throw Error('No se pudo abrir el catálogo de canto.');
  const data=await response.json();
  if(data.schemaVersion!==1 || !Array.isArray(data.packs) || data.packs.length>1000) throw Error('Catálogo de canto inválido.');
  const ids=new Set();
  for(const pack of data.packs) {
   if(!/^[a-z0-9-]+$/.test(pack.id) || ids.has(pack.id) || !safeFile(pack.chart) || !safeFile(pack.files?.original) || (pack.files.instrumental && (!safeFile(pack.files.instrumental) || !safeFile(pack.instrumentalChart)))) throw Error('Paquete de canto inválido.');
   ids.add(pack.id);
  }
  return data.packs;
 }).catch(error=>{pending=null;throw error;});
}
export async function loadReadyKaraoke({instrumental=true,packId='shearer-stay-with-me'}={}) {
 const pack=(await getReadyKaraokes()).find(pack=>pack.id===packId);
 if(!pack) throw Error('Canción preparada desconocida.');
 const useInstrumental=Boolean(instrumental && pack.files.instrumental);
 const base=new URL(pack.id+'/',root);
 const response=await fetch(new URL(useInstrumental ? pack.instrumentalChart : pack.chart,base));
 if(!response.ok) throw Error('No se pudo abrir la melodía de esta grabación.');
 const reference=parseVocalReference(await response.text(),{normalizeLegacyOctave:true});
 const song={
  id:'practice-'+pack.id,versionId:'cc-package-v3-'+(useInstrumental?'instrumental':'original'),
  title:pack.title,artist:pack.artist,lyricsChords:reference.lyricCues.map(cue=>cue.text).join('\n'),
  contentSource:'licensed_practice_pack',practicePackId:pack.id,practiceHasInstrumental:Boolean(pack.files.instrumental),
  vocalMelody:reference.vocalMelody,lyricCues:reference.lyricCues,
  referenceInfo:{...reference.referenceInfo,sourceType:'licensed_practice_pack',sourceUrl:pack.sourceUrl,license:pack.license,verification:'package_supplied'},
  _practiceRecovery:{performanceMode:'sing',karaokePositionMs:0}
 };
 const fileName=pack.files[useInstrumental?'instrumental':'original'];
 const audioResponse=await fetch(new URL(fileName,base));
 if(!audioResponse.ok) throw Error('No se pudo abrir la grabación. Conéctate para cargarla por primera vez.');
 const blob=await audioResponse.blob();
 if(blob.size<10000 || blob.size>100*1024*1024) throw Error('La grabación está vacía o supera 100 MB.');
 const store=new KaraokeBackingStore();
 try {
  await store.put(song,{blob,name:pack.artist+' · '+pack.title+' · '+(useInstrumental?'instrumental':'original con voz'),vocalMelody:song.vocalMelody,lyricCues:song.lyricCues,referenceInfo:song.referenceInfo,volume:.65,offsetMs:0});
 } finally { store.close(); }
 return song;
}
