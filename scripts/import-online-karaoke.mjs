import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { offlineUniversalLibrary } from '../src/data/catalog/OfflineUniversalLibraryEngine.js';
import { MEGA_CATALOG } from '../src/data/CatalogDataset.js';
const normalize=value=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const artistKey=value=>normalize(String(value||'').replace(/^the\s+/i,''));
const cachedOnly=process.argv.includes('--cached-only');
const metadataOnly=process.argv.includes('--metadata-cache-only');
const identity=(title,artist)=>artistKey(artist)+'::'+normalize(title);
const root=new URL('../',import.meta.url);
const cache=new URL('reports/online-karaoke/',root);await fs.mkdir(cache,{recursive:true});
const songs=new Map([...offlineUniversalLibrary.searchIndex.values(),...MEGA_CATALOG].map(song=>[identity(song.title,song.artist),{title:song.title,artist:song.artist}]));
const artists=[...new Set([...songs.values()].map(song=>song.artist))].sort();
const failures=[];const candidates=new Map();let cursor=0,checked=0;
function parse(html){
 const rows=[];let title='',artist='',sourceUrl='';
 for(const [,kind,body] of html.matchAll(/<tr class="(group|details)[^"]*">([\s\S]*?)<\/tr>/g)){
  if(kind==='group'){
   const href=body.match(/href="(\/Song\/[^"]+)"/)?.[1];
   if(!href){title=artist='';continue;}const parts=href.split('/');
   try{title=decodeURIComponent(parts[2]);artist=decodeURIComponent(parts[3]);sourceUrl='https://karaokenerds.com'+href;}catch{title=artist='';}
  }else if(title){
   for(const [,item] of body.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)){
    const videoId=item.match(/youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/)?.[1];
    const brand=item.match(/<a class="pr-1"[\s\S]*?>([\s\S]*?)<\/a>/)?.[1].replace(/<[^>]+>/g,'').trim();
    if(videoId)rows.push({title,artist,videoId,brand:brand||'',sourceUrl});
   }
  }
 }
 return rows;
}
await Promise.all(Array.from({length:2},async()=>{
 while(cursor<artists.length){
  const artist=artists[cursor++],file=new URL(createHash('sha256').update(artist).digest('hex')+'.json',cache);let rows;
  try{rows=JSON.parse(await fs.readFile(file,'utf8'));}catch{
   if(cachedOnly){failures.push({artist,status:'not-cached'});continue;}
   const response=await fetch('https://karaokenerds.com/Search?'+new URLSearchParams({artist,webFilter:'OnlyWeb'}),{signal:AbortSignal.timeout(20000)});
   if(response.status===429||response.status===403)throw Error('Provider limited access: '+response.status);
   if(!response.ok){failures.push({artist,status:response.status});continue;}
   rows=parse(await response.text());await fs.writeFile(file,JSON.stringify(rows));
   await new Promise(resolve=>setTimeout(resolve,750));
  }
  for(const row of rows){const key=identity(row.title,row.artist);if(songs.has(key)){if(!candidates.has(key))candidates.set(key,[]);if(!candidates.get(key).some(candidate=>candidate.videoId===row.videoId))candidates.get(key).push(row);}}
  if(++checked%25===0)console.log(JSON.stringify({artists:checked,total:artists.length,songsWithCandidates:candidates.size}));
 }
}));
const metadataFile=new URL('youtube-metadata.json',cache);let metadata={};try{metadata=JSON.parse(await fs.readFile(metadataFile,'utf8'));}catch{}
const score=brand=>['Sing King','Zoom','Stingray','Mr. Entertainer','Sunfly','KaraFun','Karaoke Version'].findIndex(name=>brand.startsWith(name));
const pairs=[...candidates],matches=[];cursor=0;let reviewed=0;
await Promise.all(Array.from({length:2},async()=>{
 while(cursor<pairs.length){
  const [key,rows]=pairs[cursor++];
  rows.sort((a,b)=>(score(a.brand)<0?99:score(a.brand))-(score(b.brand)<0?99:score(b.brand)));
  for(const row of rows){
   let data=metadata[row.videoId];
   if(!data){
    if(metadataOnly)continue;
    try{const response=await fetch('https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v='+row.videoId,{signal:AbortSignal.timeout(10000)});if(response.status===429||response.status===403)throw Error('YouTube limited metadata access');data=response.ok?await response.json():{status:response.status};metadata[row.videoId]={title:data.title,author_name:data.author_name,status:response.status};}catch(error){if(/limited metadata/.test(error.message))throw error;failures.push({videoId:row.videoId,error:error.message});continue;}
    await new Promise(resolve=>setTimeout(resolve,150));
   }
   const title=normalize(data.title),artist=artistKey(row.artist),songTitle=normalize(row.title);
   if(!title.includes(songTitle)||!title.includes(artist)||!/karaoke|instrumental/i.test(data.title||'')||/preview|sample|demo|excerpt/i.test(data.title||''))continue;
   const song=songs.get(key);matches.push({...song,videoId:row.videoId,brand:row.brand,sourceUrl:row.sourceUrl,videoTitle:data.title,channel:data.author_name});break;
  }
  if(++reviewed%100===0){await fs.writeFile(metadataFile,JSON.stringify(metadata));console.log(JSON.stringify({metadataReviewed:reviewed,total:pairs.length,matches:matches.length}));}
 }
}));
await fs.writeFile(metadataFile,JSON.stringify(metadata));
const result={schemaVersion:1,checkedAt:new Date().toISOString(),source:'https://karaokenerds.com',catalogIdentities:songs.size,artists:artists.length,artistsInspected:checked,coverageLimited:cachedOnly||metadataOnly,listedSongs:pairs.map(([key,rows])=>({...songs.get(key),sourceUrl:rows[0].sourceUrl})),matches:matches.sort((a,b)=>identity(a.title,a.artist).localeCompare(identity(b.title,b.artist)))};
await fs.mkdir(new URL('assets/data/',root),{recursive:true});await fs.writeFile(new URL('assets/data/online-karaoke.json',root),JSON.stringify(result,null,2)+'\n');
await fs.writeFile(new URL('failures.json',cache),JSON.stringify(failures,null,2));
console.log(JSON.stringify({artists:artists.length,identities:songs.size,matches:matches.length,failures:failures.length}));
