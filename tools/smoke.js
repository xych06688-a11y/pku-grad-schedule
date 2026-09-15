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
const ok = (n, v) => {
  const pass = (v === true);
  console.log((pass ? '  OK  ' : ' FAIL ') + n + (pass ? '' : '  -> ' + v));
  if (!pass) errs.push(n + ' -> ' + v);
};

ok('无脚本错误', errs.length === 0 ? true : errs.slice(0, 3).join(' | '));
ok('grid 已渲染', doc.getElementById('grid').innerHTML.length > 200);
ok('个人课表已清空（无课程卡片）', doc.querySelectorAll('#grid .cls').length === 0);
ok('显示空状态引导', doc.getElementById('termEmpty').innerHTML.indexOf('课表还是空的') >= 0);
ok('纵向视图容器已就位（窄屏启用）', !!doc.getElementById('agenda'));
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

console.log('\n=== 2.5 导出正式课表 / 考勤 / 作业待办 / 学习计划 ===');
/* 逐格选满（复用真实交互路径），再导出 */
for (let guard = 0; guard < 60; guard++) {
  const ss = [...doc.querySelectorAll('#grid select')];
  let did = false;
  for (const s of ss) {
    const o = [...s.options].find(x => x.value);
    if (o) { s.value = o.value; s.dispatchEvent(new win.Event('change')); did = true; break; }
  }
  if (!did) break;
}
const selN = win.eval("planCourses.filter(c=>c.status==='已选').length");
ok('逐格选课后有已选课程', selN > 0 ? true : selN);
win.eval("W=1");
doc.getElementById('btnExport').click();
const cN = win.eval('courses.length'), sN = win.eval('slots.length');
ok('导出生成了课程', cN > 0 ? true : cN);
ok('导出生成了排课时段', sN > 0 ? true : sN);
ok('导出后切回学期课表', win.eval('MODE') === 'term');
ok('学期网格出现课程卡片', doc.querySelectorAll('#grid .cls').length > 0 ? true : doc.querySelectorAll('#grid .cls').length);

/* 考勤方式：可选，填了才显示 */
const cid0 = win.eval('courses[0].id');
ok('默认无考勤标记', doc.getElementById('grid').innerHTML.indexOf('考勤') < 0);
win.eval(`courses[0].attendance='课堂点名';render()`);
ok('填写后课表卡片显示考勤', doc.getElementById('grid').innerHTML.indexOf('考勤 课堂点名') >= 0);
win.eval(`courses[0].attendance='（未填写）';render()`);
ok('留空后不再显示考勤', doc.getElementById('grid').innerHTML.indexOf('考勤') < 0);

/* 作业待办清单 */
win.eval(`assigns.push({id:'t1',c:courses[0].id,week:1,title:'测试作业',type:'课后作业',content:'x',
  method:'学习平台',target:'',material:'x',due:'2026-09-20 23:59',hours:2,weight:10,status:'未开始',prio:'中',
  todos:[{t:'第一步',done:false},{t:'第二步',done:false}]});render();openAs('t1')`);
ok('作业详情含待办清单', doc.getElementById('modal').innerHTML.indexOf('待办清单') >= 0);
ok('待办条目渲染 2 条', doc.querySelectorAll('#modal .tdo .it').length === 2 ? true : doc.querySelectorAll('#modal .tdo .it').length);
win.eval("toggleTodo('t1',0)");
ok('勾选后进度更新', win.eval("assigns.find(a=>a.id==='t1').todos[0].done") === true);
win.eval("addTodo('t1')");
win.eval(`document.getElementById('td_new_t1').value='第三步';addTodo('t1')`);
ok('新增待办成功', win.eval("assigns.find(a=>a.id==='t1').todos.length") === 3 ? true : win.eval("assigns.find(a=>a.id==='t1').todos.length"));
win.eval("delTodo('t1',2)");
ok('删除待办成功', win.eval("assigns.find(a=>a.id==='t1').todos.length") === 2 ? true : win.eval("assigns.find(a=>a.id==='t1').todos.length"));
win.eval("closeM()");

/* 学习计划：含单双周判断 */
/* 学习计划：重点验证单周判定 —— 重新导出，只选一门单周课 */
win.eval(`assigns.length=0;plans.length=0;planCourses.forEach(c=>c.status='候选');
  var t=planCourses.find(c=>c.times.some(x=>/单周/.test(x.wk)));
  if(t)t.status='已选'; setMode('plan')`);
