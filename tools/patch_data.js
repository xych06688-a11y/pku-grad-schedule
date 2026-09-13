/* 一次性数据维护脚本：
   1) 应用教务调课通知（权威教室 / 教师，覆盖 Excel）
   2) 清空个人课表数据（学期课表模式置空）
   3) 选课清单状态复位为「候选」
   用法：node tools/patch_data.js
*/
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'prototype/index.html');

/* 教务通知（2026-09-13）：以本表为准 */
const NOTICE = [
  { code: '01711990', name: '开源软件开发基础及实践', room: '3202', teacher: '荆琦' },
  { code: '01719320', name: '面向金融的Python', room: '3204', teacher: '储伟杰' },
  { code: '01711930', name: '互联网软件开发技术与实践', room: '3202', teacher: '张齐勋' },
  { code: '01714330', name: '云计算技术及应用', room: '1401', teacher: '莫同' },
  { code: '01713990', name: '集成电路前沿技术导论', room: '1401', teacher: '刘力锋、王玮、崔小欣' },
  { code: '01715200', name: '数字集成电路设计', room: '1401', teacher: '于敦山' }
];

let html = fs.readFileSync(FILE, 'utf8');
const log = [];

/* ---------- 1. 选课清单：应用通知 + 状态复位 ---------- */
const start = html.indexOf('/*PLAN_DATA_START*/');
const end = html.indexOf('/*PLAN_DATA_END*/');
if (start < 0 || end < 0) { console.error('找不到 PLAN_DATA 标记'); process.exit(1); }

let block = html.slice(start, end);
const before = block;
let hitRoom = 0, resetSel = 0;

block = block.replace(/status:'([^']*)'/g, (m, v) => {
  if (v === '已选') { resetSel++; return "status:'候选'"; }
  return m;
});

NOTICE.forEach(n => {
  // 逐行处理，按 课程编号 + 课程名前缀 匹配
  const lines = block.split('\n');
  let done = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!/^\{id:'p\d+'/.test(l.trim())) continue;
    const cm = l.match(/code:'([^']*)'/);
    const nm = l.match(/name:'([^']*)'/);
    if (!cm || !nm) continue;
    if (cm[1] !== n.code) continue;
    if (nm[1] !== n.name && !nm[1].startsWith(n.name)) continue;
    let nl = l.replace(/room:'[^']*'/, "room:'" + n.room + "'");
    nl = nl.replace(/teacher:'[^']*'/, "teacher:'" + n.teacher + "'");
    if (nl === l) continue;
    lines[i] = nl;
    done++; hitRoom++;
    log.push('  教室/教师更新：' + nm[1] + ' → ' + n.room + ' / ' + n.teacher);
  }
  block = lines.join('\n');
  if (!done) log.push('  [警告] 未匹配到：' + n.code + ' ' + n.name);
});

html = html.slice(0, start) + block + html.slice(end);

/* ---------- 2. 清空个人课表（学期课表模式） ---------- */
html = html.replace(/const courses=\[[\s\S]*?\n\];/, 'const courses=[];');
html = html.replace(/const slots=\[[\s\S]*?\n\];/, 'const slots=[];');
html = html.replace(/let assigns=\[[\s\S]*?\n\];/, 'let assigns=[];');
html = html.replace(/let changes=\[[\s\S]*?\n\];/, 'let changes=[];');

fs.writeFileSync(FILE, html, 'utf8');

console.log('=== 教务通知应用：' + hitRoom + ' 条');
log.forEach(l => console.log(l));
console.log('=== 已选状态复位：' + resetSel + ' 门');
console.log('=== 个人课表已清空（courses / slots / assigns / changes）');
console.log('写入：' + FILE);
