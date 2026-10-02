import { resolve } from 'node:path';
import { readDataset } from './dataset';
import { validatePublication } from './validation';
validatePublication(await readDataset(resolve('public/data')));
console.log('データ検証: OK');