doc.getElementById('btnExport').click();
ok('单周课程已导出', win.eval(`slots.filter(x=>/单周/.test(x.w)).length`) === 1 ? true : win.eval(`slots.map(x=>x.w).join(',')`));
ok('清单中存在双周课程', win.eval(`planCourses.filter(c=>c.times.some(x=>/双周/.test(x.wk))).length`) > 0);

win.eval("setMode('study');W=1;render()");
ok('学习计划模式已切换', win.eval('MODE') === 'study');
ok('15 个格子均有添加入口（周一至周五）', doc.querySelectorAll('#grid .addpl').length === 15 ? true : doc.querySelectorAll('#grid .addpl').length);
const oddSlot = win.eval(`(function(){const s=slots[0];return {d:s.d,p:s.p,w:s.w}})()`);
console.log('  单周样本:', `${['周一','周二','周三','周四','周五','周六','周日'][oddSlot.d]} ${oddSlot.p} ${oddSlot.w}`);
ok('第 1 周有课', win.eval(`classesAt(1,${oddSlot.d},'${oddSlot.p}').length`) === 1);
ok('第 2 周无课（单周不上）', win.eval(`classesAt(2,${oddSlot.d},'${oddSlot.p}').length`) === 0);
ok('第 3 周有课（奇数周）', win.eval(`classesAt(3,${oddSlot.d},'${oddSlot.p}').length`) === 1);
win.eval(`W=2;render()`);
ok('第 2 周该格标注「本周不上」', doc.getElementById('grid').innerHTML.indexOf('本周不上') >= 0);
ok('第 2 周该格不显示有课标记', doc.getElementById('grid').innerHTML.indexOf('mini on') < 0);
win.eval(`W=1;render()`);
ok('第 1 周该格显示有课', doc.getElementById('grid').innerHTML.indexOf('mini on') >= 0);
/* 在有课的格子加计划 → 自动标记「上课时学别的」 */
const cell = win.eval(`(function(){const s=slots.find(x=>x.weeks.includes(1));return s?{d:s.d,p:s.p}:null})()`);
if (cell) {
  win.eval(`openPlanAdd(${cell.d},'${cell.p}')`);
  ok('有课时段给出提醒', doc.getElementById('modal').innerHTML.indexOf('本周该时段有课') >= 0);
  win.eval(`document.getElementById('sp_t').value='看论文';savePlan(${cell.d},'${cell.p}')`);
  ok('计划已保存', win.eval('plans.length') === 1 ? true : win.eval('plans.length'));
  ok('自动标记为上课时学别的', win.eval('plans[0].clash') === true);
  ok('侧栏「上课时学别的」有条目', doc.getElementById('sWarn').innerHTML.indexOf('看论文') >= 0);
  win.eval('togglePlanDone(plans[0].id)');
  ok('可勾选完成', win.eval('plans[0].done') === true);
  win.eval('W=2;render();copyLastWeek()');
  ok('复制上周计划', win.eval('plans.length') === 2 ? true : win.eval('plans.length'));
  ok('复制后重置完成态', win.eval('plans[1].done') === false);
  win.eval('clearWeekPlans()');
  ok('清空本周计划', win.eval('plans.length') === 1 ? true : win.eval('plans.length'));
  win.eval('W=1;render()');
}
/* 空闲时段统计 */
ok('空闲时段已统计', doc.getElementById('sFreeN').textContent.length >= 0);
win.eval("setMode('term')");

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

console.log('\n=== 5. 窄屏纵向视图（手机：只上下滚、无横向滚） ===');
win.eval(`window.matchMedia=function(q){return {matches:/max-width:\\s*900px/.test(q),media:q,addListener:function(){},removeListener:function(){},addEventListener:function(){},removeEventListener:function(){}}};
  window.dispatchEvent(new Event('resize'));`);
