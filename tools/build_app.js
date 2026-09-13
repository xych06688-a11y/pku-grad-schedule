/* 由桌面原型生成移动端 APP 用 index.html：
   - 注入移动端样式（横向滚动网格 / 底部抽屉 / 触控尺寸）
   - 注入本地持久化（localStorage）
   - 注入真实 Excel 解析导入（SheetJS）
*/
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'prototype/index.html');
const OUT = path.join(ROOT, 'android/app/src/main/assets/index.html');

let html = fs.readFileSync(SRC, 'utf8');

/* ---------------- 1. viewport ---------------- */
html = html.replace(/<meta name="viewport"[^>]*>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">');

/* ---------------- 2. 移动端样式 ---------------- */
const CSS = `
  html{-webkit-text-size-adjust:100%}
  body{-webkit-tap-highlight-color:transparent;overscroll-behavior-y:contain}
  .gridwrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
  .appmore{position:fixed;right:14px;bottom:calc(18px + env(safe-area-inset-bottom));z-index:45;display:none}
  @media (max-width:900px){
    body{padding:0 0 24px}
    .wrap{max-width:100%}
    .topbar{position:sticky;top:0;z-index:40;background:var(--bg);margin:0 0 10px;padding:10px 12px;gap:8px;
      padding-top:calc(8px + env(safe-area-inset-top));border-bottom:1px solid var(--line)}
    .brand{font-size:15px;flex:1 1 100%;margin:0}
    .brand span{display:none}
    #semSel{flex:1 1 130px;min-width:110px;font-size:12px;padding:7px 8px}
    .seg button{padding:8px 12px;font-size:13px}
    .main{grid-template-columns:1fr;gap:10px;padding:0 10px}
    .card{padding:11px;border-radius:10px}
    .side .card{margin-bottom:10px}
    table.grid{min-width:640px}
    td.timecell{width:54px;padding:8px 2px;font-size:11px}
    td.timecell i{display:none}
    td.timecell b{font-size:11.5px}
    td.cell{height:86px}
    table.grid.plan td.cell{min-height:96px}
    .cls{font-size:11px;padding:4px 6px;margin:3px;border-radius:5px}
    .cls .nm{font-size:11.5px}
    .cls .mt{font-size:10px}
    .cls .wk{font-size:9px;right:3px;bottom:2px}
    .badge{top:2px;right:2px;min-width:15px;height:15px;line-height:15px;font-size:9px}
    .pcard .nm{font-size:11.5px;padding-right:30px}
    .pcard .mt{font-size:10px}
    .weekbar{gap:6px}
    .weekbar .t{font-size:14px}
    .weekbar .sub{font-size:11px}
    .btn{padding:9px 12px}
    .btn.sm{padding:6px 10px;font-size:12px}
    .notice{font-size:12px;padding:9px 11px;align-items:flex-start;margin:0 10px 10px}
    .legend{gap:8px;font-size:10.5px}
    .as{padding:9px 10px}
    .ov{display:none;padding:0;align-items:flex-end}
    .ov.on{display:flex}
    .modal{width:100%;max-width:none;border-radius:16px 16px 0 0;margin:0;max-height:86vh;
      padding:14px 14px calc(16px + env(safe-area-inset-bottom));overflow:auto}
    .modal h2{font-size:15px}
    .modal .desc{font-size:12px}
    .form,.map{grid-template-columns:1fr}
    .kv{grid-template-columns:74px 1fr}
    .toast{bottom:calc(24px + env(safe-area-inset-bottom))}
    table.tb{font-size:11.5px}
    table.tb th,table.tb td{padding:5px 6px}
    .appmore{display:block}
  }
`;
html = html.replace('</style>', CSS + '\n</style>');

/* ---------------- 3. 引入 SheetJS ---------------- */
const before = html;
html = html.replace(/<script>\s*const PAL=/, '<script src="xlsx.full.min.js"></script>\n<script>\nconst PAL=');
if (html === before) { console.error('!! SheetJS 注入失败：未匹配到主脚本起始'); process.exit(1); }

/* ---------------- 4. 移动端脚本 ---------------- */
const JS = `
(function(){
/* ============ 网格横向滚动容器 ============ */
var gEl=document.getElementById('grid');
if(gEl && gEl.parentNode.className.indexOf('gridwrap')<0){
  var wrap=document.createElement('div'); wrap.className='gridwrap';
  gEl.parentNode.insertBefore(wrap,gEl); wrap.appendChild(gEl);
}

/* ============ 本地持久化 ============ */
var KEY='gs_data_v1';
/* 优先走原生 SharedPreferences（file:// 下 localStorage 可能不可用），失败降级 localStorage */
function nsGet(){
  try{ if(window.Android&&window.Android.loadData){ var s=window.Android.loadData(); if(s) return s; } }catch(e){}
  try{ return localStorage.getItem(KEY); }catch(e){}
  return null;
}
function nsSet(v){
  try{ if(window.Android&&window.Android.saveData){ window.Android.saveData(v); return true; } }catch(e){}
  try{ localStorage.setItem(KEY,v); return true; }catch(e){}
  return false;
}
function nsClear(){
  try{ if(window.Android&&window.Android.saveData){ window.Android.saveData(''); } }catch(e){}
  try{ localStorage.removeItem(KEY); }catch(e){}
}
function put(t,s){ if(!s||!s.length) return; t.length=0; for(var i=0;i<s.length;i++) t.push(s[i]); }
function persist(){
  try{ nsSet(JSON.stringify({
    courses:courses, slots:slots, events:events, assigns:assigns,
    changes:changes, planCourses:planCourses, plans:plans, W:W })); }catch(e){}
}
function restore(){
  var raw=null; try{ raw=nsGet(); }catch(e){}
  if(!raw) return false;
  try{
    var d=JSON.parse(raw);
    put(courses,d.courses); put(slots,d.slots); put(events,d.events); put(planCourses,d.planCourses);
    if(d.assigns) assigns=d.assigns;
    if(d.changes) changes=d.changes;
    if(d.plans) plans=d.plans;
    if(typeof d.W==='number') W=d.W;
    return true;
  }catch(e){ return false; }
}
var _had=restore();
var _render=render;
render=function(){ try{persist();}catch(e){} return _render.apply(this,arguments); };

/* ============ 工具 ============ */
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function pd(n){ n=String(n); return n.length<2?'0'+n:n; }
function perOf(start){ var h=parseInt(String(start).slice(0,2),10); return h<12?'morning':(h<18?'afternoon':'evening'); }

/* ============ Excel 解析 ============ */
var PM={'上午':['08:30','11:30'],'下午':['14:00','17:00'],'晚上':['18:00','21:00']};
var DAYMAP={'一':0,'二':1,'三':2,'四':3,'五':4,'六':5,'日':6,'天':6};
var DAYLBL=['周一','周二','周三','周四','周五','周六','周日'];

function cv(r,c){ if(c==null||r==null) return ''; var v=r[c]; return v==null?'':String(v).replace(/\\s+/g,' ').trim(); }
function findHeader(rows){
  for(var i=0;i<Math.min(rows.length,25);i++){
    var r=rows[i]||[], ne=0, hit=false;
    for(var c=0;c<r.length;c++){ var s=cv(r,c); if(s) ne++; if(/课程名称|课程名/.test(s)) hit=true; }
    if(hit && ne>=3) return i;
  }
  return -1;
}
function findDayRow(rows,hdr){
  for(var i=hdr;i<Math.min(hdr+3,rows.length);i++){
    var r=rows[i]||[], map={}, cnt=0;
    for(var c=0;c<r.length;c++){
      var s=cv(r,c).replace(/\\s/g,'');
      var m=s.match(/^周\\s*([一二三四五六日天])$/);
      if(m){ map[c]=DAYMAP[m[1]]; cnt++; }
    }
    if(cnt>=3) return {row:i,map:map};
  }
  return null;
}
function mapCols(hdrRow){
  var m={};
  for(var c=0;c<hdrRow.length;c++){
    var s=cv(hdrRow,c).replace(/\\s/g,''); if(!s) continue;
    if(/课程编号/.test(s)&&m.code==null) m.code=c;
    else if(/课程名称|课程名/.test(s)&&m.name==null) m.name=c;
    else if(/教师|主讲|任课/.test(s)&&m.teacher==null) m.teacher=c;
    else if(/学时/.test(s)&&m.hours==null) m.hours=c;
    else if(/学分/.test(s)&&m.credit==null) m.credit=c;
    else if(/^时间$|^上课时间$|时段|节次/.test(s)&&m.period==null) m.period=c;
    else if(/备注|说明/.test(s)&&m.note==null) m.note=c;
    else if(/地点|教室/.test(s)&&m.room==null) m.room=c;
  }
  return m;
}
function weekInfo(note){
  var s=String(note||'');
  var m=s.match(/第?\\s*(\\d{1,2})\\s*[-~至—]\\s*(\\d{1,2})\\s*周/);
  if(m){ var a=+m[1],b=+m[2]; if(a>b){var t=a;a=b;b=t;} return {k:'range',a:a,b:b,label:a+'-'+b+'周'}; }
  var d=s.match(/(\\d{1,2})\\s*月\\s*(\\d{1,2})\\s*日开课/);
  if(d){
    try{
      var st=new Date(SEM_START+'T00:00:00');
      var dd=new Date(st.getFullYear()+'-'+pd(d[1])+'-'+pd(d[2])+'T00:00:00');
      var w=Math.floor((dd-st)/604800000)+1; if(w<1) w=1;
      return {k:'range',a:w,b:TOTAL_WEEKS,label:w+'-'+TOTAL_WEEKS+'周'};
    }catch(e){}
  }
  if(/单周/.test(s)) return {k:'odd',a:1,b:17,label:'单周'};
  if(/双周/.test(s)) return {k:'even',a:2,b:18,label:'双周'};
  return {k:'range',a:1,b:TOTAL_WEEKS,label:'1-'+TOTAL_WEEKS+'周'};
}
function weeksArr(w){
  var r=[],i;
  if(w.k==='odd'){ for(i=1;i<=17;i+=2) r.push(i); }
  else if(w.k==='even'){ for(i=2;i<=18;i+=2) r.push(i); }
  else { for(i=w.a;i<=w.b;i++) r.push(i); }
  return r;
}
function roomOf(v){ v=String(v||'').replace(/\\n/g,' ').replace(/\\s+/g,''); var a=v.split('/'); return a.length>1?a[a.length-1]:v; }
function parseRows(rows){
  var hi=findHeader(rows); if(hi<0) return null;
  var cols=mapCols(rows[hi]), dr=findDayRow(rows,hi);
  if(cols.name==null) return null;
  var out=[],seq=0;
  for(var i=hi+1;i<rows.length;i++){
    var r=rows[i]||[];
    var name=cv(r,cols.name);
    if(!name||name.length<2) continue;
    if(/上课时间|校区|星期|合计|说明|备注/.test(name)) continue;
    if(/^\\d+$/.test(name)) continue;
    if(name.length>40) continue;
    if(/[上下晚]午/.test(name) && /\\d/.test(name)) continue;
    var note=cv(r,cols.note), per=cv(r,cols.period).replace(/\\s/g,'');
    var hours=parseInt(cv(r,cols.hours),10); if(!hours) hours=16;
    var wk=weekInfo(note);
    var nt=note.match(/(\\d{1,2})\\s*[:：]\\s*(\\d{2})\\s*[-~至—]\\s*(\\d{1,2})\\s*[:：]\\s*(\\d{2})/);
    var rs=nt?(pd(nt[1])+':'+nt[2]):'', re=nt?(pd(nt[3])+':'+nt[4]):'';
    var times=[], rooms=[];
    if(dr){
      for(var key in dr.map){
        var c=key|0, v=cv(r,c); if(!v) continue;
        var st='08:30', en='11:30';
        if(rs){ st=rs; en=re; }
        else if(PM[per]){ st=PM[per][0]; en=PM[per][1]; }
        times.push({d:dr.map[key],start:st,end:en,weeks:weeksArr(wk),wk:wk.label});
        rooms.push(DAYLBL[dr.map[key]]+' '+roomOf(v));
      }
    } else if(PM[per]){
      times.push({d:0,start:PM[per][0],end:PM[per][1],weeks:weeksArr(wk),wk:wk.label});
    }
    seq++;
    out.push({ id:'x'+seq, code:cv(r,cols.code), name:name, teacher:cv(r,cols.teacher)||'—',
      hours:hours, credit:+(hours/16).toFixed(1), cat:'', admin:'', note:note.slice(0,60),
      status:'候选', room:rooms.join('；'), times:times });
  }
  return out.length?out:null;
}

/* ============ 文件选择 ============ */
function pickFile(cb){
  if(typeof XLSX==='undefined'){ toast('Excel 解析组件未加载'); return; }
  var inp=document.createElement('input');
  inp.type='file'; inp.accept='.xlsx,.xls,.csv'; inp.style.display='none';
  document.body.appendChild(inp);
  inp.onchange=function(){
    var f=inp.files&&inp.files[0];
    if(!f){ try{document.body.removeChild(inp);}catch(e){} return; }
    var fr=new FileReader();
    fr.onload=function(e){
      try{
        var wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
        cb(wb,f.name);
      }catch(err){ toast('解析失败：'+err.message); }
      try{document.body.removeChild(inp);}catch(er){}
    };
    fr.onerror=function(){ toast('读取文件失败'); try{document.body.removeChild(inp);}catch(er){} };
    fr.readAsArrayBuffer(f);
  };
  inp.click();
}
function rowsOf(wb,idx){
  var ws=wb.Sheets[wb.SheetNames[idx]];
  return XLSX.utils.sheet_to_json(ws,{header:1,defval:'',blankrows:false,raw:false});
}
function readTable(wb){
  for(var i=0;i<wb.SheetNames.length;i++){
    var rows=rowsOf(wb,i);
    if(rows.length<2) continue;
    if(findHeader(rows)>=0) return {rows:rows,name:wb.SheetNames[i]};
  }
  return {rows:rowsOf(wb,0),name:wb.SheetNames[0]};
}

/* ============ 导入预览 ============ */
var _importList=null;
function showPreview(list,sheet,file){
  _importList=list;
  var h='<h2>导入预览</h2><div class="desc">来源：'+esc(file)+' · 工作表「'+esc(sheet)+'」<br>'+
    '共识别 <b>'+list.length+'</b> 门课程。勾选你<b>已选 / 要选</b>的课程，可将它们写入学期课表。</div>';
  h+='<div style="max-height:44vh;overflow:auto;border:1px solid var(--line);border-radius:8px">';
  h+='<table class="tb"><thead><tr><th style="width:30px">选</th><th>课程</th><th>上课时间</th><th>教室</th></tr></thead><tbody>';
  for(var i=0;i<list.length;i++){
    var c=list[i];
    var t=c.times.length?c.times.map(function(x){return DAYLBL[x.d]+' '+x.start+'-'+x.end+' '+x.wk}).join('；'):'待定';
    h+='<tr><td><input type="checkbox" class="pk" data-i="'+i+'"></td><td><b>'+esc(c.name)+
       '</b><div style="font-size:10.5px;color:var(--tx3)">'+esc(c.teacher)+' · '+c.hours+'学时</div></td>'+
       '<td style="font-size:10.5px">'+esc(t)+'</td><td style="font-size:10.5px">'+esc(c.room||'—')+'</td></tr>';
  }
  h+='</tbody></table></div>';
  h+='<div class="sec">导入方式</div>';
  h+='<div style="font-size:12px;color:var(--tx2);margin-bottom:12px">「仅选课清单」把全部课程放进选课模式做冲突分析；「+ 我的课表」同时把勾选课程写入学期课表。</div>';
  h+='<div class="foot"><button class="btn" onclick="closeM()">取消</button>'+
     '<button class="btn" id="impPlan">仅更新选课清单</button>'+
     '<button class="btn pri" id="impBoth">导入 + 写入我的课表</button></div>';
  open(h);
  document.getElementById('impPlan').onclick=function(){ doImport(false); };
  document.getElementById('impBoth').onclick=function(){ doImport(true); };
}
function picked(){
  var ns=document.querySelectorAll('#modal .pk'), a=[];
  for(var i=0;i<ns.length;i++) if(ns[i].checked) a.push(+ns[i].getAttribute('data-i'));
  return a;
}
function doImport(alsoTerm){
  var list=_importList; if(!list) return;
  var picks=picked();
  planCourses.length=0;
  for(var i=0;i<list.length;i++){ list[i].id='p'+(i+1); list[i].status='候选'; planCourses.push(list[i]); }
  var dropped=0;
  if(alsoTerm){
    if(!picks.length){ toast('请先勾选要写入课表的课程'); return; }
    courses.length=0; slots.length=0;
    for(var k=0;k<picks.length;k++){
      var c=list[picks[k]], cid='c'+(k+1);
      courses.push({id:cid,name:c.name,code:c.code,teacher:c.teacher,credit:c.credit,cat:'',color:k%8});
      for(var j=0;j<c.times.length;j++){
        var t=c.times[j];
        slots.push({id:'s'+(k+1)+'_'+j,c:cid,d:t.d,p:perOf(t.start),b:'',r:c.room||'',w:t.wk,weeks:t.weeks,mode:'线下'});
      }
      c.status='已选';
    }
    var ids={}; for(var m=0;m<courses.length;m++) ids[courses[m].id]=1;
    var keep=[];
    for(var n=0;n<assigns.length;n++){ if(ids[assigns[n].c]) keep.push(assigns[n]); else dropped++; }
    assigns=keep;
  }
  closeM();
  if(alsoTerm){ setMode('term'); } else { setMode('plan'); }
  render();
  toast('已导入 '+list.length+' 门课程'+(alsoTerm?('，写入课表 '+picks.length+' 门'+(dropped?'，移除 '+dropped+' 条失效作业':'')):''));
}
function importExcel(){
  pickFile(function(wb,fn){
    var t=readTable(wb);
    var list=parseRows(t.rows);
    if(!list){ toast('未识别到课程表结构（需含「课程名称」表头）'); return; }
    showPreview(list,t.name,fn);
  });
}
function importPlanFile(){
  var h='<h2>导入选课清单</h2><div class="desc">可以导入教务的完整选课列表（Excel），或粘贴文本清单。</div>';
  h+='<div class="foot"><button class="btn" onclick="closeM()">取消</button>'+
     '<button class="btn" id="plTxt">粘贴文本清单</button>'+
     '<button class="btn pri" id="plFile">从 Excel 文件导入</button></div>';
  open(h);
  document.getElementById('plTxt').onclick=function(){ closeM(); openPlanImport(); };
  document.getElementById('plFile').onclick=function(){ importExcel(); };
}

/* ============ 更多菜单（备份 / 恢复） ============ */
function openMore(){
  var h='<h2>数据管理</h2><div class="desc">数据保存在本机 App 内。建议定期导出备份。</div>';
  h+='<div class="sec">当前状态</div><div class="kv">'+
     '<div class="k">课程</div><div>'+courses.length+' 门</div>'+
     '<div class="k">排课</div><div>'+slots.length+' 条</div>'+
     '<div class="k">作业</div><div>'+assigns.length+' 条</div>'+
     '<div class="k">学习计划</div><div>'+plans.length+' 条</div>'+
     '<div class="k">选课清单</div><div>'+planCourses.length+' 门</div></div>';
  h+='<div class="sec">操作</div>';
  h+='<div style="display:flex;flex-direction:column;gap:8px">'+
     '<button class="btn" id="mExp">导出备份（JSON）</button>'+
     '<button class="btn" id="mReset">清除本地数据，恢复内置示例</button></div>';
  h+='<div class="foot"><button class="btn pri" onclick="closeM()">关闭</button></div>';
  open(h);
  document.getElementById('mExp').onclick=function(){
    var data={courses:courses,slots:slots,events:events,assigns:assigns,changes:changes,planCourses:planCourses,plans:plans,W:W};
    var txt=JSON.stringify(data);
    if(window.Android&&window.Android.saveFile){ window.Android.saveFile('课表备份.json',txt); }
    else { try{ localStorage.setItem('gs_backup',txt); toast('已保存到 App 内部备份区'); }catch(e){ toast('导出失败'); } }
    closeM();
  };
  document.getElementById('mReset').onclick=function(){
    nsClear();
    closeM(); location.reload();
  };
}

/* ============ 绑定 ============ */
var be=document.getElementById('btnExcel'); if(be) be.onclick=importExcel;
var bp=document.getElementById('btnPlanImp'); if(bp) bp.onclick=importPlanFile;
var more=document.createElement('button');
more.className='appmore btn'; more.textContent='☰ 数据'; more.style.boxShadow='0 3px 12px rgba(0,0,0,.18)';
more.onclick=openMore; document.body.appendChild(more);

/* 暴露给自动化测试 / 调试 */
window.__pk={parseRows:parseRows,findHeader:findHeader,findDayRow:findDayRow,mapCols:mapCols,
  weekInfo:weekInfo,weeksArr:weeksArr,readTable:readTable,importExcel:importExcel,openMore:openMore};

try{ persist(); }catch(e){}
if(_had){ try{ render(); }catch(e){} }
setTimeout(function(){ try{ toast('已载入本地数据'); }catch(e){} },600);
})();
`;

html = html.replace('</body>', '<script>' + JS + '</' + 'script>\n</body>');

fs.mkdirSync(require('path').dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');
console.log('generated', OUT, html.length, 'bytes');
