# -*- coding: utf-8 -*-
"""解析北大软微排课表 xlsx -> 生成原型可用的 JS 数据块，并写回 index.html"""
import zipfile, re, json
from xml.etree import ElementTree as ET

P = r"C:\Users\titicaca\WPSDrive\1870866826\WPS企业云盘\北京大学\我的企业文档\1-1课表-电子信息和MEM（26-27学年度课表）0825.xlsx"
HTML = r"C:\Users\titicaca\WorkBuddy\2026-09-13-09-23-26\prototype\index.html"
NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
PM = {'上午': ('08:30', '11:30'), '下午': ('14:00', '17:00'), '晚上': ('18:00', '21:00')}

def norm(s):
    s = re.sub(r'[（(]\s*0*(\d+)\s*班\s*[）)]', r'\1班', s)
    s = re.sub(r'[-–—]\s*0*(\d+)\s*班', r'\1班', s)
    s = re.sub(r'\s+', '', s)
    s = re.sub(r'[^\u4e00-\u9fa5A-Za-z0-9]', '', s)
    s = re.sub(r'0+(\d)', r'\1', s)
    return s

CHOSEN = ['云计算技术及应用', '开源软件开发基础及实践', '自然辩证法概论（01班）',
          '互联网软件开发技术与实践', '中国式现代化的理论与实践（单周）',
          '算法分析与设计（03班）', '金融产品创新应用', '素质教育与前沿技术（01班）', '综合实践（01班）']
CHOSEN_N = [norm(x) for x in CHOSEN]

z = zipfile.ZipFile(P)
shared = []
root = ET.fromstring(z.read('xl/sharedStrings.xml'))
for si in root.findall(NS + 'si'):
    shared.append(''.join(t.text or '' for t in si.iter(NS + 't')))
wb = ET.fromstring(z.read('xl/workbook.xml'))
names = [s.get('name') for s in wb.iter(NS + 'sheet')]
target = names.index('电子信息秋季') + 1
path = 'xl/worksheets/sheet%d.xml' % target

sheet = ET.fromstring(z.read(path))
grid = {}
for row in sheet.iter(NS + 'row'):
    for c in row.findall(NS + 'c'):
        ref, t, v, isel = c.get('r'), c.get('t'), c.find(NS + 'v'), c.find(NS + 'is')
        if t == 's' and v is not None:
            val = shared[int(v.text)]
        elif t == 'inlineStr' and isel is not None:
            val = ''.join(x.text or '' for x in isel.iter(NS + 't'))
        elif v is not None:
            val = v.text
        else:
            continue
        if val and str(val).strip():
            m = re.match(r'([A-Z]+)(\d+)', ref)
            cn = 0
            for ch in m.group(1):
                cn = cn * 26 + (ord(ch) - 64)
            grid[(int(m.group(2)), cn)] = str(val).strip()

def cl(r, c):
    return grid.get((r, c), '')

def clean(s):
    return re.sub(r'\s+', ' ', s.replace('：', ':').replace('～', '-').replace('~', '-').replace('—', '-')).strip()

TIME_RE = re.compile(r'(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})')

def weekinfo(note):
    n = clean(note)
    m = re.search(r'第?\s*(\d+)\s*[-~至]\s*(\d+)\s*周', n)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        return ('range', a, b, '%d-%d周' % (a, b))
    if '单周' in n:
        return ('odd', 1, 17, '单周')
    if '双周' in n:
        return ('even', 2, 18, '双周')
    return ('all', 1, 18, '1-18周')

out = []
seq = 0
for r in range(5, 60):
    code, name, teacher = cl(r, 1), cl(r, 2), cl(r, 3)
    if not name or '上课时间' in name or '校区' in name or len(name) < 2:
        continue
    hours = cl(r, 4)
    per_raw = cl(r, 5)
    note = clean(cl(r, 14))
    admin = cl(r, 13)
    hours_n = int(hours) if hours.isdigit() else 16
    wk = weekinfo(note)
    note_times = TIME_RE.findall(note)
    periods = [p for p in PM if p in per_raw] or ([None] if not per_raw else [])
    sessions = []
    for i in range(7):
        cell = cl(r, 6 + i)
        if not cell:
            continue
        klass, room = '', ''
        if '/' in cell:
            left, room = cell.split('/', 1)
            klass = left.strip()
        else:
            room = cell
        room = re.sub(r'\s+', '', room).replace('、', '|').replace('/', '|')
        room = room.strip('|')
        for pd in periods:
            s, e = PM.get(pd, ('14:00', '17:00'))
            if note_times and len(periods) == 1:
                s, e = note_times[0]
            sessions.append((i, s, e))
    # 去重（同一天同一时段多列的情况）
    sessions = sorted(set(sessions), key=lambda x: (x[0], x[1]))
    seq += 1
    nm = norm(name)
    out.append({
        'id': 'p%d' % seq, 'code': code, 'name': clean(name), 'teacher': clean(teacher) or '—',
        'hours': hours_n, 'credit': round(hours_n / 16, 1), 'admin': admin, 'note': note[:60],
        'status': '候选', 'nm': nm, 'rooms': '|'.join(sorted(set(re.sub(r'\s+', '', cl(r, 6 + i)).split('/')[-1].replace('、', '|')
                                                    for i in range(7) if cl(r, 6 + i)))),
        'times': sessions, 'wk': wk, 'raw_period': per_raw
    })

# 用户已选：每个志愿只匹配一门，避免同名的 1班/2班 被同时选中
for cn in CHOSEN_N:
    for c in out:
        if c['nm'] and (c['nm'] in cn or cn in c['nm']) and c['status'] == '候选':
            c['status'] = '已选'
            break

def js_weeks(wk):
    kind, a, b, label = wk
    if kind == 'odd':
        return "odd(1,17)"
    if kind == 'even':
        return "even(2,18)"
    return "range(%d,%d)" % (a, b)

lines = []
for c in out:
    ts = ','.join("T(%d,'%s','%s',%s,'%s')" % (d, s, e, js_weeks(c['wk']), c['wk'][3]) for d, s, e in c['times'])
    def esc(x):
        return x.replace('\\', '\\\\').replace("'", "\\'")
    cat = '必修' if '必修' in note else ('限选' if '限' in note else '选修')
    lines.append("{id:'%s',code:'%s',name:'%s',teacher:'%s',hours:%s,credit:%s,cat:'%s',admin:'%s',note:'%s',status:'%s',room:'%s',times:[%s]}"
                 % (c['id'], c['code'], esc(c['name']), esc(c['teacher']), c['hours'], c['credit'], cat,
                    esc(c['admin']), esc(c['note']), c['status'], esc(c['rooms']), ts))

block = "/*PLAN_DATA_START*/\nlet planCourses=[\n" + ",\n".join(lines) + "\n];\n/*PLAN_DATA_END*/"

html = open(HTML, encoding='utf-8').read()
new, n = re.subn(r'/\*PLAN_DATA_START\*/.*?/\*PLAN_DATA_END\*/', lambda m: block, html, flags=re.S)
assert n == 1, 'marker not found'
open(HTML, 'w', encoding='utf-8').write(new)

print('courses:', len(out))
print('sessions:', sum(len(c['times']) for c in out))
print('chosen(已选):', [c['name'] for c in out if c['status'] == '已选'])
print('no-time(待定):', [c['name'] for c in out if not c['times']])
from collections import Counter
cnt = Counter()
for c in out:
    for d, s, e in c['times']:
        cnt[DAYS[d] + ' ' + s] += 1
print('top slots:', cnt.most_common(8))
