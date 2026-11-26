#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { calculate, exportCSV } from '../src/core.js';
try {
  const { values } = parseArgs({ options: { input: { type: 'string' }, out: { type: 'string' }, csv: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } } });
  if (values.help) console.log('有钱收分账计算器\nnode bin/split.mjs --input examples/platform.json --out reports/result.json\n加 --csv 导出 CSV；省略 --out 将结果输出至终端。所有计算仅在本地进行。');
  else {
    if (!values.input) throw new Error('请用 --input 指定规则文件。');
    if (values.out && resolve(values.out) === resolve(values.input)) throw new Error('输出不能覆盖输入规则。');
    const result = calculate(JSON.parse(await readFile(values.input, 'utf8')));
    const output = values.csv ? exportCSV(result) : JSON.stringify(result, null, 2) + '\n';
    if (values.out) { await mkdir(dirname(resolve(values.out)), { recursive: true }); await writeFile(values.out, output, { encoding: 'utf8', flag: 'wx' }); console.log(`试算已保存：${resolve(values.out)}`); }
    else console.log(output);
  }
} catch (error) { console.error(`试算失败：${error.message}`); process.exitCode = 1; }
