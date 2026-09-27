import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
new vm.Script(read('v2/core.js'));
new vm.Script(read('v2/shell.js'));

for (const app of ['topik', 'ielts', 'hsk']) {
  const html = read(`v2/${app}/index.html`);
  assert.match(html, new RegExp(`"id":"${app}"`));
  assert.match(html, /shell\.js/);
}

const ielts = read('v2/ielts/index.html');
for (const track of ['academic-listening','academic-reading','academic-writing','academic-speaking','general-listening','general-reading','general-writing','general-speaking']) assert.ok(ielts.includes(`"${track}"`));
assert.ok(ielts.includes('Academic과 General Training을 분리'));

const hsk = read('v2/hsk/index.html');
assert.ok(hsk.includes('"lang":"zh-CN"'));
assert.ok(read('v2/core.js').includes('cleanChinese'));

const schedule = JSON.parse(read('v2/exam-schedules.json'));
for (const app of ['topik','ielts','hsk']) assert.ok(schedule[app].source.startsWith('https://'));
for (const app of ['topik','hsk']) assert.ok(schedule[app].events.length > 0);
console.log('baseline tests passed');

const shell = read('v2/shell.js');
assert.ok(shell.includes('runtime-config.js?v=217'));
assert.ok(shell.includes('patch-216.js?v=220'));
const patch = read('v2/patch-216.js');
assert.ok(patch.includes('AI_GATEWAY_NOT_CONFIGURED'));
assert.ok(patch.includes('conversation-records'));
assert.ok(patch.includes('Asia/Seoul'));
assert.ok(patch.includes('data-page="schedule"'));
assert.ok(patch.includes('customExamDate'));
for (const threshold of ['D-90', 'D-30', 'D-7']) assert.ok(read('v2/core.js').includes(threshold));
for (const app of ['topik','hsk']) for (const event of schedule[app].events) {
  assert.match(event.date, /^2026-\d{2}-\d{2}$/);
  assert.ok(event.type && event.format && event.region);
}
const worker = read('api/worker.js');
assert.ok(worker.includes('env.AI.run'), 'worker must use the Cloudflare Workers AI binding');
assert.ok(!/openai\.com|OPENAI_API_KEY/i.test(worker), 'worker must not call a paid OpenAI API');
const wrangler = read('api/wrangler.toml');
assert.match(wrangler, /\[ai\]\s*\nbinding = "AI"/);
assert.ok(!/OPENAI_API_KEY|api\.openai\.com/i.test(wrangler), 'no paid OpenAI API key or endpoint');
assert.match(wrangler, /AI_MODEL = "@cf\//, 'model must be a Cloudflare-hosted Workers AI model');
assert.ok(patch.includes('priorHistory(userText)'), 'current user turn must be sent once');
assert.ok(!read('v2/runtime-config.js').includes('sk-'));
