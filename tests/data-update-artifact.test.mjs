import {expect,test} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {packData,applyData} from '../scripts/data-update-artifact.mjs';
const base='a'.repeat(40);
const paths=['public/data/manifest.json','public/data/national.json','public/data/prefectures.json','public/data/history/national.json','public/data/history/prefectures.json','.github/data-update-state.json'];
async function fixture(run){const root=await mkdtemp(join(tmpdir(),'statistics-handoff-'));try{for(const p of paths){await mkdir(join(root,p,'..'),{recursive:true});await writeFile(join(root,p),'{}\n');}await run(root);}finally{await rm(root,{recursive:true,force:true});}}
test('JSONの追加・更新・削除と停止状態を受け渡し、ソースは保持する',async()=>fixture(async root=>{
 await writeFile(join(root,'public/data/obsolete.json'),'{}');await writeFile(join(root,'source.js'),'unchanged');
 const p=await packData(root,base);p.files=p.files.filter(f=>!f.path.endsWith('obsolete.json'));
 p.files.find(f=>f.path==='public/data/national.json').content='{"value":123}\n';
 p.files.find(f=>f.path==='.github/data-update-state.json').content='{"monthlyCompleted":"2026-10"}\n';
 p.files.push({path:'public/data/regional/past-1970.json',content:'{"year":1970}\n'});
 await applyData(root,p,base);
 expect(await readFile(join(root,'public/data/national.json'),'utf8')).toBe('{"value":123}\n');
 expect(await readFile(join(root,'.github/data-update-state.json'),'utf8')).toContain('2026-10');
 expect(await readFile(join(root,'public/data/regional/past-1970.json'),'utf8')).toContain('1970');
 await expect(readFile(join(root,'public/data/obsolete.json'))).rejects.toThrow();
 expect(await readFile(join(root,'source.js'),'utf8')).toBe('unchanged');
}));
test('workflow改変・パストラバーサル・HTML・非JSON・重複・別コミットを拒否する',async()=>fixture(async root=>{
 const p=await packData(root,base);
 for(const path of ['.github/workflows/deploy.yml','scripts/build-data.ts','public/data/../../index.html','public/data/index.html','/tmp/escape.json','public/data/.git/config.json']){
  await expect(applyData(root,{...p,files:[...p.files,{path,content:'{}'}]},base)).rejects.toThrow();
 }
 await expect(applyData(root,{...p,files:[...p.files,{path:'public/data/new.json',content:'console.log(1)'}]},base)).rejects.toThrow();
 await expect(applyData(root,{...p,files:[...p.files,p.files[0]]},base)).rejects.toThrow();
 await expect(applyData(root,p,'b'.repeat(40))).rejects.toThrow();
 await expect(applyData(root,{...p,files:[]},base)).rejects.toThrow();
 expect(await readFile(join(root,'public/data/national.json'),'utf8')).toBe('{}\n');
}));
test('シンボリックリンク経由での書き込み・受け渡しを拒否する',async()=>fixture(async root=>{
 const p=await packData(root,base);await writeFile(join(root,'outside.json'),'{}');
 await symlink(join(root,'outside.json'),join(root,'public/data/link.json'));
 await expect(packData(root,base)).rejects.toThrow();await expect(applyData(root,p,base)).rejects.toThrow();
 expect(await readFile(join(root,'outside.json'),'utf8')).toBe('{}');
}));