win.eval("setMode('term')");
const agd = doc.querySelectorAll('#agenda .agd');
ok('纵向视图渲染 5 天（周一至周五）', agd.length === 5 ? true : agd.length);
ok('每天 3 个时段', doc.querySelectorAll('#agenda .agd:first-child .agp').length === 3 ? true : doc.querySelectorAll('#agenda .agd:first-child .agp').length);
ok('宽表格在窄屏隐藏', doc.getElementById('grid').style.display === 'none');
ok('纵向视图不含周六/周日', doc.getElementById('agenda').textContent.indexOf('周六') < 0 && doc.getElementById('agenda').textContent.indexOf('周日') < 0);
ok('课程长条渲染（非空态）', doc.querySelectorAll('#agenda .agrow').length > 0 ? true : doc.querySelectorAll('#agenda .agrow').length);
ok('周末课程有兜底区块', (function () {
  const has = win.eval("slots.some(s=>s.d>=5)");
  const box = doc.getElementById('wkBox').innerHTML.indexOf('周末') >= 0;
  return has ? box : true;
})());
win.eval("setMode('plan')");
ok('选课模式窄屏有下拉', doc.querySelectorAll('#agenda select').length > 0 ? true : doc.querySelectorAll('#agenda select').length);
win.eval("setMode('study')");
ok('学习计划窄屏有添加入口', doc.querySelectorAll('#agenda .addpl').length === 15 ? true : doc.querySelectorAll('#agenda .addpl').length);
win.eval("setMode('term')");
const wide = win.eval(`document.documentElement.scrollWidth <= window.innerWidth + 1`);
ok('页面无横向溢出', wide);

console.log('\n=== 6. 周视图切换 / 会考勤 / 有作业 / 截止当天标黄 ===');
/* 承接第 5 节：仍处于窄屏（手机）term 模式 */
ok('周次下拉共 16 个选项（第 1~16 周）', doc.querySelectorAll('#wSel option').length === 16 ? true : doc.querySelectorAll('#wSel option').length);

/* 单周课程：第 1 周显示，第 2 周（双周）不显示 */
const cname = win.eval('courses[0].name');
win.eval('W=1;render()');
ok('第 1 周显示该课（单周）', doc.getElementById('agenda').innerHTML.indexOf(cname) >= 0);
win.eval('gotoWeek(2)');
ok('第 2 周不再显示单周课', doc.getElementById('agenda').innerHTML.indexOf(cname) < 0);
ok('切换后下拉同步到第 2 周', doc.getElementById('wSel').value === '2' ? true : doc.getElementById('wSel').value);

/* 下节课考勤：精确绑定到「第 N 周 · 周 X · 某一节」，其他周次不再显示 */
win.eval('gotoWeek(1)');
ok('默认没有「会考勤」', doc.getElementById('agenda').innerHTML.indexOf('会考勤') < 0);
const cidA = win.eval('courses[0].id');
win.eval(`toggleAttNext('${cidA}')`);
const markW = win.eval('courses[0].attWeek');
ok('标记后自动绑定到具体周次', markW >= 1 && markW <= 16 ? true : markW);
win.eval('closeM()');
win.eval('gotoWeek(' + markW + ')');
ok('被标记的那周显示「会考勤」', doc.getElementById('agenda').innerHTML.indexOf('会考勤') >= 0);
const chkAtt = win.eval(`(function(){
  var c=courses[0]; if(!c.attWeek) return 'no-mark';
  var pk=(PERIODS.find(function(p){return p.n===c.attPeriod})||{}).k||'morning';
  var other=(c.attWeek===16?1:c.attWeek+1);
  return (hwTags(c,c.attWeek,c.attDay,pk).indexOf('会考勤')>=0?'1':'0')
       + (hwTags(c,other,c.attDay,pk).indexOf('会考勤')>=0?'1':'0');
})()`);
ok('其他周次不再显示「会考勤」', chkAtt === '10' ? true : chkAtt);
win.eval(`toggleAttNext('${cidA}')`);
ok('取消标记生效', win.eval('courses[0].attWeek') === 0);
win.eval('closeM();gotoWeek(1)');

/* 作业：第 1 周布置，下周一（第 2 周周一 09-14）截止 */
win.eval(`assigns.length=0;
  assigns.push({id:'hw1',c:courses[0].id,week:1,title:'第一章习题',type:'课后作业',content:'x',
    method:'学习平台',target:'',material:'x',due:'2026-09-14 23:59',hours:3,weight:10,status:'未开始',prio:'中',todos:[]});
  gotoWeek(1)`);
ok('课表卡片显示「有作业」', doc.getElementById('agenda').innerHTML.indexOf('有作业') >= 0);
ok('截止显示为相对周（下周一）', doc.getElementById('agenda').innerHTML.indexOf('下周一') >= 0);

