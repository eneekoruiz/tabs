import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../assets/practice/',import.meta.url));
const manifest=JSON.parse(await fs.readFile(path.join(root,'sources.json'),'utf8'));
const gitBlob=data=>createHash('sha1').update('blob '+data.length+'\0').update(data).digest('hex');
let downloaded=0,verified=0,cursor=0;
await Promise.all(Array.from({length:3},async()=>{
 while(cursor<manifest.files.length){
  const file=manifest.files[cursor++];
  if(!/^[a-z0-9-]+\/[a-z0-9.-]+$/.test(file.path)||!file.url.startsWith('https://raw.githubusercontent.com/UltraStar-Deluxe/songs/'+manifest.revision+'/'))throw Error('Invalid pinned source');
  const target=path.join(root,file.path);
  let data;try{data=await fs.readFile(target);}catch{}
  if(data?.length===file.bytes&&gitBlob(data)===file.gitBlob){verified++;continue;}
  if(process.argv.includes('--verify'))throw Error('Missing or changed file: '+file.path);
  const response=await fetch(file.url);if(!response.ok)throw Error('HTTP '+response.status+': '+file.path);
  data=Buffer.from(await response.arrayBuffer());
  if(data.length!==file.bytes||gitBlob(data)!==file.gitBlob)throw Error('Source integrity mismatch: '+file.path);
  await fs.mkdir(path.dirname(target),{recursive:true});
  await fs.writeFile(target+'.download',data);await fs.rename(target+'.download',target);downloaded++;
 }
}));
console.log(JSON.stringify({revision:manifest.revision,files:manifest.files.length,verified,downloaded,bytes:manifest.files.reduce((n,f)=>n+f.bytes,0)}));
