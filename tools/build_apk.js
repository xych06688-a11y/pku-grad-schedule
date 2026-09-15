/* 无 Gradle 的极简 APK 构建：aapt2 -> javac -> d8 -> aapt add -> zipalign -> apksigner */
const fs = require('fs'), cp = require('child_process'), path = require('path'), zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const APP = ROOT + '/android/app/src/main';
const ASDK = ROOT + '/tools/asdk';
const AAPT2 = ASDK + '/build-tools_r30/android-11/aapt2.exe';
const AAPT = ASDK + '/build-tools_r30/android-11/aapt.exe';
const ZIPALIGN = ASDK + '/build-tools_r30/android-11/zipalign.exe';
const D8 = ASDK + '/build-tools_r30/android-11/lib/d8.jar';
const APKSIGNER = ASDK + '/build-tools_r28/android-9/lib/apksigner.jar';
const ANDROID_JAR = ASDK + '/platform-31/android-12/android.jar';
const JAVA_HOME = 'C:/Program Files/Java/jdk-1.8';
const JAVAC = JAVA_HOME + '/bin/javac.exe';
const JAVA = JAVA_HOME + '/bin/java.exe';
const KEYTOOL = JAVA_HOME + '/bin/keytool.exe';
const BUILD = ROOT + '/android/build';
const OUT = ROOT + '/android/out';

function run(cmd, cwd) {
  process.stdout.write('> ' + cmd.slice(0, 160) + (cmd.length > 160 ? ' ...' : '') + '\n');
  try {
    const o = cp.execSync(cmd, { shell: 'cmd.exe', cwd: cwd, encoding: 'utf8', maxBuffer: 1 << 28 });
    if (o && o.trim()) process.stdout.write(o.trim() + '\n');
    return true;
  } catch (e) {
    process.stdout.write('FAILED\n' + ((e.stdout || '') + (e.stderr || e.message || '')).toString().slice(0, 2500) + '\n');
    return false;
  }
}
const q = p => '"' + p.replace(/\//g, '\\') + '"';
function rm(p) { if (fs.existsSync(p)) cp.execSync('rmdir /S /Q ' + q(p) + ' || del /Q ' + q(p), { shell: 'cmd.exe' }); }

/* ---------- PNG 图标 ---------- */
function crc32(buf) {
  let c, t = [];
  for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = t[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function png(w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))
  ]);
}
function makeIcon(S) {
  const px = Buffer.alloc(S * S * 4);
  const BG = [59, 91, 219], W = [255, 255, 255], ACC = [245, 158, 11];
  const R = S * 0.20;
  const inRound = (x, y) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return false;
    let dx = 0, dy = 0;
    if (x < R) dx = R - x; else if (x > S - 1 - R) dx = x - (S - 1 - R);
    if (y < R) dy = R - y; else if (y > S - 1 - R) dy = y - (S - 1 - R);
    return dx * dx + dy * dy <= R * R;
  };
  const set = (x, y, c) => { const i = (y * S + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255; };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (inRound(x, y)) set(x, y, BG);
  const g0 = Math.round(S * 0.26), g1 = Math.round(S * 0.74), span = g1 - g0;
  const lw = Math.max(1, Math.round(S / 42));
  const line = (x0, y0, x1, y1) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++)
      if (x >= 0 && y >= 0 && x < S && y < S && inRound(x, y)) set(x, y, W);
  };
  for (let k = 0; k <= 3; k++) {
    const p = g0 + Math.round(span * k / 3);
    line(p - lw, g0, p + lw, g1);                 // 竖
    line(g0, p - lw, g1, p + lw);                 // 横
  }
  const cellW = span / 3;
  const block = (r, c, col) => {
    const x0 = Math.round(g0 + c * cellW) + lw + 1, x1 = Math.round(g0 + (c + 1) * cellW) - lw - 1;
    const y0 = Math.round(g0 + r * cellW) + lw + 1, y1 = Math.round(g0 + (r + 1) * cellW) - lw - 1;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++)
      if (x >= 0 && y >= 0 && x < S && y < S && inRound(x, y)) set(x, y, col);
  };
  block(0, 0, W); block(0, 2, W); block(1, 1, W); block(2, 0, ACC); block(2, 2, ACC);
  return png(S, S, px);
}
const DENS = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const d in DENS) {
  const dir = APP + '/res/mipmap-' + d;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dir + '/ic_launcher.png', makeIcon(DENS[d]));
}
console.log('[1/9] icons ok');

