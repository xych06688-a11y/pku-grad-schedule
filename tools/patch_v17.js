/* v1.7 补丁：
   1) 真实设备时间（原来 NOW 被写死成 2026-09-13）
   2) 「会考勤」只在被标记的那一次课所在周显示（原来布尔量，全周都显示）
   3) 当天整列高亮 + 课表内加「今天」角标
   4) 页面顶部「今天待办」通知栏（无内容自动隐藏）
   5) 载入即跳到今天所在周；跨天 / 回到前台自动刷新
*/
const fs = require('fs');
const F = 'C:/Users/titicaca/WorkBuddy/2026-09-13-09-23-26/prototype/index.html';
let s = fs.readFileSync(F, 'utf8');
const log = [];
function rep(name, a, b, all) {
  if (s.indexOf(a) < 0) { log.push('MISS: ' + name); return; }
  s = all ? s.split(a).join(b) : s.replace(a, b);
  log.push('OK  : ' + name);
}
function insBefore(name, anchor, add) {
  if (s.indexOf(anchor) < 0) { log.push('MISS: ' + name); return; }
  s = s.replace(anchor, add + anchor);
  log.push('OK  : ' + name);
}

/* ---------- 1. 真实时间 ---------- */
rep('1 真实设备时间',
  "const NOW=new Date(2026,8,13,10,20);",
  "let NOW=new Date();                                  /* 真实设备时间：读手机 / 电脑系统时钟 */\nfunction tickNow(){NOW=new Date()}");

/* ---------- 2. 样式：今日通知栏 + 当天高亮 ---------- */
const CSS = [
  '  /* ===== 顶部「今天」通知栏 ===== */',
  '  .todaybar{border:1px solid #bfdbfe;background:linear-gradient(180deg,#eff6ff,#f8fbff);',
  '    border-radius:12px;padding:10px 13px;margin-bottom:12px}',
  '  .todaybar .tb-hd{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px}',
  '  .todaybar .tb-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);flex:none}',
  '  .todaybar .tb-hd b{font-size:14px}',
  '  .todaybar .tb-sub{font-size:11.5px;color:var(--tx3)}',
  '  .todaybar .tb-row{display:flex;gap:8px;align-items:baseline;font-size:12.5px;line-height:1.95;color:var(--tx2)}',
  '  .todaybar .tb-k{flex:none;font-size:10.5px;font-weight:700;padding:1px 6px;border-radius:4px;background:#dbeafe;color:#1e40af}',
  '  .todaybar .tb-row.hot .tb-k{background:var(--accent);color:#fff}',
  '  .todaybar .tb-row.hot .tb-v{color:#1e3a8a;font-weight:600}',
  '  .todaybar .tb-row.warn .tb-k{background:#fde68a;color:#92400e}',
  '  .todaybar .tb-row.warn .tb-v{color:#92400e;font-weight:600}',
  '  .todaybar .tb-row.bad .tb-k{background:#fee2e2;color:#b91c1c}',
  '  .todaybar .tb-row.bad .tb-v{color:#b91c1c;font-weight:600}',
  '  .todaybar .tb-row.att .tb-k{background:#ef4444;color:#fff}',
  '  .todaybar .tb-row.att .tb-v{color:#b91c1c;font-weight:600}',
  '  .todaybar .tb-row.dim .tb-v{color:var(--tx3)}',
  '  /* ===== 当天列：明显的颜色区分 ===== */',
  '  table.grid thead th.today{background:var(--accent);color:#fff;font-weight:700}',
  '  table.grid thead th.today .d{opacity:.85}',
  '  td.cell.today{background:#f4f7ff;box-shadow:inset 3px 0 0 var(--accent),inset -3px 0 0 var(--accent)}',
  '  .tdchip{display:inline-block;margin-left:4px;font-size:9.5px;font-weight:700;background:#fff;color:var(--accent);',
  '    border-radius:3px;padding:0 4px;vertical-align:1px}',
  '  .agd.today{background:#f8faff}',
  '  .agd.today .agd-hd b{color:var(--accent)}',
  '  .agd-hd .tdchip{background:var(--accent);color:#fff}'
].join('\n') + '\n';
insBefore('2 今日通知栏 / 当天高亮样式', '</style>', CSS);

