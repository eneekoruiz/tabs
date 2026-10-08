import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),directory=path.join(root,'tests/fixtures/real-audio');
const manifest=JSON.parse(await fs.readFile(path.join(directory,'manifest.json'),'utf8'));
for(const item of manifest.files){
 if(!/^[^\/\\]+$/.test(item.name))throw Error('Unsafe fixture filename');
 const response=await fetch(item.url);if(!response.ok)throw Error(item.name+' HTTP '+response.status);
 const bytes=new Uint8Array(await response.arrayBuffer()),hash=createHash('sha256').update(bytes).digest('hex');
 if(hash!==item.sha256||bytes.length!==item.size)throw Error(item.name+' checksum mismatch');
 await fs.writeFile(path.join(directory,item.name),bytes);console.log(item.name+' verified');
}
