import ExcelJS from 'exceljs';
import { addMonths } from '../../src/lib/time';
import { download, downloadText } from './http';
import { discoverExactPopulationFiles, EXACT_LIST } from './exact-population';
import { populationGroups, type PopulationGroup, type Source } from '../../src/types/statistics';
export type BirthDeathRow = { month: string; values: Record<PopulationGroup, { birth: number; death: number }>; source: Source; international?: Record<PopulationGroup,{inflow:number;outflow:number}> };
export async function normalizeNationalEvents(bytes: Uint8Array, source: Omit<Source, 'sourcePeriod'>): Promise<BirthDeathRow[]> {
  const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes as unknown as Parameters<typeof book.xlsx.load>[0]);
  const sheet = book.worksheets[0];
  let title=''; sheet.getRow(1).eachCell(c=>{title+=c.text.replace(/\s/g,'');});
  if (!title.includes('全国人口の推移')) throw new Error('国籍別出生・死亡の表題が変わりました');
  for (const [cell,label] of [['K8','入国者数'],['L8','出国者数'],['Y8','入国者数'],['Z8','出国者数']]) if (!sheet.getCell(cell).text.replace(/\s/g,'').includes(label)) throw new Error('人口推計の入出国列が変わりました');
  const hasForeign = sheet.getCell('AJ8').text.includes('出生児数') && sheet.getCell('AK8').text.includes('死亡者数');
  for (const [cell,label] of [['H8','出生児数'],['I8','死亡者数'],['V8','出生児数'],['W8','死亡者数']]) if (!sheet?.getCell(cell).text.replace(/\s/g,'').includes(label)) throw new Error('国籍別出生・死亡の表構成が変わりました');
  let year = ''; const rows: BirthDeathRow[] = [];
  sheet.eachRow(row => {
    const label = row.getCell('A').text.normalize('NFKC').replace(/\s/g,'');
    const y = label.match(/^(\d{4})年$/); if (y) { year = y[1]; return; }
    const m = label.match(/^(\d{1,2})月$/); if (!m || !year) return;
    const cells = (hasForeign ? ['H','I','V','W','AJ','AK'] : ['H','I','V','W']).map(c => row.getCell(c).value);
    if (cells.every(v => v === null)) return; // The last row contains next month's population only.
    if (cells.some(v => typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0)) throw new Error('国籍別出生・死亡に欠損があります');
    if (!hasForeign) cells.push((cells[0] as number)-(cells[2] as number),(cells[1] as number)-(cells[3] as number));
    if (cells.some(n=>(n as number)<0)) throw new Error('国籍別の差が負になっています');
    const month = `${year}-${m[1].padStart(2,'0')}`;
    const values = Object.fromEntries(populationGroups.map((g,i) => [g,{birth:cells[i*2] as number,death:cells[i*2+1] as number}])) as BirthDeathRow['values'];
    for (const k of ['birth','death'] as const) if (values.total[k] !== values.japanese[k] + values.foreign[k]) throw new Error('国籍別出生・死亡の合計が不一致です');
    const movements = (hasForeign ? ['K','L','Y','Z','AM','AN'] : ['K','L','Y','Z']).map(c=>row.getCell(c).value);
    if(movements.some(v=>typeof v!=='number'||!Number.isSafeInteger(v)||v<0))throw new Error('人口推計の入出国者数に欠損');
    if(!hasForeign)movements.push((movements[0] as number)-(movements[2] as number),(movements[1] as number)-(movements[3] as number));
    const international=Object.fromEntries(populationGroups.map((g,i)=>[g,{inflow:movements[i*2] as number,outflow:movements[i*2+1] as number}])) as NonNullable<BirthDeathRow['international']>;
    for(const k of ['inflow','outflow'] as const)if(international.foreign[k]<0||international.total[k]!==international.japanese[k]+international.foreign[k])throw new Error('入出国の国籍別合計が不一致');
    rows.push({month,values,international,source:{...source,sourcePeriod:month}});
  });
  return rows;
}
export async function fetchNationalEvents(now: number): Promise<BirthDeathRow[]> {
  const files = discoverExactPopulationFiles(await downloadText(new URL(EXACT_LIST)));
  const selected = [0,12,24,36,48].map(i => files[i]);
  if (selected.some(f => !f)) throw new Error('国籍別人口動態の過去表が不足しています');
  const rows = new Map<string,BirthDeathRow>();
  for (const file of selected.reverse()) {
    const data = await normalizeNationalEvents(await download(new URL(file.url)), {publisher:'総務省統計局',statistics:'人口推計',table:'参考表 全国人口の推移（出生児数・死亡者数）',publishedAt:file.publishedAt,retrievedAt:new Date(now).toISOString(),url:file.url,status:'final',scope:'人口推計の計算に用いられた日本国内の出生児数・死亡者数。総数・日本人・外国人別。月報概数とは対象・改訂時期が異なる場合があります。'});
    for (const row of data) rows.set(row.month,row);
  }
  const sorted = [...rows.values()].sort((a,b)=>a.month.localeCompare(b.month));
  if (sorted.length < 60 || sorted.some((r,i)=>i > 0 && r.month !== addMonths(sorted[i-1].month,1))) throw new Error('国籍別人口動態の履歴が不足・不連続です');
  return sorted;
}
