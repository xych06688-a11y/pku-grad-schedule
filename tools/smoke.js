/* APP 端 index.html 冒烟测试：真实 DOM 渲染 + 真实 Excel 解析 + 持久化 */
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const R = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(R, 'android/app/src/main/assets/index.html'), 'utf8');
const XLSX_SRC = fs.readFileSync(path.join(R, 'tools/asdk/xlsx.full.min.js'), 'utf8');
// 待测的教务 Excel：通过环境变量 XLSX_FILE 传入，未设置则跳过 Excel 解析用例
const XLSX_FILE = process.env.XLSX_FILE || '';

const errs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errs.push('jsdomError: ' + (e.stack || e.message)));
vc.on('error', (...a) => errs.push('console.error: ' + a.join(' ')));

console.log('=== 1. 渲染 ===');
const dom = new JSDOM(HTML, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'http://localhost/index.html',
  virtualConsole: vc,
  beforeParse(win) {
    win.eval(XLSX_SRC);
    win.addEventListener('error', e => errs.push('window.error: ' + (e.message || '')));
  }
});
const win = dom.window, doc = win.document;
const ok = (n, v) => console.log((v ? '  OK  ' : ' FAIL ') + n + (v === true ? '' : '  -> ' + v));

ok('无脚本错误', errs.length === 0 ? true : errs.slice(0, 3).join(' | '));
ok('grid 已渲染', doc.getElementById('grid').innerHTML.length > 200);
const clsN = doc.querySelectorAll('#grid .cls').length;
ok('学期课表课程卡片数 >= 8（综合实践待定不在网格）', clsN >= 8 ? true : clsN);
ok('待定课程已单独列出', doc.getElementById('pendingBox').innerHTML.indexOf('综合实践') >= 0);
ok('网格外层滚动容器', !!doc.querySelector('.gridwrap'));
ok('XLSX 可用', typeof win.XLSX === 'object');
ok('持久化已写入 localStorage', !!win.localStorage.getItem('gs_data_v1'));
ok('浮动数据按钮存在', doc.body.textContent.indexOf('数据') > 0);

console.log('\n=== 2. 选课模式 ===');
win.eval("setMode('plan')");
const grp = doc.getElementById('pGroups');
const grpN = grp ? grp.querySelectorAll('.grpline').length : -1;
ok('冲突组已渲染', grpN > 0 ? true : grpN);
const cards = doc.querySelectorAll('#grid .pcard').length;
ok('选课网格课程数 > 40', cards > 40 ? true : cards);
const stat = doc.getElementById('pStat');
console.log('  侧栏统计:', stat ? stat.textContent.trim().slice(0, 80) : '');

console.log('\n=== 3. 真实 Excel 解析（北大排课表） ===');
if (!fs.existsSync(XLSX_FILE)) {
  console.log('  (跳过：Excel 文件不存在)');
} else {
  const buf = fs.readFileSync(XLSX_FILE);
  const res = win.eval(`(function(){
    var wb = XLSX.read(new Uint8Array(${JSON.stringify(Array.from(new Uint8Array(buf)))}), {type:'array'});
    var t = __pk.readTable(wb);
    var list = __pk.parseRows(t.rows);
    return {sheet:t.name, n:list?list.length:0, last:(list||[]).slice(-6).map(function(c){return c.name+'|'+c.hours}),
      sample:(list||[]).slice(0,4).map(function(c){
      return {name:c.name, teacher:c.teacher, hours:c.hours,
        times:c.times.map(function(x){return ['周一','周二','周三','周四','周五','周六','周日'][x.d]+' '+x.start+'-'+x.end+' '+x.wk}).join(';'),
        room:c.room};
    })};
  })()`);
  console.log('  工作表:', res.sheet, '| 识别课程数:', res.n);
  res.sample.forEach(c => console.log('   -', c.name, '|', c.teacher, '|', c.hours + '学时', '|', c.times || '待定', '|', c.room));
  ok('解析课程数 >= 40', res.n >= 40 ? true : res.n);
  console.log('  末尾 6 条（检查脏数据）:');
  res.last.forEach(s => console.log('   ·', s));
  const withTime = res.sample.filter(c => c.times).length;
  ok('样例含上课时间', withTime > 0 ? true : withTime);
}

console.log('\n=== 4. 结果 ===');
console.log(errs.length ? '存在 ' + errs.length + ' 个错误' : '全部通过');
if (errs.length) errs.slice(0, 8).forEach(e => console.log('  ! ' + e.slice(0, 300)));
