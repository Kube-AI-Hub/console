/*
 * 迁移后的体积基线：按「入口 / 共享 / 页面」三类汇总 dist 里 JS 的体积。
 *
 * 为什么单独一个脚本：迁移阶段只关心「功能齐不齐」，体积没人看；功能齐了之后，
 * 「哪一页把首屏拖慢了」需要可复现的数字，而不是打开 devtools 目测。脚本只读 dist，
 * 不改变构建产物，可以在任何一次 build 之后运行。
 *
 * 用法：
 *   node kube-frontend/scripts/perf-report.mjs [--top 10] [--json]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const distDir = new URL('../apps/console-next/dist/assets/', import.meta.url);
const args = process.argv.slice(2);
const topIndex = args.indexOf('--top');
const top = topIndex >= 0 ? Number(args[topIndex + 1] ?? 10) : 10;
const asJson = args.includes('--json');

let entries;
try {
  entries = readdirSync(distDir);
} catch {
  console.error('找不到 dist/assets：先在 apps/console-next 里 npx vite build');
  process.exit(1);
}

const files = entries
  .filter((name) => name.endsWith('.js') && !name.endsWith('.map'))
  .map((name) => {
    const path = join(distDir.pathname, name);
    const raw = readFileSync(path);
    return { name, bytes: statSync(path).size, gzip: gzipSync(raw).length };
  })
  .sort((a, b) => b.bytes - a.bytes);

/*
 * 三类分开看，因为预算不是一回事：
 * - 入口 index-*：首屏必付；
 * - 共享 vendor-* / ai-kit / app-shared：首次进入任一带表格的页面时加载一次，之后复用；
 * - 其余是某个页面自己的 chunk，懒加载，单页超预算说明它把编辑器之类的重物拖进了自己。
 */
const kindOf = (name) => {
  if (name.startsWith('index-')) return 'entry';
  if (name.startsWith('vendor-') || name.startsWith('ai-kit-') || name.startsWith('app-shared')) return 'shared';
  return 'page';
};
const groups = { entry: [], shared: [], page: [] };
for (const file of files) groups[kindOf(file.name)].push(file);

const sum = (list, key) => list.reduce((total, file) => total + file[key], 0);
const kib = (bytes) => (bytes / 1024).toFixed(1);
const entry = groups.entry[0];

if (asJson) {
  console.log(JSON.stringify({ entry, shared: groups.shared, pages: groups.page, total: sum(files, 'bytes') }, null, 2));
  process.exit(0);
}

console.log('=== 体积基线（dist/assets 下所有 JS）===');
if (entry) console.log('入口 index: ' + kib(entry.bytes) + ' KiB（gzip ' + kib(entry.gzip) + ' KiB）');
console.log('共享 chunk: ' + groups.shared.length + ' 个，' + kib(sum(groups.shared, 'bytes')) + ' KiB（gzip ' + kib(sum(groups.shared, 'gzip')) + ' KiB）');
console.log('页面 chunk: ' + groups.page.length + ' 个，' + kib(sum(groups.page, 'bytes')) + ' KiB（gzip ' + kib(sum(groups.page, 'gzip')) + ' KiB）');
console.log('全部 JS: ' + kib(sum(files, 'bytes')) + ' KiB（gzip ' + kib(sum(files, 'gzip')) + ' KiB）');

console.log('\n最大的 ' + top + ' 个 chunk：');
for (const file of files.slice(0, top)) {
  console.log('  ' + kib(file.bytes).padStart(8) + ' KiB  gzip ' + kib(file.gzip).padStart(6) + ' KiB  ' + file.name + '（' + kindOf(file.name) + '）');
}

/* 预算来自迁移收尾时的实测，作为后续改动的水平线，不是行业标准。 */
const ENTRY_BUDGET = 100 * 1024;
const PAGE_BUDGET = 60 * 1024;
const overEntry = entry && entry.bytes > ENTRY_BUDGET;
const overPage = groups.page.filter((file) => file.bytes > PAGE_BUDGET);
console.log('\n预算（入口 ≤ ' + kib(ENTRY_BUDGET) + ' KiB，单页 ≤ ' + kib(PAGE_BUDGET) + ' KiB；共享 chunk 不计预算，单独观察）：');
console.log('  入口: ' + (overEntry ? '超出' : '通过'));
console.log('  页面 chunk: ' + (overPage.length ? '超预算 ' + overPage.map((f) => f.name + ' ' + kib(f.bytes) + ' KiB').join(', ') : '全部在预算内'));
if (overEntry || overPage.length) process.exitCode = 2;