// 정적 검사 (브라우저 없이 GitHub Actions 에서 실행): 누락 파일 · 잘못된 import · asset 경로 · GitHub Pages base path ·
// JS 문법 · API endpoint · CORS 설정 · 프론트엔드 API KEY 노출 · Android 에서 문제가 될 수 있는 코드
// 사용: node tests/static_check.mjs   (실패 항목이 있으면 exit 1)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SKIP = new Set(['.git', 'node_modules', 'tests', 'scripts', '__pycache__', '.wrangler']);
const errors = [], warnings = [];
const err = (m) => errors.push(m), warn = (m) => warnings.push(m);
const rel = (p) => path.relative(ROOT, p);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!(e.name === 'strokes' && dir.endsWith('data'))) walk(p, out); }
    else out.push(p);
  }
  return out;
}
const files = walk(ROOT);
const html = files.filter((f) => f.endsWith('.html'));
const js = files.filter((f) => f.endsWith('.js') && !f.includes(`${path.sep}api${path.sep}`));

function exists(fromFile, ref) {
  const clean = ref.split('#')[0].split('?')[0];
  if (!clean) return true;
  let p = path.resolve(path.dirname(fromFile), decodeURI(clean));
  if (clean.endsWith('/')) p = path.join(p, 'index.html');
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  return fs.existsSync(p);
}
const isLocal = (u) => u && !/^(https?:|data:|blob:|mailto:|tel:|javascript:|#|\$\{|about:)/i.test(u) && !u.includes('${');
const PAGES_BASE = '/language-test-demo/';
// GitHub Pages 는 /language-test-demo/ 아래에서 제공된다. 그 prefix 를 이미 포함한 절대경로(예: Next.js
// basePath 빌드 산출물)는 실제로 올바른 주소이므로, prefix 없이 "/"로 시작하는 진짜 루트-절대경로만 오류로 본다.
function absolutePathExists(clean) {
  const stripped = clean.slice(PAGES_BASE.length);
  const clean2 = stripped.split('#')[0].split('?')[0];
  if (!clean2) return true;
  let p = path.join(ROOT, decodeURI(clean2));
  if (clean2.endsWith('/') || (fs.existsSync(p) && fs.statSync(p).isDirectory())) p = path.join(p, 'index.html');
  return fs.existsSync(p);
}

// 1) HTML 참조 파일 · base path
let refs = 0;
const moduleScripts = new Set(); // <script type="module" src="..."> 로 실제 로드되는 파일 (ESM 문법 허용 대상)
for (const f of html) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["']|<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*\btype=["']module["']/gi)) {
    const u = m[1] || m[2];
    if (!isLocal(u)) continue;
    const clean = u.split('#')[0].split('?')[0];
    const abs = clean.startsWith(PAGES_BASE) ? path.join(ROOT, decodeURI(clean.slice(PAGES_BASE.length))) : path.resolve(path.dirname(f), decodeURI(clean));
    moduleScripts.add(abs);
  }
  for (const m of s.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
    const u = m[1];
    if (/^http:\/\//i.test(u) && !/localhost|127\.0\.0\.1/.test(u)) err(`${rel(f)}: 보안 연결이 아닌 http:// 참조 (Android Chrome 혼합 콘텐츠 차단) → ${u}`);
    if (!isLocal(u)) continue;
    refs++;
    if (u.startsWith('/')) {
      if (!u.startsWith(PAGES_BASE)) err(`${rel(f)}: 루트 절대경로 "${u}" — GitHub Pages 는 ${PAGES_BASE} 아래에서 제공되므로 404 (올바른 prefix 없음)`);
      else if (!absolutePathExists(u.split('#')[0].split('?')[0])) err(`${rel(f)}: 절대경로 대상 누락 → ${u}`);
      continue;
    }
    if (!exists(f, u)) err(`${rel(f)}: 누락 파일 → ${u}`);
  }
  // <input type=file> 는 accept 로 파일 종류를 제한해야 Android 파일 선택기가 알맞게 열림
  for (const m of s.matchAll(/<input[^>]*type=["']?file[^>]*>/gi)) if (!/accept=/.test(m[0])) warn(`${rel(f)}: accept 없는 파일 입력 ${m[0].slice(0, 80)}`);
  // importmap
  const im = s.match(/<script type="importmap">([\s\S]*?)<\/script>/);
  if (im) {
    const map = JSON.parse(im[1]).imports;
    for (const [k, v] of Object.entries(map)) { refs++; if (!exists(f, v)) err(`${rel(f)}: importmap 대상 누락 ${k} → ${v}`); }
  }
}

// 2) JS: 문법 · 정적/동적 import · 동적 script 로더 · 코드 안의 경로
const MODULE_DIRS = [path.join(ROOT, 'hanja', 'js')];
const isModule = (f) => MODULE_DIRS.some((d) => f.startsWith(d)) || moduleScripts.has(f);
for (const f of js) {
  const s = fs.readFileSync(f, 'utf8');
  try {
    if (isModule(f)) execFileSync(process.execPath, ['--experimental-default-type=module', '--check', f], { stdio: 'pipe' });
    else new vm.Script(s, { filename: f });
  } catch (e) {
    // 고전 스크립트로 파싱했지만 실제로는 동적 import 로만 쓰이는 ES 모듈 청크일 수 있음(예: Next.js 코드-스플릿 chunk) → 모듈 문법으로 재시도
    if (!isModule(f) && /Cannot use import statement outside a module|Unexpected token ['"]?export['"]?/.test(String(e.message))) {
      try { execFileSync(process.execPath, ['--experimental-default-type=module', '--check', f], { stdio: 'pipe' }); continue; } catch (e2) { e = e2; }
    }
    err(`${rel(f)}: JS 문법 오류 ${String(e.stderr || e.message).split('\n').slice(0, 4).join(' ')}`);
  }
  if (isModule(f)) {
    for (const m of s.matchAll(/(?:import\s[^'"]*?from\s*|import\s*\(\s*|import\s+)['"](\.{1,2}\/[^'"]+)['"]/g)) { refs++; if (!exists(f, m[1])) err(`${rel(f)}: import 대상 누락 → ${m[1]}`); }
  }
  // 동적으로 붙이는 스크립트 (v2/shell.js: tts.src='../tts.js?v=…' — v2/<앱>/index.html 기준 경로)
  if (f.endsWith(`v2${path.sep}shell.js`)) {
    for (const m of s.matchAll(/\.src\s*=\s*'([^']+)'/g)) { refs++; const base = path.join(ROOT, 'v2', 'topik', 'index.html'); if (!exists(base, m[1])) err(`v2/shell.js: 동적 로드 스크립트 누락 → ${m[1]}`); }
  }
  // 프론트엔드에 비밀 키 금지
  if (/\bsk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|Bearer\s+[A-Za-z0-9._-]{20,}|api[_-]?key\s*[:=]\s*['"][A-Za-z0-9_-]{16,}/i.test(s)) err(`${rel(f)}: API KEY/토큰으로 보이는 문자열이 프론트엔드 코드에 있음`);
  if (/\bapi\.openai\.com\b/.test(s)) err(`${rel(f)}: 유료 OpenAI API 직접 호출`);
  // Android 에서 문제가 될 수 있는 코드 (경고)
  if (/(^|[^.\w])(alert|confirm|prompt)\s*\(/m.test(s.replace(/\/\/.*$/gm, ''))) warn(`${rel(f)}: alert/confirm/prompt 사용 (모바일에서 흐름을 막음)`);
  if (/document\.write\s*\(/.test(s)) warn(`${rel(f)}: document.write 사용`);
}

// 3) 한자 앱: version.json 목록 · Service Worker 버전 일치
const hv = JSON.parse(fs.readFileSync(path.join(ROOT, 'hanja', 'version.json'), 'utf8'));
for (const f of hv.files) if (!exists(path.join(ROOT, 'hanja', 'index.html'), f)) err(`hanja/version.json: 누락 파일 ${f}`);
const V = hv.v;
for (const f of ['hanja/sw.js', 'hanja/js/data.js', 'hanja/index.html']) if (!fs.readFileSync(path.join(ROOT, f), 'utf8').includes(V)) err(`${f}: 배포 버전 ${V} 불일치 (오래된 캐시가 섞일 수 있음)`);
for (const f of fs.readdirSync(path.join(ROOT, 'hanja', 'js', 'views'))) if (!hv.files.includes('js/views/' + f)) err(`hanja/version.json: 오프라인 캐시 목록에 js/views/${f} 없음`);

// 4) API endpoint · CORS 설정 (프론트엔드 ↔ Cloudflare Worker)
const rc = fs.readFileSync(path.join(ROOT, 'v2', 'runtime-config.js'), 'utf8');
const ep = (rc.match(/aiEndpoint:\s*"([^"]+)"/) || [])[1];
if (!ep || !/^https:\/\/[\w.-]+\.workers\.dev\/?$/.test(ep)) err(`v2/runtime-config.js: AI endpoint 가 Cloudflare Worker https 주소가 아님 (${ep})`);
const toml = fs.readFileSync(path.join(ROOT, 'api', 'wrangler.toml'), 'utf8');
if (!/ALLOWED_ORIGINS\s*=\s*"[^"]*https:\/\/giver11\.github\.io/.test(toml)) err('api/wrangler.toml: ALLOWED_ORIGINS 에 https://giver11.github.io 없음');
if (!/\[ai\][\s\S]*binding\s*=\s*"AI"/.test(toml)) err('api/wrangler.toml: Workers AI 바인딩 없음');
const wk = fs.readFileSync(path.join(ROOT, 'api', 'worker.js'), 'utf8');
if (/openai\.com|OPENAI_API_KEY/.test(wk)) err('api/worker.js: 유료 OpenAI API 사용');

console.log(`정적 검사: HTML ${html.length}개 · JS ${js.length}개 · 경로/참조 ${refs}개 확인`);
for (const w of warnings) console.log('::warning::' + w);
for (const e of errors) console.log('::error::' + e);
console.log(errors.length ? `FAIL ${errors.length}건` : 'PASS 정적 검사 오류 없음' + (warnings.length ? ` (경고 ${warnings.length}건)` : ''));
process.exit(errors.length ? 1 : 0);
