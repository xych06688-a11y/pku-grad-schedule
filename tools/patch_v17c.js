/* 「今天没有课 / 今天的课已全部结束」不是待办事项，不该撑开通知栏
   注意：todayRows 是 patch_v17.js 用 \n 插入的，这里必须用 \n 匹配 */
const fs = require('fs');
const F = 'C:/Users/titicaca/WorkBuddy/2026-09-13-09-23-26/prototype/index.html';
let s = fs.readFileSync(F, 'utf8');
const log = [];
function rep(name, a, b) {
  if (s.indexOf(a) < 0) { log.push('MISS: ' + name); return; }
  s = s.replace(a, b); log.push('OK  : ' + name);
}
const E = '\n';
rep('去掉「已全部结束」占位行',
  '    if(nx)rows.push({k:"下一节",v:PERIODS.find(p=>p.k===nx.p).t.split("–")[0]+" "+cn(nx)+" · "+[nx.b,nx.r].filter(Boolean).join(" "),hot:1});' + E +
  '    else rows.push({k:"",v:"今天的课已全部结束",dim:1});' + E +
  '  }else if(inTerm){rows.push({k:"课程",v:"今天没有课",dim:1})}',
  '    if(nx)rows.push({k:"下一节",v:PERIODS.find(p=>p.k===nx.p).t.split("–")[0]+" "+cn(nx)+" · "+[nx.b,nx.r].filter(Boolean).join(" "),hot:1});' + E +
  '  }');
fs.writeFileSync(F, s);
console.log(log.join('\n'));
console.log('残留「今天没有课」:', s.indexOf('今天没有课') >= 0);
console.log('残留「已全部结束」:', s.indexOf('今天的课已全部结束') >= 0);
