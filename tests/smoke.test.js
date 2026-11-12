import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('صفحه اصلی و ورودی برنامه وجود دارند', async () => {
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const js=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(html,/id="app"/);
  assert.match(html,/type="module"/);
  assert.match(js,/function render/);
  assert.match(js,/chat-form/);
});
test('ورودی کاربر قبل از نمایش escape می‌شود', async () => {
  const js=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(js,/escapeHTML/);
  assert.match(js,/replace\(\/\[&<>"'\]/);
});

test('پیش‌نویس پیام هنگام انتظار برای پاسخ حفظ می‌شود', async () => {
  const js=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
  assert.ok(js.includes("draft: ''"));
  assert.ok(js.includes('${escapeHTML(state.draft)}'));
  assert.ok(js.includes("prompt.addEventListener('input',()=>{state.draft=prompt.value;resize();});"));
  assert.ok(js.includes("state.draft='';\n  state.messages.push"));
});


test('scrolling chat respects the reduced-motion accessibility preference', async () => {
  const js=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(js,/prefers-reduced-motion/);
  assert.match(js,/behavior: prefersReducedMotion \? 'auto' : 'smooth'/);
  assert.ok(js.includes('scrollChat();'));
});

test('سند اصلی زبان فارسی و جهت راست‌به‌چپ را اعلام می‌کند', async () => {
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const htmlTag=html.split('\n').find(line=>line.includes('<html')) || '';
  assert.ok(htmlTag.includes('lang="fa"'));
  assert.ok(htmlTag.includes('dir="rtl"'));
});


test('workspace is connected to the home screen and keeps saved data local', async () => {
 const js=await readFile(new URL('../src/workspace.js',import.meta.url),'utf8');
 const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/initWorkspace/);
 assert.match(main,/workspace-open/);
 assert.match(js,/houshyar\.workspace\.history\.v1/);
 assert.match(js,/houshyar\.workspace\.projects\.v1/);
 assert.match(js,/localStorage/);
 assert.match(js,/workspaceSaveChat/);
});


test('workspace module is wired to the home screen and stores user data locally', async () => {
 const js=await readFile(new URL('../src/workspace.js',import.meta.url),'utf8');
 const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/initWorkspace/);
 assert.match(main,/workspace-open/);
 assert.match(js,/houshyar\.workspace\.history\.v1/);
 assert.match(js,/houshyar\.workspace\.projects\.v1/);
 assert.match(js,/localStorage/);
 assert.match(js,/workspaceSaveChat/);
});


test('response profile selector is wired to the chat request', async () => {
 const js=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 const api=await readFile(new URL('../functions/api/chat.js',import.meta.url),'utf8');
 assert.match(js,/id="response-mode"/); assert.match(js,/mode:state\.mode/);
 assert.match(api,/GROQ_MODEL_FAST/); assert.match(api,/GROQ_MODEL_DEEP/); assert.match(api,/GROQ_MODEL_CREATIVE/);
});


test('two-model comparison option is wired to the chat API', async () => {
 const js=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 const api=await readFile(new URL('../functions/api/chat.js',import.meta.url),'utf8');
 assert.match(js,/id="compare-models"/); assert.match(js,/compare:state\.compare/);
 assert.match(api,/GROQ_MODEL_COMPARE_A/); assert.match(api,/GROQ_MODEL_COMPARE_B/);
});


test('adaptive learning core uses explicit feedback and recommends a mode only after sufficient evidence', async () => {
 const learning=await import('../src/learning-core.js');
 const values=new Map();
 const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 assert.equal(learning.classifyLearningTask('این کد JavaScript را debug کن'),'developer');
 assert.equal(learning.recommendLearningMode('کد JavaScript را debug کن',storage),'balanced');
 for(let i=0;i<2;i++) assert.equal(learning.recordLearningFeedback({responseId:'deep-'+i,category:'developer',mode:'deep',rating:1},storage),true);
 assert.equal(learning.recommendLearningMode('کد JavaScript را debug کن',storage),'deep');
 assert.equal(learning.getLearningStats('developer',storage).positive,2);
 assert.equal(learning.recordLearningFeedback({responseId:'bad id',category:'developer',mode:'deep',rating:1},storage),false);
 assert.equal(learning.clearLearningFeedback(storage),true);
 assert.equal(learning.getLearningStats('developer',storage).total,0);
});

test('adaptive mode and explicit response feedback are connected to the chat UI', async () => {
 const js=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 const ui=await readFile(new URL('../src/learning-ui.js',import.meta.url),'utf8');
 assert.match(js,/recommendLearningMode/);
 assert.match(js,/mode === 'auto'/);
 assert.match(js,/attachLearningFeedback/);
 assert.match(ui,/recordLearningFeedback/);
 assert.match(ui,/Helpful/);
});
