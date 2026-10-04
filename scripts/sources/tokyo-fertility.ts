import ExcelJS from 'exceljs';
import type {TokyoAreaSet} from '../../src/types/tokyo-areas';
import type {Source} from '../../src/types/statistics';

// The metropolitan supplement publishes Tama (cities + county) directly.
// Adding or averaging the two separately published fertility rates is invalid.
export async function readTamaFertility(bytes:Uint8Array):Promise<number> {
  const workbook=new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const matches:number[]=[];
  for(const sheet of workbook.worksheets){
    let column:number|undefined;
    sheet.eachRow(row=>row.eachCell((cell,index)=>{
      if(cell.text.replace(/\s/g,'')==='合計特殊出生率')column=index;
    }));
    if(column===undefined)continue;
    sheet.eachRow(row=>{
      let tama=false;
      row.eachCell(cell=>{if(['多摩','市郡部','多摩地域（市郡部）'].includes(cell.text.replace(/\s/g,'')))tama=true;});
      if(!tama)return;
      const text=row.getCell(column!).text.trim();
      const value=Number(text);
      if(!text||!Number.isFinite(value)||value<0||value>10)throw Error('多摩の合計特殊出生率が不正です');
      matches.push(value);
    });
  }
  if(matches.length!==1)throw Error('多摩の合計特殊出生率が一意に確認できません');
  return matches[0];
}

// Approximation only: weighting regional TFRs by women aged 15–49 does not
// reconstruct the pooled age-specific rates. Never label this as an official TFR.
export function approximateTamaFertility(cityRate:number,countyRate:number,cityWomen:number,countyWomen:number){
  if([cityRate,countyRate].some(v=>!Number.isFinite(v)||v<0||v>10)||[cityWomen,countyWomen].some(v=>!Number.isSafeInteger(v)||v<=0))throw Error('多摩出生率の参考算出に必要な値が不正です');
  return (cityRate*cityWomen+countyRate*countyWomen)/(cityWomen+countyWomen);
}

export function addTamaFertility(areas:TokyoAreaSet,value:number,source:Source,reference=false){
  if(!Number.isFinite(value)||value<0||value>10)throw Error('多摩の合計特殊出生率が不正です');
  for(const key of ['total','japanese']as const){
    const group=areas.tama.groups[key]??={rows:[]};
    group.fertilityRate={value,source,reference};
  }
}
