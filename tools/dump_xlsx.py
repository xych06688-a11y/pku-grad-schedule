# -*- coding: utf-8 -*-
import zipfile, re, sys, os
from xml.etree import ElementTree as ET

P = r"C:\Users\titicaca\WPSDrive\1870866826\WPS企业云盘\北京大学\我的企业文档\1-1课表-电子信息和MEM（26-27学年度课表）0825.xlsx"
NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
z = zipfile.ZipFile(P)
names = z.namelist()
print("SHEETS_RAW:", [n for n in names if n.startswith('xl/worksheets')])

# shared strings
shared = []
if 'xl/sharedStrings.xml' in names:
    root = ET.fromstring(z.read('xl/sharedStrings.xml'))
    for si in root.findall(NS + 'si'):
        shared.append(''.join(t.text or '' for t in si.iter(NS + 't')))

# sheet names
wb = ET.fromstring(z.read('xl/workbook.xml'))
sheets = [(s.get('name'), s.get('sheetId')) for s in wb.iter(NS + 'sheet')]
print("SHEETS:", sheets)

def colnum(ref):
    m = re.match(r'([A-Z]+)(\d+)', ref)
    c, r = m.group(1), int(m.group(2))
    n = 0
    for ch in c:
        n = n * 26 + (ord(ch) - 64)
    return n, r

def load(path):
    root = ET.fromstring(z.read(path))
    grid = {}
    maxc = maxr = 0
    for row in root.iter(NS + 'row'):
        for c in row.findall(NS + 'c'):
            ref = c.get('r'); t = c.get('t')
            cn, rn = colnum(ref)
            v = c.find(NS + 'v'); isel = c.find(NS + 'is')
            if t == 's' and v is not None:
                val = shared[int(v.text)]
            elif t == 'inlineStr' and isel is not None:
                val = ''.join(x.text or '' for x in isel.iter(NS + 't'))
            elif v is not None:
                val = v.text
            else:
                val = ''
            if val is None:
                val = ''
            val = str(val).strip()
            if val:
                grid[(rn, cn)] = val
                maxc = max(maxc, cn); maxr = max(maxr, rn)
    # merges
    merges = []
    for mc in root.iter(NS + 'mergeCell'):
        merges.append(mc.get('ref'))
    return grid, maxr, maxc, merges

sheet_files = sorted([n for n in names if n.startswith('xl/worksheets/sheet')])
for sf in sheet_files:
    g, mr, mc, merges = load(sf)
    print("\n==== %s : rows=%d cols=%d merges=%d" % (sf, mr, mc, len(merges)))
    if merges:
        print("MERGES:", merges[:40])
    for r in range(1, min(mr, 60) + 1):
        row = [g.get((r, c), '') for c in range(1, min(mc, 15) + 1)]
        if any(row):
            print(r, '|'.join(row))