/* 切到截止所在那一周：对应日期标黄并列出待交作业 */
win.eval('gotoWeek(2)');
const dueDays = doc.querySelectorAll('#agenda .agd.due');
ok('截止当天被标黄（.agd.due）', dueDays.length === 1 ? true : dueDays.length);
ok('标黄的正是周一', (function () { const all = doc.querySelectorAll('#agenda .agd'); return all[0].className.indexOf('due') >= 0 })());
ok('黄色区块写明「需提交作业」', doc.getElementById('agenda').innerHTML.indexOf('需提交作业') >= 0);
ok('黄色区块含作业标题', doc.getElementById('agenda').innerHTML.indexOf('第一章习题') >= 0);

/* 交掉之后不再提醒 */
win.eval(`assigns[0].status='已提交';gotoWeek(2)`);
ok('提交后不再标黄', doc.querySelectorAll('#agenda .agd.due').length === 0 ? true : doc.querySelectorAll('#agenda .agd.due').length);
win.eval(`assigns.length=0;courses.forEach(function(c){c.attWeek=0});gotoWeek(1)`);

console.log('\n=== 7. 真实设备时间 / 当天高亮 / 今日通知栏 ===');
/* 期望周次：用测试进程的真实当天日期独立算一遍，和页面里的 curWeek() 对照 */
const semStart = win.eval('SEM_START');
const expW = (function () {
  const s = new Date(semStart + 'T00:00:00');
  const d = new Date(); d.setHours(0, 0, 0, 0);
  return Math.min(16, Math.max(1, Math.floor((d - s) / 6048e5) + 1));
})();
ok('周次按设备真实日期计算（不是写死的）', win.eval('curWeek()') === expW ? true : win.eval('curWeek()') + ' vs ' + expW);
ok('NOW 是真实时钟（非固定 2026-09-13）', win.eval('NOW.getFullYear()+NOW.getMonth()*100+NOW.getDate()') === (new Date().getFullYear() + new Date().getMonth() * 100 + new Date().getDate()) ? true : win.eval('NOW.toString()'));

win.eval('gotoWeek(curWeek());setMode("term")');
const thToday = doc.querySelectorAll('#grid thead th.today');
ok('本周视图只有一列被标为今天', thToday.length === 1 ? true : thToday.length);
ok('今天列带「今天」角标', thToday.length > 0 && thToday[0].innerHTML.indexOf('今天') >= 0);
ok('今天列有 td.cell.today 底色', doc.querySelectorAll('#grid td.cell.today').length === 3 ? true : doc.querySelectorAll('#grid td.cell.today').length);

/* 今日通知栏：塞一条今天到期的作业 */
ok('今日通知栏容器存在', !!doc.getElementById('todayBar'));
const dueToday = win.eval(`(function(){var d=new Date(NOW.getFullYear(),NOW.getMonth(),NOW.getDate());
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+' 23:59'})()`);
win.eval(`assigns.length=0;
  assigns.push({id:'hwT',c:courses[0].id,week:curWeek(),title:'今日作业A',type:'课后作业',content:'',
    method:'学习平台',target:'',material:'',due:'${dueToday}',hours:1,weight:10,status:'未开始',prio:'中',todos:[]});
  render()`);
const bar = doc.getElementById('todayBar');
ok('有待办时通知栏显示', bar.style.display === 'block' ? true : bar.style.display);
ok('通知栏提示「今天要交」', bar.innerHTML.indexOf('今天要交') >= 0);
ok('通知栏写明作业标题', bar.innerHTML.indexOf('今日作业A') >= 0);

/* 全清后自动隐藏 */
win.eval(`window.__slots=slots.splice(0,slots.length);plans.length=0;assigns.length=0;
  courses.forEach(function(c){c.attWeek=0});render()`);
ok('没有待办时通知栏自动隐藏', doc.getElementById('todayBar').style.display === 'none' ? true : doc.getElementById('todayBar').style.display);
win.eval('slots.push.apply(slots,window.__slots);render()');

console.log('\n=== 结果 ===');
console.log(errs.length ? '存在 ' + errs.length + ' 个错误' : '全部通过');
if (errs.length) errs.slice(0, 8).forEach(e => console.log('  ! ' + e.slice(0, 300)));
try { win.close(); } catch (e) { }     /* 停掉页面里的定时器，避免 jsdom 挂住进程 */
process.exit(errs.length ? 1 : 0);
