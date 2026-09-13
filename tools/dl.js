const fs = require('fs'), https = require('https'), path = require('path');
const DIR = path.join(__dirname, 'asdk');
fs.mkdirSync(DIR, { recursive: true });

function get(url, file, redir) {
  return new Promise((res, rej) => {
    const f = fs.createWriteStream(file);
    https.get(url, { timeout: 30000 }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        f.close(); fs.unlinkSync(file);
        return get(new URL(r.headers.location, url).href, file, (redir || 0) + 1).then(res, rej);
      }
      if (r.statusCode !== 200) { f.close(); return rej(new Error('HTTP ' + r.statusCode + ' ' + url)); }
      let got = 0, last = Date.now();
      r.on('data', d => {
        got += d.length; f.write(d);
        if (Date.now() - last > 5000) { last = Date.now(); console.log('  ...' + (got / 1048576).toFixed(1) + 'MB ' + path.basename(file)); }
      });
      r.on('end', () => f.end(() => res(got)));
      r.on('error', e => { f.close(); rej(e); });
    }).on('error', e => rej(e));
  });
}

(async () => {
  const jobs = JSON.parse(process.argv[2]);
  for (const j of jobs) {
    const out = path.join(DIR, j.n);
    if (fs.existsSync(out) && fs.statSync(out).size > 1000) { console.log('skip', j.n); continue; }
    console.log('downloading', j.n, j.u);
    try { const n = await get(j.u, out); console.log('done', j.n, (n / 1048576).toFixed(1) + 'MB'); }
    catch (e) { console.log('FAIL', j.n, e.message); }
  }
  console.log('ALLDONE');
})();
