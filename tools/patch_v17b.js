/* 补齐 patch_v17.js 中因 CRLF 未命中的 4 处 */
const fs = require('fs');
const F = 'C:/Users/titicaca/WorkBuddy/2026-09-13-09-23-26/prototype/index.html';
let s = fs.readFileSync(F, 'utf8');
const log = [];
function rep(name, a, b) {
  if (s.indexOf(a) < 0) { log.push('MISS: ' + name); return; }
  s = s.replace(a, b); log.push('OK  : ' + name);
}
const E = '\r\n';   /* 该文件主体为 CRLF */

/* 4a hwTags */
rep('4a hwTags 按周/天/节判定',
  "function hwTags(c,w){const n=hwOf(c.id,w).length;let s='';" + E +
  "  if(c.attNext)s+='<span class=\"attflag\">会考勤</span>';",
  "function hwTags(c,w,d,pk){const n=hwOf(c.id,w).length;let s='';" + E +
  "  /* 只在被标记的那一次课（第 attWeek 周 / 周 attDay / attPeriod）显示，其他周次不显示 */" + E +
  "  if(c.attWeek&&c.attWeek===w&&(d===undefined||c.attDay===d)&&(!pk||c.attPeriod===(PERIODS.find(p=>p.k===pk)||{}).n))" + E +
  "    s+='<span class=\"attflag\">会考勤</span>';");

/* 7b render */
rep('7b render 调用通知栏',
  "function render(){" + E +
  "  MODE==='term'?renderTerm():(MODE==='study'?renderStudy():renderPlan());" + E +
  "  renderWeekend();syncNarrow();" + E +
  "}",
  "function render(){" + E +
  "  MODE==='term'?renderTerm():(MODE==='study'?renderStudy():renderPlan());" + E +
  "  renderWeekend();syncNarrow();renderTodayBar();" + E +
  "}");

/* 8 课程详情考勤行 */
rep('8 课程详情考勤行',
  "     <div class=\"k\">下节课考勤</div><div><span class=\"attpill ${c.attNext?'set':''}\">${c.attNext?'会考勤':'未标记'}</span>" + E +
  "       <button class=\"btn sm\" style=\"margin-left:6px\" onclick=\"toggleAttNext('${id}')\">${c.attNext?'取消标记':'标记下节课考勤'}</button>" + E +
  "       <div style=\"color:var(--tx3);font-size:11.5px;margin-top:5px\">标记后，课表上这门课会显示红色「会考勤」，提醒这次别缺席。</div></div>",
  "     <div class=\"k\">下节课考勤</div><div><span class=\"attpill ${c.attWeek?'set':''}\">${c.attWeek?('第'+c.attWeek+'周'+DAYS[c.attDay]+' '+c.attPeriod+' 会考勤'):'未标记'}</span>" + E +
  "       <button class=\"btn sm\" style=\"margin-left:6px\" onclick=\"toggleAttNext('${id}')\">${c.attWeek?'取消标记':'标记下节课考勤'}</button>" + E +
  "       <div style=\"color:var(--tx3);font-size:11.5px;margin-top:5px\">点一下会自动定位这门课<b>从今天起的下一节</b>，只在那一次课（那一周的那一天那一节）显示红色「会考勤」，切到其他周次不再显示。</div></div>");

/* 10 自动跟随真实时间 */
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
].join(E) + E;
rep('10 自动跟随真实时间', 'render();' + E + '</script>', INIT + 'render();' + E + '</script>');

fs.writeFileSync(F, s);
console.log(log.join('\n'));
console.log('\n--- 残留检查 ---');
console.log('attNext 残留 :', (s.match(/attNext/g) || []).length);
console.log('attWeek      :', (s.match(/attWeek/g) || []).length);
console.log('todayBar     :', (s.match(/todayBar/g) || []).length);
console.log('autoRefresh  :', (s.match(/autoRefresh/g) || []).length);
console.log('renderTodayBar 调用:', (s.match(/renderTodayBar\(\)/g) || []).length);
