// Renderiza texto (salida de comandos o contenido de archivos) como una "ventana de terminal"
// y la captura a PNG con Edge headless. Uso:
//   node capture.mjs <salida.png> "<titulo>" "<comando mostrado>" <archivo-texto> [inicio] [lineas]
import { readFileSync, writeFileSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const [out, title, cmd, file, startArg, countArg] = process.argv.slice(2);
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
let lines = readFileSync(file, 'utf8').replace(/\r/g, '').split('\n');
if (lines.at(-1) === '') lines.pop();
const total = lines.length;
const start = Number(startArg ?? 1) - 1;
const count = Number(countArg ?? total);
lines = lines.slice(start, start + count);
const part = total > count ? ` (líneas ${start + 1}-${start + lines.length} de ${total})` : '';

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const colour = l => {
  if (/^\s*#{1,6} /.test(l)) return `<span class="h">${esc(l)}</span>`;
  if (/^\s*- \[[xX]\]/.test(l)) return `<span class="ok">${esc(l)}</span>`;
  if (/^\s*- \[ \]/.test(l)) return `<span class="todo">${esc(l)}</span>`;
  if (/(^PASS|\sPASS\s|✔|✓|^\s*ok \d+|^# pass)/.test(l)) return `<span class="ok">${esc(l)}</span>`;
  if (/(^FAIL|\sFAIL\s|✖|^\s*not ok|^\s*Error:|^ERROR)/.test(l)) return `<span class="bad">${esc(l)}</span>`;
  return esc(l);
};
const body = lines.map(colour).join('\n');
const W = 1280, CH = 8.2, LH = 19;
const cols = Math.floor((W - 56) / CH);
const visual = lines.reduce((n, l) => n + Math.max(1, Math.ceil(l.length / cols)), 0);
const H = Math.min(Math.max(visual * LH + 150, 260), 16000);

const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#0d1117;font:13.5px/${LH}px Consolas,"Cascadia Mono","Segoe UI Symbol","Segoe UI Emoji",monospace;color:#c9d1d9}
.bar{background:#161b22;border-bottom:1px solid #30363d;padding:9px 16px;color:#8b949e;display:flex;gap:8px;align-items:center}
.dot{width:12px;height:12px;border-radius:50%;display:inline-block}
.prompt{padding:14px 28px 0;color:#7ee787}.prompt b{color:#c9d1d9;font-weight:normal}
pre{margin:0;padding:10px 28px 24px;white-space:pre-wrap;word-break:break-word;font:inherit}
.h{color:#79c0ff;font-weight:bold}.ok{color:#7ee787}.todo{color:#d2a8ff}.bad{color:#ff7b72}
.ft{padding:0 28px 12px;color:#6e7681;font-size:12px}
</style>
<div class="bar"><span class="dot" style="background:#ff5f56"></span><span class="dot" style="background:#ffbd2e"></span><span class="dot" style="background:#27c93f"></span>
<span style="margin-left:10px">${esc(title)}${esc(part)}</span></div>
<div class="prompt">PS test-spec-kit&gt; <b>${esc(cmd)}</b></div>
<pre>${body}</pre><div class="ft">captura generada ${new Date().toISOString().slice(0, 19).replace('T', ' ')} · salida real</div>`;

try { rmSync(out); } catch {}
const dir = mkdtempSync(join(tmpdir(), 'cap-'));
const htmlPath = join(dir, 'c.html');
writeFileSync(htmlPath, html);
try { execFileSync(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${join(dir, 'profile')}`, `--window-size=${W},${H}`,
  `--screenshot=${resolve(out)}`, 'file:///' + htmlPath.split('\\').join('/')], { stdio: 'ignore', timeout: 60000 }); } catch {}
if (!existsSync(out)) { console.error('fallo la captura'); process.exit(1); }
console.log('captura:', out, `(${lines.length} líneas)`);
