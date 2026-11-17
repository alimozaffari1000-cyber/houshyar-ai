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
  assert.ok(js.includes("draft: loadDraft()"));
  assert.ok(js.includes('${escapeHTML(state.draft)}'));
  assert.ok(js.includes("prompt.addEventListener('input',()=>{state.draft=prompt.value;saveDraft(state.draft);resize();});"));
  const clearDraftIndex = js.indexOf("state.draft='';");
  const clearStoredDraftIndex = js.indexOf("clearDraft();", clearDraftIndex);
  const chooseModeIndex = js.indexOf("const learningMode = state.mode === 'auto' ? recommendLearningMode(text) : state.mode;");
  const pushMessageIndex = js.indexOf("state.messages.push({role:'user',text});");
  assert.ok(clearDraftIndex >= 0 && clearStoredDraftIndex > clearDraftIndex && chooseModeIndex > clearStoredDraftIndex && pushMessageIndex > chooseModeIndex);
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
 assert.match(js,/id="response-mode"/); assert.match(js,/mode:learningMode/);
 assert.match(js,/state\.mode === 'auto'/);
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
 // Two samples are not enough to cross the three-feedback minimum.
 assert.equal(learning.recommendLearningMode('کد JavaScript را debug کن',storage),'balanced');
 assert.equal(learning.recordLearningFeedback({responseId:'fast-1',category:'developer',mode:'fast',rating:0},storage),true);
 // At three total samples, the mode with at least two samples and the better rate wins.
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