/* ---------- 清理 ---------- */
rm(BUILD); rm(OUT);
fs.mkdirSync(BUILD + '/gen', { recursive: true });
fs.mkdirSync(BUILD + '/obj', { recursive: true });
fs.mkdirSync(BUILD + '/dex', { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

/* ---------- assets ---------- */
if (!run('node ' + q(ROOT + '/tools/build_app.js'), ROOT)) process.exit(1);
fs.copyFileSync(ASDK + '/xlsx.full.min.js', APP + '/assets/xlsx.full.min.js');
console.log('[2/9] assets ok  index.html=' + fs.statSync(APP + '/assets/index.html').size +
  '  xlsx=' + fs.statSync(APP + '/assets/xlsx.full.min.js').size);

/* ---------- aapt2 compile ---------- */
if (!run(q(AAPT2) + ' compile --dir ' + q(APP + '/res') + ' -o ' + q(BUILD + '/res.zip'), ROOT)) process.exit(1);
console.log('[3/9] aapt2 compile ok');

/* ---------- aapt2 link ---------- */
const unaligned = BUILD + '/app-unaligned.apk';
if (!run(q(AAPT2) + ' link -I ' + q(ANDROID_JAR) +
  ' --manifest ' + q(APP + '/AndroidManifest.xml') +
  ' -o ' + q(unaligned) + ' ' + q(BUILD + '/res.zip') +
  ' --java ' + q(BUILD + '/gen') + ' --auto-add-overlay -A ' + q(APP + '/assets') +
  ' --min-sdk-version 21 --target-sdk-version 31 --version-code 1 --version-name 1.0', ROOT)) process.exit(1);
console.log('[4/9] aapt2 link ok');

/* ---------- javac ---------- */
const rJava = BUILD + '/gen/cn/edu/pku/schedule/R.java';
const mJava = APP + '/java/cn/edu/pku/schedule/MainActivity.java';
console.log('R.java exists:', fs.existsSync(rJava));
if (!run(q(JAVAC) + ' -encoding UTF-8 -source 8 -target 8 -nowarn -Xlint:-options -bootclasspath ' +
  q(ANDROID_JAR) + ' -d ' + q(BUILD + '/obj') + ' ' + q(rJava) + ' ' + q(mJava), ROOT)) process.exit(1);
console.log('[5/9] javac ok');

/* ---------- d8 ---------- */
const classes = fs.readdirSync(BUILD + '/obj/cn/edu/pku/schedule').filter(f => f.endsWith('.class'))
  .map(f => q(BUILD + '/obj/cn/edu/pku/schedule/' + f)).join(' ');
if (!run(q(JAVA) + ' -jar ' + q(D8) + ' --lib ' + q(ANDROID_JAR) + ' --output ' + q(BUILD + '/dex') + ' ' + classes, ROOT)) process.exit(1);
console.log('[6/9] d8 ok dex=' + fs.statSync(BUILD + '/dex/classes.dex').size);

/* ---------- 加入 dex ---------- */
if (!run(q(AAPT) + ' add -f ' + q(unaligned) + ' classes.dex', BUILD + '/dex')) process.exit(1);
console.log('[7/9] aapt add dex ok');

/* ---------- zipalign ---------- */
const aligned = BUILD + '/app-aligned.apk';
if (!run(q(ZIPALIGN) + ' -f 4 ' + q(unaligned) + ' ' + q(aligned), ROOT)) process.exit(1);

/* ---------- keystore + 签名 ---------- */
const ks = ROOT + '/android/signing.jks';
if (!fs.existsSync(ks)) {
  if (!run(q(KEYTOOL) + ' -genkeypair -keystore ' + q(ks) + ' -alias schedule -keyalg RSA -keysize 2048 -validity 10950' +
    ' -storepass schedule2026 -keypass schedule2026' +
    ' -dname "CN=Graduate Schedule, OU=Personal, O=Personal, L=Beijing, ST=Beijing, C=CN"', ROOT)) process.exit(1);
}
const signed = OUT + '/GradSchedule-v1.7.apk';
if (!run(q(JAVA) + ' -jar ' + q(APKSIGNER) + ' sign --ks ' + q(ks) + ' --ks-key-alias schedule' +
  ' --ks-pass pass:schedule2026 --key-pass pass:schedule2026 --out ' + q(signed) + ' ' + q(aligned), ROOT)) process.exit(1);
console.log('[8/9] signed ok');

if (!run(q(JAVA) + ' -jar ' + q(APKSIGNER) + ' verify --print-certs ' + q(signed), ROOT)) {
  console.log('!! verify 未通过');
}
console.log('[9/9] APK =', signed, (fs.statSync(signed).size / 1048576).toFixed(2) + 'MB');