/* ---------- 3. 通知栏容器 ---------- */
insBefore('3 通知栏容器',
  '<div class="notice" id="changeBar">',
  '  <div class="todaybar" id="todayBar" style="display:none"></div>\n\n');

/* ---------- 4. 会考勤：精确到「哪一周哪一天哪一节」 ---------- */
rep('4a hwTags 按周/天/节判定',
  "function hwTags(c,w){const n=hwOf(c.id,w).length;let s='';\n" +
  "  if(c.attNext)s+='<span class=\"attflag\">会考勤</span>';",
  "function hwTags(c,w,d,pk){const n=hwOf(c.id,w).length;let s='';\n" +
  "  /* 只在被标记的那一次课（第 attWeek 周 / 周 attDay / attPeriod）显示，其他周次不显示 */\n" +
  "  if(c.attWeek&&c.attWeek===w&&(d===undefined||c.attDay===d)&&(!pk||c.attPeriod===(PERIODS.find(p=>p.k===pk)||{}).n))\n" +
  "    s+='<span class=\"attflag\">会考勤</span>';");

rep('4b 宽屏课表调用点',
  "${attText(c)?' · 考勤 '+attText(c):''}</span>${hwTags(c,W)}</div>`;",
  "${attText(c)?' · 考勤 '+attText(c):''}</span>${hwTags(c,W,i,p.k)}</div>`;");

rep('4c 窄屏长条调用点',
  "${hwLine(c,W)}${hwTags(c,W)}</div>`;",
  "${hwLine(c,W)}${hwTags(c,W,d,p.k)}</div>`;");

/* ---------- 5. 下节课考勤：定位到具体那一次课 ---------- */
const ATT = [
  '/* ============ 下节课考勤：精确绑定到「第 N 周 · 周 X · 某一节」那一次课 ============ */',
  '/* 从今天起找这门课的下一节课；返回 {w,d,p,slot} 或 null */',
  "function nextSession(c){",
  '  const cw=curWeek(), td=(NOW.getDay()+6)%7, ord={morning:0,afternoon:1,evening:2};',
  '  const curOrd=NOW.getHours()<12?0:(NOW.getHours()<17?1:2);',
  '  let best=null;',
  '  slots.filter(s=>s.c===c.id).forEach(s=>{',
  '    (s.weeks||[]).forEach(w=>{',
  '      if(w<cw)return;',
  '      if(w===cw&&(s.d<td||(s.d===td&&ord[s.p]<=curOrd)))return;',
  '      const key=w*100+s.d*10+ord[s.p];',
  '      if(!best||key<best.key)best={key:key,w:w,d:s.d,p:s.p};',
  '    });',
  '  });',
  '  return best;',
  '}',
  '/* 点击「标记下节课考勤」：自动算出下一次课并绑定；再点一次取消 */',
  'function toggleAttNext(id){',
  '  const c=course(id);',
  '  if(c.attWeek){c.attWeek=0;c.attDay=0;c.attPeriod="";render();openCourse(id);toast("已取消考勤标记");return}',
  '  const n=nextSession(c);',
  '  if(!n){toast("本学期这门课已没有后续排课");return}',
  '  c.attWeek=n.w;c.attDay=n.d;c.attPeriod=(PERIODS.find(p=>p.k===n.p)||{}).n||"";',
  '  render();openCourse(id);',
  '  toast("已标记：第"+n.w+"周"+DAYS[n.d]+" "+c.attPeriod+" 会考勤");',
  '}'
].join('\n') + '\n';
rep('5 下节课考勤逻辑',
  "function toggleAttNext(id){const c=course(id);c.attNext=!c.attNext;render();openCourse(id);toast(c.attNext?'已标记：下节课会考勤':'已取消考勤标记')}",
  ATT);

/* ---------- 6. 课表表头「今天」角标 ---------- */
rep('6 表头今天角标',
  "html+=`<th class=\"${t?'today':''}${du?' due':''}\">${d}<span class=\"d\">${dates[i]}</span>${du?`<span class=\"thdue\">⚠ 交作业 ${du}</span>`:''}</th>`});",
  "html+=`<th class=\"${t?'today':''}${du?' due':''}\">${d}${t?'<span class=\"tdchip\">今天</span>':''}<span class=\"d\">${dates[i]}</span>${du?`<span class=\"thdue\">⚠ 交作业 ${du}</span>`:''}</th>`});");

