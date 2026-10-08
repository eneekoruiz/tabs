import fs from 'node:fs/promises';
import path from 'node:path';
import { parseVocalReference } from '../src/audio/VocalReference.js';
import { offlineUniversalLibrary } from '../src/data/catalog/OfflineUniversalLibraryEngine.js';
const root=path.resolve(import.meta.dirname,'..');
const repo='razzertronic/usdx-songs', revision='e278c5851844b88734eaab0dcb34a3218a77e5f1';
const normal=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const key=(title,artist)=>normal(title)+'|'+normal(artist);
const catalog=new Map([...offlineUniversalLibrary.searchIndex.values()].map(r=>[key(r.title,r.artist),r]));
const reportDir=path.join(root,'reports/public-references');await fs.mkdir(reportDir,{recursive:true});
const response=await fetch('https://api.github.com/repos/'+repo+'/git/trees/'+revision+'?recursive=1',{headers:{'User-Agent':'TabsAndChords'}});if(!response.ok)throw Error('GitHub tree '+response.status);
const tree=await response.json();if(tree.truncated)throw Error('Incomplete tree');
const files=tree.tree.filter(r=>r.type==='blob'&&r.size<=1024*1024&&/\.txt$/i.test(r.path));
const rows=[], references=[];let cursor=0;
await Promise.all(Array.from({length:6},async()=>{while(cursor<files.length){const row=files[cursor++], url='https://raw.githubusercontent.com/'+repo+'/'+revision+'/'+row.path.split('/').map(encodeURIComponent).join('/');try{
 const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('HTTP '+response.status);const bytes=new Uint8Array(await response.arrayBuffer());let text=new TextDecoder().decode(bytes);if(text.includes('�'))text=new TextDecoder('windows-1252').decode(bytes);
 const parsed=parseVocalReference(text,{normalizeLegacyOctave:true});if(!parsed.title||!parsed.artist)throw Error('Missing identity');
 // Only pitch/time data are bundled. The original repository text remains upstream.
 const notes=parsed.vocalMelody.map(n=>({startTime:n.startTime,duration:n.duration,midi:n.midi,isInterlude:n.isInterlude}));
 const match=catalog.get(key(parsed.title,parsed.artist));const item={id:row.sha,title:parsed.title,artist:parsed.artist,sourceUrl:'https://github.com/'+repo+'/blob/'+revision+'/'+row.path.split('/').map(encodeURIComponent).join('/'),repository:repo,revision,blobSha:row.sha,sourceType:'community_transcription',octaveShiftSemitones:parsed.referenceInfo.octaveShiftSemitones,verification:'unverified_recording',units:'milliseconds',notes};
 references.push(item);rows.push({path:row.path,title:parsed.title,artist:parsed.artist,notes:notes.length,octaveShiftSemitones:parsed.referenceInfo.octaveShiftSemitones,catalogMatch:match||null,status:'parsed'});
 }catch(error){rows.push({path:row.path,status:'rejected',error:error.message});}
 if(rows.length%100===0)console.log('Read '+rows.length+'/'+files.length);
}}));
references.sort((a,b)=>a.artist.localeCompare(b.artist)||a.title.localeCompare(b.title));rows.sort((a,b)=>a.path.localeCompare(b.path));
const output=path.join(root,'assets/data/vocal-references');await fs.mkdir(output,{recursive:true});
// Each chart loads lazily; the small index is safe for first-page discovery.
for(const ref of references)await fs.writeFile(path.join(output,ref.id+'.json'),JSON.stringify(ref));
const index=references.map(({notes,...ref})=>({...ref,noteCount:notes.length,durationMs:Math.max(...notes.map(n=>n.startTime+n.duration)),path:'assets/data/vocal-references/'+ref.id+'.json'}));
await fs.writeFile(path.join(output,'index.json'),JSON.stringify({schemaVersion:1,repository:repo,revision,license:'Unlicense (repository declaration)',references:index}));
const licenseResponse=await fetch('https://raw.githubusercontent.com/'+repo+'/'+revision+'/LICENSE');if(!licenseResponse.ok)throw Error('Missing upstream license');await fs.writeFile(path.join(output,'LICENSE.repository.txt'),await licenseResponse.text());
await fs.writeFile(path.join(reportDir,'inventory.json'),JSON.stringify({repository:repo,revision,totalFiles:files.length,accepted:references.length,rejected:rows.filter(r=>r.status==='rejected').length,catalogMatches:rows.filter(r=>r.catalogMatch).length,rows},null,2));
console.log(JSON.stringify({total:files.length,accepted:references.length,rejected:files.length-references.length,catalogMatches:rows.filter(r=>r.catalogMatch).length}));
