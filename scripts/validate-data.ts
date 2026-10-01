import { resolve } from 'node:path';
import { readDataset } from './dataset';
await readDataset(resolve('public/data'));
console.log('データ検証: OK');
