import {readFile,writeFile,rename} from 'node:fs/promises';
import {readDataset,publishDataset} from './dataset';
import {updateMonthly,updateRegional,monthlySignature} from './scoped-update';
const scope=process.env.UPDATE_SCOPE??process.argv.find(a=>a.startsWith('--scope='))?.slice(8)??'monthly';
async function recordCompletion(scope:string,newMonthly:boolean,now:number){
 const path='.github/data-update-state.json';let state:Record<string,string>={};
 try{state=JSON.parse(await readFile(path,'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 const date=new Date(now+9*3600000).toISOString();
 if(newMonthly)state.monthlyCompleted=date.slice(0,7);
 if(scope==='regional')state.regionalYear=date.slice(0,4);
 if(newMonthly||scope==='regional'){await writeFile(path+'.tmp',JSON.stringify(state,null,2)+'\n');await rename(path+'.tmp',path);}
}
try{
 if(!['monthly','regional','all'].includes(scope))throw Error('更新対象は monthly / regional / all を指定してください');
 if(scope==='all'){
  if(process.env.UPDATE_EVENT==='schedule')throw Error('過去統計と将来推計は手動更新専用です');
  let previous;
  try{previous=await readDataset('public/data');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  await import('./build-all-data');
  if(!process.exitCode){const next=await readDataset('public/data');await recordCompletion(scope,!previous||monthlySignature(previous)!==monthlySignature(next),Date.now());}
 }else{
  const now=Date.now(),previous=await readDataset('public/data');
  const appId=process.env.ESTAT_APP_ID?.trim();
  if(scope==='monthly'&&!appId)throw Error('ESTAT_APP_ID が未設定です。既存JSONは変更しません');
  const data=scope==='monthly'?await updateMonthly(previous,appId!,now):await updateRegional(previous,now);
  const newMonthly=scope==='monthly'&&monthlySignature(previous)!==monthlySignature(data);
  console.log(await publishDataset(data)?'統計・モデルを更新しました':'統計・モデルの変更はありません');
  // Written only after complete validation/publication; failures never stop later attempts.
  await recordCompletion(scope,newMonthly,now);
  console.log(newMonthly?'新しい月次統計を取得したため、今月の定期取得を停止します':'月次統計の新着による停止状態は変更しません');
 }
}catch(error){
 const message=error instanceof Error?error.message:'更新に失敗しました',secret=process.env.ESTAT_APP_ID;
 console.error(secret?message.split(secret).join('[REDACTED]'):message);process.exitCode=1;
}
