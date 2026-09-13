const fs = require('fs'), zlib = require('zlib'), path = require('path');
const zip = process.argv[2], out = process.argv[3];
const b = fs.readFileSync(zip);
let eocd = -1;
for (let i = b.length - 22; i >= 0 && i > b.length - 66000; i--) if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
if (eocd < 0) throw new Error('not a zip');
let n = b.readUInt16LE(eocd + 10), off = b.readUInt32LE(eocd + 16);
let cnt = 0;
for (let i = 0; i < n; i++) {
  const p = off + i * 46;
  if (b.readUInt32LE(p) !== 0x02014b50) break;
  const method = b.readUInt16LE(p + 10);
  const csize = b.readUInt32LE(p + 20);
  const usize = b.readUInt32LE(p + 24);
  const nlen = b.readUInt16LE(p + 28), elen = b.readUInt16LE(p + 30), clen = b.readUInt16LE(p + 32);
  const lho = b.readUInt32LE(p + 42);
  let name = b.slice(p + 46, p + 46 + nlen).toString('utf8');
  const flags = b.readUInt16LE(p + 8);
  if (flags & 0x800) name = b.slice(p + 46, p + 46 + nlen).toString('utf8');
  let d = b.readUInt32LE(lho + 30) === 0 ? lho + 30 + b.readUInt16LE(lho + 26) + b.readUInt16LE(lho + 28) : 0;
  const lname = b.slice(lho + 30, lho + 30 + b.readUInt16LE(lho + 26)).toString('utf8');
  const local = lname.length === nlen ? lho + 30 + b.readUInt16LE(lho + 26) + b.readUInt16LE(lho + 28) : lho + 30 + b.readUInt16LE(lho + 26) + b.readUInt16LE(lho + 28);
  if (name.endsWith('/')) { fs.mkdirSync(path.join(out, name), { recursive: true }); continue; }
  const target = path.join(out, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  let data = b.slice(local, local + csize);
  if (method === 0) fs.writeFileSync(target, data);
  else if (method === 8) fs.writeFileSync(target, zlib.inflateRawSync(data));
  else { console.log('skip method', method, name); continue; }
  cnt++;
}
console.log('extracted', cnt, 'files ->', out);