/* ---------- 7. 今日待办通知栏 ---------- */
const BAR = [
  '/* ============ 顶部「今天」通知栏：今天的课 / 下一节 / 要交的作业 / 逾期 / 会考勤 ============ */',
  'function todayRows(){',
  '  const cw=curWeek(), td=(NOW.getDay()+6)%7, ord={morning:0,afternoon:1,evening:2};',
  '  const curOrd=NOW.getHours()<12?0:(NOW.getHours()<17?1:2);',
  '  const inTerm=(cw>=1&&cw<=TOTAL_WEEKS&&td<NDAY);',
  '  const rows=[];',
  '  const cn=a=>{const c=course(a.c);return c?c.name:""};',
  '  /* 今天的课 + 下一节 */',
  '  const ss=inTerm?slots.filter(s=>s.d===td&&s.weeks.includes(cw)):[];',
  '  if(ss.length){',
  '    const S=ss.slice().sort((a,b)=>ord[a.p]-ord[b.p]);',
  '    rows.push({k:"课程",v:S.map(s=>PERIODS.find(p=>p.k===s.p).n+" "+cn(s)+(s.r?" · "+s.r:"")).join("　|　")});',
  '    const nx=S.find(s=>ord[s.p]>curOrd);',
  '    if(nx)rows.push({k:"下一节",v:PERIODS.find(p=>p.k===nx.p).t.split("–")[0]+" "+cn(nx)+" · "+[nx.b,nx.r].filter(Boolean).join(" "),hot:1});',
  '    else rows.push({k:"",v:"今天的课已全部结束",dim:1});',
  '  }else if(inTerm){rows.push({k:"课程",v:"今天没有课",dim:1})}',
  '  /* 今天到期 / 逾期的作业 */',
  '  assigns.filter(a=>isPending(a)&&dueInfo(a)).forEach(a=>{',
  '    const i=dueInfo(a);',
  '    if(i.w===cw&&i.di===td)rows.push({k:"今天要交",v:"《"+a.title+"》"+cn(a)+" · 今天 "+i.t+" 截止",warn:1});',
  '    else if(i.w<cw)rows.push({k:"已逾期",v:"《"+a.title+"》"+cn(a)+" · "+dueLabel(a,cw),bad:1});',
  '  });',
  '  /* 今天会考勤 */',
  '  courses.filter(c=>c.attWeek===cw&&c.attDay===td).forEach(c=>{',
  '    rows.push({k:"会考勤",v:c.name+" · 第"+c.attWeek+"周"+DAYS[c.attDay]+" "+c.attPeriod,att:1})});',
  '  /* 今天未完成的计划 */',
  '  const pl=plans.filter(p=>p.week===cw&&p.d===td&&!p.done);',
  '  if(pl.length)rows.push({k:"计划",v:pl.map(p=>p.title).join("、")+"　共 "+pl.length+" 条未完成"});',
  '  return rows;',
  '}',
  'function renderTodayBar(){',
  '  const el=document.getElementById("todayBar");if(!el)return;',
  '  const rows=todayRows();',
  '  if(!rows.length){el.style.display="none";el.innerHTML="";return}',
  '  const cw=curWeek(), td=(NOW.getDay()+6)%7;',
  '  el.style.display="block";',
  '  el.innerHTML=\'<div class="tb-hd"><span class="tb-dot"></span><b>今天 · \'+(NOW.getMonth()+1)+\'月\'+NOW.getDate()+\'日 \'+DAYS[td]+\'</b>\'',
  '    +\'<span class="tb-sub">第 \'+cw+\' 周\'+(cw===W?"":" · 正在查看第 "+W+" 周")+\'</span><span class="spacer"></span>\'',
  '    +(cw!==W?\'<button class="btn sm" onclick="gotoWeek(\'+cw+\')">回到本周</button>\':"")+\'</div>\'',
  '    +rows.map(r=>\'<div class="tb-row\'+(r.hot?" hot":"")+(r.warn?" warn":"")+(r.bad?" bad":"")+(r.att?" att":"")+(r.dim?" dim":"")+\'">\'',
  '      +(r.k?\'<span class="tb-k">\'+r.k+\'</span>\':"")+\'<span class="tb-v">\'+r.v+\'</span></div>\').join("");',
  '}'
].join('\n') + '\n';
insBefore('7 今日通知栏渲染', 'function render(){', BAR);