test('mobile chat controls use a bounded responsive layout without fixed-width overflow', async () => {
 const css=await readFile(new URL('../src/style.css',import.meta.url),'utf8');
 assert.match(css,/@media\(max-width:560px\)\{\s*\.mode-control\{/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) minmax\(0,1\.35fr\)/);
 assert.match(css,/\.mode-control>select,[\s\S]*?min-width:0/);
 assert.match(css,/@media\(max-width:380px\)/);
});

test('chat draft survives reload and storage failures without exceeding the input limit', async () => {
 const draft=await import('../src/draft-storage.js');
 const values=new Map();
 const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 assert.equal(draft.loadDraft(storage),'');
 assert.equal(draft.saveDraft('پیام نیمه‌کاره',storage),true);
 assert.equal(draft.loadDraft(storage),'پیام نیمه‌کاره');
 assert.equal(draft.saveDraft('x'.repeat(7000),storage),true);
 assert.equal(draft.loadDraft(storage).length,6000);
 assert.equal(draft.clearDraft(storage),true);
 assert.equal(draft.loadDraft(storage),'');
 const broken={getItem(){throw new Error('blocked')},setItem(){throw new Error('blocked')},removeItem(){throw new Error('blocked')}};
 assert.equal(draft.loadDraft(broken),'');
 assert.equal(draft.saveDraft('safe',broken),false);
 assert.equal(draft.clearDraft(broken),false);
});

test('workspace storage normalization rejects malformed records and bounds saved content', async () => {
 const { normalizeWorkspaceHistory, normalizeWorkspaceProjects } = await import('../src/workspace.js');
 assert.deepEqual(normalizeWorkspaceHistory({}), []);
 const history = normalizeWorkspaceHistory([
  null,
  { id: 'bad-date', title: 'Bad', createdAt: 'not-a-date', messages: [{ role: 'user', text: 'x' }] },
  { id: 'bad-messages', title: 'Bad messages', createdAt: '2026-01-01T00:00:00.000Z', messages: {} },
  { id: 'ok', title: 'x'.repeat(200), createdAt: '2026-01-01T00:00:00.000Z', messages: [
   { role: 'system', text: 'must be excluded' },
   { role: 'user', text: 'y'.repeat(13000) },
   { role: 'assistant', text: 'valid answer' }
  ] }
 ]);
 assert.equal(history.length, 1);
 assert.equal(history[0].title.length, 120);
 assert.equal(history[0].messages.length, 2);
 assert.equal(history[0].messages[0].text.length, 12000);
 assert.equal(history[0].messages[1].role, 'assistant');
 assert.deepEqual(normalizeWorkspaceProjects('not-an-array'), []);
 const projects = normalizeWorkspaceProjects([
  { id: 'p1', title: '  Project  ', prompt: 'z'.repeat(6000), createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'p2', title: '   ', prompt: '', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'p3', title: 'Bad date', createdAt: 'invalid' }
 ]);
 assert.equal(projects.length, 1);
 assert.equal(projects[0].title, 'Project');
 assert.equal(projects[0].prompt.length, 5000);
});

test('workspace dialog restores focus, traps keyboard navigation, and closes on Escape or backdrop', async () => {
 const js=await readFile(new URL('../src/workspace.js',import.meta.url),'utf8');
 assert.match(js,/panel.querySelector\("\[data-action=close\]"\)\?.focus\(\)/);
 assert.match(js,/if\(event\.key==="Escape"\)\{panel\.hidden=true;opener\.focus\(\);return\}/);
 assert.match(js,/if\(event\.key!=="Tab"\)return/);
 assert.match(js,/event\.shiftKey&&document\.activeElement===first/);
 assert.match(js,/!event\.shiftKey&&document\.activeElement===last/);
 assert.match(js,/if\(event\.target===panel\)\{panel\.hidden=true;opener\.focus\(\)\}/);
});


test('workspace detects identical saved conversations and allows changed transcripts', async () => {
 const { isDuplicateWorkspaceConversation } = await import('../src/workspace.js');
 const history = [{ id: 'one', title: 'Chat', createdAt: '2026-01-01T00:00:00.000Z', messages: [{ role: 'user', text: 'hello' }, { role: 'assistant', text: 'hi' }] }];
 assert.equal(isDuplicateWorkspaceConversation(history, [{ role: 'user', text: 'hello' }, { role: 'assistant', text: 'hi' }]), true);
 assert.equal(isDuplicateWorkspaceConversation(history, [{ role: 'user', text: 'hello' }, { role: 'assistant', text: 'different' }]), false);
 assert.equal(isDuplicateWorkspaceConversation(history, []), false);
});


test('workspace prevents duplicate projects but permits distinct descriptions', async () => {
 const { isDuplicateWorkspaceProject } = await import('../src/workspace.js');
 const projects = [{ id: 'p1', title: '  Website  ', prompt: 'Build a site', createdAt: '2026-01-01T00:00:00.000Z' }];
 assert.equal(isDuplicateWorkspaceProject(projects, 'website', 'Build a site'), true);
 assert.equal(isDuplicateWorkspaceProject(projects, 'Website', 'Build a different site'), false);
 assert.equal(isDuplicateWorkspaceProject(projects, 'Another project', 'Build a site'), false);
 assert.equal(isDuplicateWorkspaceProject(projects, '', 'Build a site'), false);
});


test('workspace project duplicate detection excludes the project being edited', async () => {
 const { isDuplicateWorkspaceProject } = await import('../src/workspace.js');
 const projects = [{ id: 'p1', title: 'Website', prompt: 'Build a site', createdAt: '2026-01-01T00:00:00.000Z' }, { id: 'p2', title: 'Shop', prompt: 'Build a shop', createdAt: '2026-01-01T00:00:00.000Z' }];
 assert.equal(isDuplicateWorkspaceProject(projects, 'Website', 'Build a site', 'p1'), false);
 assert.equal(isDuplicateWorkspaceProject(projects, 'Website', 'Build a site', 'p2'), true);
 assert.equal(isDuplicateWorkspaceProject(projects, 'New name', 'New prompt', 'p1'), false);
});

test('workspace project editing is wired with escaped values and localized controls', async () => {
 const js=await readFile(new URL('../src/workspace.js',import.meta.url),'utf8');
 const i18n=await readFile(new URL('../src/i18n.js',import.meta.url),'utf8');
 assert.match(js,/data-action="edit-project"/);
 assert.match(js,/data-action="cancel-edit"/);
 assert.match(js,/esc\(editing\?\.title/);
 assert.match(js,/esc\(editing\?\.prompt/);
 for(const key of ['workspaceEdit','workspaceUpdateProject','workspaceCancelEdit','workspaceProjectUpdated']){
  assert.equal((i18n.match(new RegExp(key+':','g'))||[]).length,12,key+' must exist in all 12 locales');
 }
});


test('saved conversations can be renamed without changing their messages or creation date', async () => {
 const { renameWorkspaceConversation } = await import('../src/workspace.js');
 const messages = [{ role: 'user', text: 'hello' }, { role: 'assistant', text: 'hi' }];
 const history = [{ id: 'chat-1', title: 'Old title', createdAt: '2026-01-01T00:00:00.000Z', messages }];
 const renamed = renameWorkspaceConversation(history, 'chat-1', '  New title  ');
 assert.equal(renamed[0].title, 'New title');
 assert.equal(renamed[0].createdAt, history[0].createdAt);
 assert.deepEqual(renamed[0].messages, messages);
 assert.equal(history[0].title, 'Old title');
 assert.equal(renameWorkspaceConversation(history, 'missing', 'Name'), null);
 assert.equal(renameWorkspaceConversation(history, 'chat-1', '   '), null);
 assert.equal(renameWorkspaceConversation(history, 'chat-1', 'x'.repeat(140))[0].title.length, 120);
});

test('workspace conversation rename UI is wired and localized in all supported workspace locales', async () => {
 const js=await readFile(new URL('../src/workspace.js',import.meta.url),'utf8');
 const i18n=await readFile(new URL('../src/i18n.js',import.meta.url),'utf8');
 assert.match(js,/data-action="edit-history"/);
 assert.match(js,/data-action="cancel-history-edit"/);
 assert.match(js,/renameWorkspaceConversation/);
 assert.match(js,/workspaceConversationRenamed/);
 for(const key of ['workspaceRename','workspaceUpdateTitle','workspaceCancelRename','workspaceConversationRenamed','workspaceTitleRequired']){
  assert.equal((i18n.match(new RegExp(key+':','g'))||[]).length,12,key+' must exist in all 12 locales');
 }
});


test('saved conversation search matches titles and message content without mutating history', async () => {
 const { filterWorkspaceHistory } = await import('../src/workspace.js');
 const history = [
  { id: 'a', title: 'Travel plans', createdAt: '2026-01-01T00:00:00.000Z', messages: [{ role: 'user', text: 'Find hotels in Berlin' }] },
  { id: 'b', title: 'Cooking', createdAt: '2026-01-02T00:00:00.000Z', messages: [{ role: 'user', text: 'Make a pasta recipe' }] },
  { id: 'c', title: 'Coding', createdAt: '2026-01-03T00:00:00.000Z', messages: [{ role: 'assistant', text: 'Use JavaScript modules' }] }
 ];
 assert.deepEqual(filterWorkspaceHistory(history, 'travel').map(item => item.id), ['a']);
 assert.deepEqual(filterWorkspaceHistory(history, 'BERLIN').map(item => item.id), ['a']);
 assert.deepEqual(filterWorkspaceHistory(history, 'javascript').map(item => item.id), ['c']);
 assert.deepEqual(filterWorkspaceHistory(history, 'missing'), []);
 assert.deepEqual(filterWorkspaceHistory(history, '  ').map(item => item.id), ['a', 'b', 'c']);
 assert.equal(history[0].title, 'Travel plans');
});

test('workspace conversation search UI is wired and localized in all supported workspace locales', async () => {
 const js=await readFile(new URL('../src/workspace.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/style.css',import.meta.url),'utf8');
 const i18n=await readFile(new URL('../src/i18n.js',import.meta.url),'utf8');
 assert.match(js,/workspace-history-search/);
 assert.match(js,/filterWorkspaceHistory/);
 assert.match(js,/data-history-no-results/);
 assert.match(css,/\.workspace-history-search/);
 for(const key of ['workspaceSearchPlaceholder','workspaceSearchLabel','workspaceNoSearchResults']){
  assert.equal((i18n.match(new RegExp(key+':','g'))||[]).length,12,key+' must exist in all 12 locales');
 }
});


test('saved conversations can be sorted by newest, oldest, or title without mutating history', async () => {
 const { sortWorkspaceHistory } = await import('../src/workspace.js');
 const history = [
  { id: 'b', title: 'Beta', createdAt: '2026-01-02T00:00:00.000Z', messages: [{ role: 'user', text: 'b' }] },
  { id: 'a', title: 'Alpha', createdAt: '2026-01-01T00:00:00.000Z', messages: [{ role: 'user', text: 'a' }] },
  { id: 'c', title: 'Gamma', createdAt: '2026-01-03T00:00:00.000Z', messages: [{ role: 'user', text: 'c' }] }
 ];
 assert.deepEqual(sortWorkspaceHistory(history, 'newest').map(item => item.id), ['c', 'b', 'a']);
 assert.deepEqual(sortWorkspaceHistory(history, 'oldest').map(item => item.id), ['a', 'b', 'c']);
 assert.deepEqual(sortWorkspaceHistory(history, 'title').map(item => item.id), ['a', 'b', 'c']);
 assert.deepEqual(sortWorkspaceHistory(history, 'unexpected').map(item => item.id), ['c', 'b', 'a']);
 assert.deepEqual(history.map(item => item.id), ['b', 'a', 'c']);
});

test('workspace conversation sorting controls are wired and localized in all supported locales', async () => {
 const js=await readFile(new URL('../src/workspace.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../src/style.css',import.meta.url),'utf8');
 const i18n=await readFile(new URL('../src/i18n.js',import.meta.url),'utf8');
 assert.match(js,/workspace-history-sort/);
 assert.match(js,/sortWorkspaceHistory/);
 assert.match(css,/\.workspace-history-sort/);
 for(const key of ['workspaceSortLabel','workspaceSortNewest','workspaceSortOldest','workspaceSortTitle']) assert.equal((i18n.match(new RegExp(key+':','g'))||[]).length,12,key+' must exist in all 12 locales');
});


test('workspace bulk conversation removal is explicit, bounded, and does not mutate source history', async () => {
 const { removeWorkspaceConversations } = await import('../src/workspace.js');
 const history = [
  { id: 'a', title: 'A', createdAt: '2026-01-01T00:00:00.000Z', messages: [{ role: 'user', text: 'a' }] },
  { id: 'b', title: 'B', createdAt: '2026-01-02T00:00:00.000Z', messages: [{ role: 'user', text: 'b' }] },
  { id: 'c', title: 'C', createdAt: '2026-01-03T00:00:00.000Z', messages: [{ role: 'user', text: 'c' }] }
 ];
 assert.deepEqual(removeWorkspaceConversations(history, ['a', 'c']).map(item => item.id), ['b']);
 assert.deepEqual(removeWorkspaceConversations(history, []).map(item => item.id), ['a', 'b', 'c']);
 assert.deepEqual(history.map(item => item.id), ['a', 'b', 'c']);
});

test('workspace bulk deletion requires an explicit confirmation UI and localized controls', async () => {
 const js=await readFile(new URL('../src/workspace.js',import.meta.url),'utf8');
 const i18n=await readFile(new URL('../src/i18n.js',import.meta.url),'utf8');
 assert.match(js,/data-action="request-bulk-delete"/);
 assert.match(js,/data-action="confirm-bulk-delete"/);
 assert.match(js,/data-action="cancel-bulk-delete"/);
 assert.match(js,/removeWorkspaceConversations/);
 for(const key of ['workspaceSelectConversation','workspaceSelectAll','workspaceClearSelection','workspaceDeleteSelected','workspaceBulkDeletePrompt','workspaceConfirmDelete','workspaceCancelBulkDelete','workspaceBulkDeleted']) assert.equal((i18n.match(new RegExp(key+':','g'))||[]).length,12,key+' must exist in all 12 locales');
});


test('workspace backup validates format and merges without overwriting existing records', async () => {
 const { createWorkspaceBackup, mergeWorkspaceBackup } = await import('../src/workspace.js');
 const existingHistory=[{id:'same',title:'Keep me',createdAt:'2026-01-01T00:00:00.000Z',messages:[{role:'user',text:'existing'}]}];
 const existingProjects=[{id:'p-same',title:'Keep project',prompt:'existing',createdAt:'2026-01-01T00:00:00.000Z'}];
 const backup=createWorkspaceBackup([
  {id:'same',title:'Do not overwrite',createdAt:'2026-01-02T00:00:00.000Z',messages:[{role:'user',text:'changed'}]},
  {id:'new',title:'New chat',createdAt:'2026-01-03T00:00:00.000Z',messages:[{role:'user',text:'new'}]}
 ],[
  {id:'p-same',title:'Overwrite attempt',prompt:'changed',createdAt:'2026-01-02T00:00:00.000Z'},
  {id:'p-new',title:'New project',prompt:'new',createdAt:'2026-01-03T00:00:00.000Z'}
 ]);
 const merged=mergeWorkspaceBackup(existingHistory,existingProjects,backup);
 assert.deepEqual(merged.history.map(x=>x.id),['same','new']);
 assert.equal(merged.history[0].title,'Keep me');
 assert.equal(merged.projects[0].title,'Keep project');
 assert.equal(merged.addedHistory,1);
 assert.equal(merged.addedProjects,1);
 assert.equal(mergeWorkspaceBackup(existingHistory,existingProjects,{format:'other',version:1,history:[],projects:[]}),null);
 assert.equal(mergeWorkspaceBackup(existingHistory,existingProjects,{format:'houshyar-workspace-backup',version:2,history:[],projects:[]}),null);
 assert.equal(mergeWorkspaceBackup(existingHistory,existingProjects,{format:'houshyar-workspace-backup',version:1,history:{},projects:[]}),null);
});

test('workspace backup never evicts existing records when the local quota is full', async () => {
 const { mergeWorkspaceBackup } = await import('../src/workspace.js');
 const history=Array.from({length:30},(_,i)=>({id:'h'+i,title:'Chat '+i,createdAt:'2026-01-01T00:00:00.000Z',messages:[{role:'user',text:'m'+i}]}));
 const projects=Array.from({length:30},(_,i)=>({id:'p'+i,title:'Project '+i,prompt:'p'+i,createdAt:'2026-01-01T00:00:00.000Z'}));
 const result=mergeWorkspaceBackup(history,projects,{format:'houshyar-workspace-backup',version:1,history:[{id:'incoming',title:'Incoming',createdAt:'2026-01-02T00:00:00.000Z',messages:[{role:'user',text:'incoming'}]}],projects:[{id:'incoming-p',title:'Incoming project',prompt:'x',createdAt:'2026-01-02T00:00:00.000Z'}]});
 assert.equal(result.history.length,30);assert.equal(result.projects.length,30);
 assert.equal(result.history[0].id,'h0');assert.equal(result.projects[0].id,'p0');
 assert.equal(result.addedHistory,0);assert.equal(result.addedProjects,0);
});

test('workspace backup controls are localized and restore is merge-only', async () => {
 const js=await readFile(new URL('../src/workspace.js',import.meta.url),'utf8');
 const i18n=await readFile(new URL('../src/i18n.js',import.meta.url),'utf8');
 assert.match(js,/data-action="export-backup"/);assert.match(js,/data-action="import-backup"/);
 assert.match(js,/mergeWorkspaceBackup/);assert.match(js,/file\.size>1024\*1024/);
 for(const key of ['workspaceExportBackup','workspaceImportBackup','workspaceBackupExported','workspaceBackupInvalid','workspaceBackupTooLarge','workspaceBackupImported'])assert.equal((i18n.match(new RegExp(key+':','g'))||[]).length,12,key+' must exist in all 12 locales');
});
