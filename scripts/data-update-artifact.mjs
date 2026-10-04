// This handoff runs in the write-enabled job without loading npm dependencies.
// Artifacts carry JSON text only; never copy a working tree or execute their files.
import {readdir,readFile,writeFile,lstat,mkdir,unlink} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const state='.github/data-update-state.json';
const allowed=p=>typeof p==='string'&&(p===state||/^public\/data\/(?:[a-z][a-z0-9-]*|history\/(?:national|prefectures)|regional\/(?:past|future)-\d{4})\.json$/.test(p));
async function safePath(root,path){
 if(!allowed(path))throw Error('Artifact contains a forbidden path');
 const parts=path.split('/');let current=resolve(root);
 for(let i=0;i<parts.length;i++){
  current=join(current,parts[i]);
  try{const s=await lstat(current);if(s.isSymbolicLink()||(i<parts.length-1?!s.isDirectory():!s.isFile()))throw Error('Artifact path is not a regular file/directory');}
  catch(e){if(e.code!=='ENOENT')throw e;}
 }
 return current;
}
async function dataFiles(root,path='public/data'){
 const files=[];
 for(const item of await readdir(resolve(root,path),{withFileTypes:true})){
  const p=path+'/'+item.name;
  if(item.isSymbolicLink())throw Error('Symlinks are forbidden in data artifacts');
  if(item.isDirectory())files.push(...await dataFiles(root,p));
  else if(item.isFile()&&allowed(p))files.push(p);
  else throw Error('Only statistical JSON files may be handed off');
 }
 return files.sort();
}
function validate(payload,base){
 if(!/^[a-f0-9]{40}$/.test(base)||payload.base!==base||!Array.isArray(payload.files))throw Error('Artifact base commit mismatch');
 const names=new Set();
 for(const f of payload.files){
  if(!f||!allowed(f.path)||names.has(f.path)||typeof f.content!=='string')throw Error('Invalid artifact entry');
  JSON.parse(f.content);names.add(f.path);
 }
 for(const p of [state,'public/data/manifest.json','public/data/national.json','public/data/prefectures.json','public/data/history/national.json','public/data/history/prefectures.json'])if(!names.has(p))throw Error('Incomplete data artifact');
 return names;
}
export async function packData(root,base){
 const files=[];
 for(const path of [...await dataFiles(root),state])files.push({path,content:await readFile(await safePath(root,path),'utf8')});
 const payload={base,files};validate(payload,base);return payload;
}
export async function applyData(root,payload,base){
 const names=validate(payload,base),existing=await dataFiles(root);
 // Validate every destination before touching any file.
 for(const f of payload.files)await safePath(root,f.path);
 for(const path of existing)await safePath(root,path);
 for(const f of payload.files){const p=resolve(root,f.path);await mkdir(dirname(p),{recursive:true});await writeFile(p,f.content,{mode:0o644});}
 for(const path of existing)if(!names.has(path))await unlink(resolve(root,path));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,file,base]=process.argv.slice(2);
 if(mode==='pack'){await mkdir(dirname(resolve(file)),{recursive:true});await writeFile(file,JSON.stringify(await packData(process.cwd(),base)));}
 else if(mode==='apply')await applyData(process.cwd(),JSON.parse(await readFile(file,'utf8')),base);
 else throw Error('Expected pack or apply');
}