rep('7b render 调用通知栏',
  "function render(){\n  MODE==='term'?renderTerm():(MODE==='study'?renderStudy():renderPlan());\n  renderWeekend();syncNarrow();\n}",
  "function render(){\n  MODE==='term'?renderTerm():(MODE==='study'?renderStudy():renderPlan());\n  renderWeekend();syncNarrow();renderTodayBar();\n}");

/* ---------- 8. 课程详情里的考勤行 ---------- */
rep('8 课程详情考勤行',
  "     <div class=\"k\">下节课考勤</div><div><span class=\"attpill ${c.attNext?'set':''}\">${c.attNext?'会考勤':'未标记'}</span>\n" +
  "       <button class=\"btn sm\" style=\"margin-left:6px\" onclick=\"toggleAttNext('${id}')\">${c.attNext?'取消标记':'标记下节课考勤'}</button>\n" +
  "       <div style=\"color:var(--tx3);font-size:11.5px;margin-top:5px\">标记后，课表上这门课会显示红色「会考勤」，提醒这次别缺席。</div></div>",
  "     <div class=\"k\">下节课考勤</div><div><span class=\"attpill ${c.attWeek?'set':''}\">${c.attWeek?('第'+c.attWeek+'周'+DAYS[c.attDay]+' '+c.attPeriod+' 会考勤'):'未标记'}</span>\n" +
  "       <button class=\"btn sm\" style=\"margin-left:6px\" onclick=\"toggleAttNext('${id}')\">${c.attWeek?'取消标记':'标记下节课考勤'}</button>\n" +
  "       <div style=\"color:var(--tx3);font-size:11.5px;margin-top:5px\">点一下会自动定位这门课<b>从今天起的下一节</b>，只在那一次课（那一周的那一天那一节）显示红色「会考勤」，切到其他周次不再显示。</div></div>");

/* ---------- 9. 图例 ---------- */
rep('9 图例文案',
  '<span><i style="background:#ef4444"></i>会考勤</span>',
  '<span><i style="background:#ef4444"></i>会考勤（仅标记的那一次课）</span>');

/* ---------- 10. 初始化：载入即本周；跨天 / 回前台自动刷新 ---------- */
const INIT = [
  '/* ============ 自动跟随真实时间：载入即跳到今天所在周，跨天自动更新 ============ */',
  'function dayKey(){return NOW.getFullYear()+"-"+NOW.getMonth()+"-"+NOW.getDate()}',
  'function slotKey(){return dayKey()+"-"+curWeek()+"-"+(NOW.getHours()<12?0:(NOW.getHours()<17?1:2))}',
  'let LASTDAY=dayKey(), LASTSLOT=slotKey();',
  'W=curWeek();try{syncWeekSel()}catch(e){}',
  'function autoRefresh(){',
  '  tickNow();',
  '  const d=dayKey(), k=slotKey();',
  '  if(d!==LASTDAY){LASTDAY=d;LASTSLOT=k;W=curWeek();render();return}   /* 跨天：自动跳到今天所在周 */',
  '  if(k!==LASTSLOT){LASTSLOT=k;render()}                               /* 换时段：刷新「当前节次 / 下一节」 */',
  '}',
  'try{setInterval(autoRefresh,30000)}catch(e){}',
  'try{document.addEventListener("visibilitychange",function(){if(!document.hidden)autoRefresh()})}catch(e){}'
].join('\n') + '\n';
insBefore('10 自动跟随真实时间', 'render();\n</script>', INIT);

fs.writeFileSync(F, s);
console.log(log.join('\n'));
console.log('\n--- 残留检查 ---');
console.log('硬编码 NOW :', s.indexOf('new Date(2026,8,13') >= 0);
console.log('attNext    :', (s.match(/attNext/g) || []).length);
console.log('attWeek    :', (s.match(/attWeek/g) || []).length);
console.log('todayBar   :', (s.match(/todayBar/g) || []).length);
