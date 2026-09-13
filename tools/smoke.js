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

console.log('=== 1. 渲染（学期课表，初始为空） ===');
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
ok('个人课表已清空（无课程卡片）', doc.querySelectorAll('#grid .cls').length === 0);
ok('显示空状态引导', doc.getElementById('termEmpty').innerHTML.indexOf('课表还是空的') >= 0);
ok('网格外层滚动容器', !!doc.querySelector('.gridwrap'));
ok('XLSX 可用', typeof win.XLSX === 'object');
ok('持久化已写入 localStorage', !!win.localStorage.getItem('gs_data_v1'));

console.log('\n=== 2. 逐格选课 ===');
win.eval("setMode('plan')");
const total = win.eval('planCourses.length');
ok('选课清单课程数 >= 50', total >= 50 ? true : total);
const sels = doc.querySelectorAll('#grid select');
ok('逐格下拉框已渲染', sels.length >= 10 ? true : sels.length);
const grp = doc.getElementById('pGroups');
ok('冲突组仍可查看', (grp ? grp.querySelectorAll('.grpline').length : -1) > 0);
ok('未排时间课程可单独选', doc.getElementById('pPend').innerHTML.indexOf('选这门') >= 0);

/* 逐格选课：选一门 → 已选；选「无课」→ 回到候选 */
const sel0 = doc.querySelector('#grid select');
const opt0 = [...sel0.options].filter(o => o.value)[0];
ok('下拉框含候选课程', !!opt0);
if (opt0) {
  const cid = opt0.value;
  sel0.value = cid;
  sel0.dispatchEvent(new win.Event('change'));
  const st1 = win.eval(`planCourses.find(c=>c.id==='${cid}').status`);
  ok('选中后状态为已选', st1 === '已选' ? true : st1);
  const outN = win.eval("planCourses.filter(c=>c.status==='排除').length");
  console.log('  自动排除门数:', outN);
  sel0.value = '';
  sel0.dispatchEvent(new win.Event('change'));
  const st2 = win.eval(`planCourses.find(c=>c.id==='${cid}').status`);
  ok('设为无课后回到候选', st2 === '候选' ? true : st2);
}
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
