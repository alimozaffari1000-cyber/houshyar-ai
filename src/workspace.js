import { translate as t, getLocale } from "./i18n.js";
const HISTORY_KEY="houshyar.workspace.history.v1", PROJECTS_KEY="houshyar.workspace.projects.v1", MAX_ITEMS=30;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const validDate=value=>typeof value==="string"&&Number.isFinite(Date.parse(value));
export function normalizeWorkspaceHistory(value){
 if(!Array.isArray(value))return[];
 return value.filter(item=>item&&typeof item==="object"&&typeof item.id==="string"&&typeof item.title==="string"&&validDate(item.createdAt)&&Array.isArray(item.messages))
  .map(item=>({...item,title:item.title.slice(0,120),messages:item.messages.filter(m=>m&&["user","assistant"].includes(m.role)&&typeof m.text==="string").slice(-50).map(m=>({role:m.role,text:m.text.slice(0,12000)}))}))
  .filter(item=>item.messages.length>0).slice(0,MAX_ITEMS);
}
export function sortWorkspaceHistory(history,order="newest"){
 const normalized=normalizeWorkspaceHistory(history);
 const sorted=[...normalized];
 if(order==="oldest")return sorted.sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
 if(order==="title")return sorted.sort((a,b)=>a.title.localeCompare(b.title,getLocale(),{sensitivity:"base"}));
 return sorted.sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
}
export function removeWorkspaceConversations(history,ids){
 const selected=new Set(Array.isArray(ids)?ids.filter(id=>typeof id==="string"):[]);
 if(!selected.size)return normalizeWorkspaceHistory(history);
 return normalizeWorkspaceHistory(history).filter(item=>!selected.has(item.id));
}
export function filterWorkspaceHistory(history,query){
 const term=String(query??"").trim().toLocaleLowerCase();
 const normalized=normalizeWorkspaceHistory(history);
 if(!term)return normalized;
 return normalized.filter(item=>item.title.toLocaleLowerCase().includes(term)||item.messages.some(message=>message.text.toLocaleLowerCase().includes(term)));
}
export function isDuplicateWorkspaceConversation(history,messages){
 if(!Array.isArray(history)||!Array.isArray(messages)||!messages.length)return false;
 const snapshot=messages.map(m=>({role:m.role,text:String(m.text??"").slice(0,12000)})).filter(m=>["user","assistant"].includes(m.role));
 if(!snapshot.length)return false;
 return normalizeWorkspaceHistory(history).some(item=>item.messages.length===snapshot.length&&item.messages.every((m,index)=>m.role===snapshot[index].role&&m.text===snapshot[index].text));
}
export function renameWorkspaceConversation(history,id,title){
 const nextTitle=String(title??"").trim().slice(0,120);
 if(!id||!nextTitle||!Array.isArray(history))return null;
 const normalized=normalizeWorkspaceHistory(history);
 if(!normalized.some(item=>item.id===id))return null;
 return normalized.map(item=>item.id===id?{...item,title:nextTitle}:item);
}
export function isDuplicateWorkspaceProject(projects,title,prompt,excludeId=""){
 const normalizedTitle=String(title??"").trim().toLocaleLowerCase();
 const normalizedPrompt=String(prompt??"").trim();
 if(!Array.isArray(projects)||!normalizedTitle)return false;
 return normalizeWorkspaceProjects(projects).some(item=>item.id!==excludeId&&item.title.trim().toLocaleLowerCase()===normalizedTitle&&item.prompt.trim()===normalizedPrompt);
}
export function normalizeWorkspaceProjects(value){
 if(!Array.isArray(value))return[];
 return value.filter(item=>item&&typeof item==="object"&&typeof item.id==="string"&&typeof item.title==="string"&&validDate(item.createdAt))
  .map(item=>({id:item.id,title:item.title.trim().slice(0,80),prompt:typeof item.prompt==="string"?item.prompt.slice(0,5000):"",createdAt:item.createdAt}))
  .filter(item=>item.title.length>0).slice(0,MAX_ITEMS);
}
const read=k=>{try{const v=JSON.parse(localStorage.getItem(k)||"[]");return k===HISTORY_KEY?normalizeWorkspaceHistory(v):normalizeWorkspaceProjects(v)}catch{return[]}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
const formatDate=(value,options)=>{const date=new Date(value);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat(getLocale(),options).format(date):""};
export function initWorkspace(app,{getMessages,onLoadConversation,onUsePrompt}){
 const opener=app.querySelector("#workspace-open");if(!opener)return;
 let tab="history",editingProjectId="",editingHistoryId="",historySortOrder="newest",selectedHistoryIds=new Set(),confirmBulkDelete=false;
 const panel=document.createElement("section");panel.className="workspace-overlay";panel.hidden=true;panel.setAttribute("aria-label",t("workspaceTitle"));
 panel.innerHTML='<div class="workspace-card" role="dialog" aria-modal="true" aria-labelledby="workspace-heading"><header class="workspace-head"><div><h2 id="workspace-heading">'+t("workspaceTitle")+'</h2><p>'+t("workspaceSubtitle")+'</p></div><button type="button" data-action="close" aria-label="'+t("workspaceClose")+'">✕</button></header><div class="workspace-tabs"><button type="button" data-tab="history">'+t("workspaceHistory")+'</button><button type="button" data-tab="projects">'+t("workspaceProjects")+'</button></div><div class="workspace-credit"><strong>'+t("workspaceQuotaTitle")+'</strong><p>'+t("workspaceQuotaPending")+'</p></div><div class="workspace-notice">'+t("workspaceLocalNotice")+'</div><p class="workspace-feedback" role="status"></p><div class="workspace-content"></div></div>';
 app.append(panel);
 const content=panel.querySelector(".workspace-content"),feedback=panel.querySelector(".workspace-feedback");
 function render(){
  const history=read(HISTORY_KEY),projects=read(PROJECTS_KEY);
  panel.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  if(tab==="history"){
   const editing=history.find(item=>item.id===editingHistoryId);
   let html='<div class="workspace-toolbar"><button type="button" class="workspace-primary" data-action="save">'+t("workspaceSaveChat")+'</button><label class="workspace-sort-label" for="workspace-history-sort">'+t("workspaceSortLabel")+'</label><select id="workspace-history-sort" class="workspace-history-sort" aria-label="'+t("workspaceSortLabel")+'"><option value="newest"'+(historySortOrder==="newest"?' selected':'')+'>'+t("workspaceSortNewest")+'</option><option value="oldest"'+(historySortOrder==="oldest"?' selected':'')+'>'+t("workspaceSortOldest")+'</option><option value="title"'+(historySortOrder==="title"?' selected':'')+'>'+t("workspaceSortTitle")+'</option></select><button type="button" data-action="select-all-history">'+t("workspaceSelectAll")+'</button><button type="button" data-action="clear-history-selection">'+t("workspaceClearSelection")+'</button><button type="button" data-action="request-bulk-delete"'+(selectedHistoryIds.size?'':' disabled')+'>'+t("workspaceDeleteSelected")+' ('+selectedHistoryIds.size+')</button></div><input class="workspace-history-search" type="search" aria-label="'+t("workspaceSearchLabel")+'" placeholder="'+t("workspaceSearchPlaceholder")+'" autocomplete="off">';
   if(editing)html+='<form class="workspace-history-form"><input name="title" maxlength="120" value="'+esc(editing.title)+'" required><div class="workspace-form-actions"><button class="workspace-primary" type="submit">'+t("workspaceUpdateTitle")+'</button><button type="button" data-action="cancel-history-edit">'+t("workspaceCancelRename")+'</button></div></form>';
   if(confirmBulkDelete&&selectedHistoryIds.size)html+='<div class="workspace-bulk-confirm" role="group"><p>'+t("workspaceBulkDeletePrompt")+' ('+selectedHistoryIds.size+')</p><button type="button" class="workspace-danger" data-action="confirm-bulk-delete">'+t("workspaceConfirmDelete")+'</button><button type="button" data-action="cancel-bulk-delete">'+t("workspaceCancelBulkDelete")+'</button></div>';
   if(!history.length)html+='<p class="workspace-empty">'+t("workspaceNoHistory")+'</p>';
   sortWorkspaceHistory(history,historySortOrder).forEach(item=>{const date=formatDate(item.createdAt,{dateStyle:"medium",timeStyle:"short"});const first=(item.messages||[]).find(m=>m.role==="user");html+='<article class="workspace-item" data-history-item="'+esc(item.id)+'"><div><label class="workspace-select-label"><input type="checkbox" data-select-history="'+esc(item.id)+'"'+(selectedHistoryIds.has(item.id)?' checked':'')+' aria-label="'+esc(t("workspaceSelectConversation"))+': '+esc(item.title)+'"> '+t("workspaceSelectConversation")+'</label><strong>'+esc(item.title)+'</strong><small>'+date+' · '+(item.messages||[]).length+'</small><p>'+esc(first?.text||"")+'</p></div><div class="workspace-item-actions"><button type="button" data-action="open-chat" data-id="'+esc(item.id)+'">'+t("workspaceOpenChat")+'</button><button type="button" data-action="edit-history" data-id="'+esc(item.id)+'">'+t("workspaceRename")+'</button><button type="button" data-action="delete-history" data-id="'+esc(item.id)+'">'+t("workspaceDelete")+'</button></div></article>'});
   if(history.length)html+='<p class="workspace-empty" data-history-no-results hidden>'+t("workspaceNoSearchResults")+'</p>';
   content.innerHTML=html;
   const search=content.querySelector(".workspace-history-search"),sort=content.querySelector(".workspace-history-sort"),noResults=content.querySelector("[data-history-no-results]");
   sort?.addEventListener("change",()=>{historySortOrder=["newest","oldest","title"].includes(sort.value)?sort.value:"newest";render()});
   search?.addEventListener("input",()=>{const matches=new Set(filterWorkspaceHistory(history,search.value).map(item=>item.id));content.querySelectorAll("[data-history-item]").forEach(item=>{item.hidden=!matches.has(item.dataset.historyItem)});if(noResults)noResults.hidden=matches.size>0});
   content.querySelectorAll("[data-select-history]").forEach(box=>box.addEventListener("change",()=>{if(box.checked)selectedHistoryIds.add(box.dataset.selectHistory);else selectedHistoryIds.delete(box.dataset.selectHistory);const bulk=content.querySelector('[data-action="request-bulk-delete"]');if(bulk){bulk.disabled=!selectedHistoryIds.size;bulk.textContent=t("workspaceDeleteSelected")+" ("+selectedHistoryIds.size+")"}}));
   const historyForm=content.querySelector(".workspace-history-form");
   historyForm?.addEventListener("submit",event=>{event.preventDefault();const title=event.currentTarget.elements.title.value.trim();if(!title){feedback.textContent=t("workspaceTitleRequired");return}const saved=read(HISTORY_KEY),current=saved.find(item=>item.id===editingHistoryId);if(!current){editingHistoryId="";render();return}const next=renameWorkspaceConversation(saved,editingHistoryId,title);if(!next||!write(HISTORY_KEY,next)){feedback.textContent=t("errorGeneric");return}editingHistoryId="";feedback.textContent=t("workspaceConversationRenamed");render()});
  }else{
   const editing=projects.find(item=>item.id===editingProjectId);
   let html='<form class="workspace-project-form"><input name="title" maxlength="80" placeholder="'+t("workspaceProjectName")+'" value="'+esc(editing?.title||"")+'" required><textarea name="prompt" maxlength="5000" rows="3" placeholder="'+t("workspaceProjectPrompt")+'">'+esc(editing?.prompt||"")+'</textarea><div class="workspace-form-actions"><button class="workspace-primary" type="submit">'+t(editing?"workspaceUpdateProject":"workspaceAddProject")+'</button>'+(editing?'<button type="button" data-action="cancel-edit">'+t("workspaceCancelEdit")+'</button>':'')+'</div></form>';
   if(!projects.length)html+='<p class="workspace-empty">'+t("workspaceNoProjects")+'</p>';
   projects.forEach(item=>{const date=formatDate(item.createdAt,{dateStyle:"medium"});html+='<article class="workspace-item"><div><strong>'+esc(item.title)+'</strong><small>'+date+'</small><p>'+esc(item.prompt||"")+'</p></div><div class="workspace-item-actions"><button type="button" data-action="use-project" data-id="'+esc(item.id)+'">'+t("workspaceUsePrompt")+'</button><button type="button" data-action="edit-project" data-id="'+esc(item.id)+'">'+t("workspaceEdit")+'</button><button type="button" data-action="delete-project" data-id="'+esc(item.id)+'">'+t("workspaceDelete")+'</button></div></article>'});
   content.innerHTML=html;
   content.querySelector(".workspace-project-form").addEventListener("submit",event=>{event.preventDefault();const form=event.currentTarget,title=form.elements.title.value.trim(),prompt=form.elements.prompt.value.trim();if(!title){feedback.textContent=t("workspaceNameRequired");return}const savedProjects=read(PROJECTS_KEY),editing=savedProjects.find(item=>item.id===editingProjectId);if(isDuplicateWorkspaceProject(savedProjects,title,prompt,editingProjectId)){feedback.textContent=t("workspaceProjectAlreadyExists");return}if(editing){const next=savedProjects.map(item=>item.id===editingProjectId?{...item,title,prompt}:item);if(!write(PROJECTS_KEY,next)){feedback.textContent=t("errorGeneric");return}editingProjectId="";feedback.textContent=t("workspaceProjectUpdated")}else{const item={id:globalThis.crypto?.randomUUID?.()||String(Date.now()),title,prompt,createdAt:new Date().toISOString()};if(!write(PROJECTS_KEY,[item,...savedProjects].slice(0,MAX_ITEMS))){feedback.textContent=t("errorGeneric");return}feedback.textContent=t("workspaceProjectAdded")}render()});
  }
 }
 opener.addEventListener("click",()=>{panel.hidden=false;feedback.textContent="";render();panel.querySelector("[data-action=close]")?.focus()});
 panel.addEventListener("click",event=>{
  const b=event.target.closest("[data-action],[data-tab]");if(!b)return;
  if(b.dataset.tab){tab=b.dataset.tab;feedback.textContent="";render();return}
  const action=b.dataset.action,id=b.dataset.id;
  if(action==="close"){panel.hidden=true;opener.focus();return}
  if(action==="select-all-history"){content.querySelectorAll("[data-select-history]").forEach(box=>{if(!box.closest("[data-history-item]")?.hidden){box.checked=true;selectedHistoryIds.add(box.dataset.selectHistory)}});const bulk=content.querySelector('[data-action="request-bulk-delete"]');if(bulk){bulk.disabled=!selectedHistoryIds.size;bulk.textContent=t("workspaceDeleteSelected")+" ("+selectedHistoryIds.size+")"}return}
  if(action==="clear-history-selection"){selectedHistoryIds.clear();confirmBulkDelete=false;render();return}
  if(action==="request-bulk-delete"){if(selectedHistoryIds.size){confirmBulkDelete=true;render()}return}
  if(action==="cancel-bulk-delete"){confirmBulkDelete=false;render();return}
  if(action==="confirm-bulk-delete"){const saved=read(HISTORY_KEY),next=removeWorkspaceConversations(saved,[...selectedHistoryIds]);if(!write(HISTORY_KEY,next)){feedback.textContent=t("errorGeneric");return}const removed=saved.length-next.length;selectedHistoryIds.clear();confirmBulkDelete=false;editingHistoryId="";feedback.textContent=t("workspaceBulkDeleted")+" ("+removed+")";render();return}
  if(action==="save"){
   const messages=getMessages().map(m=>({role:m.role,text:String(m.text||"").slice(0,12000)})).filter(m=>["user","assistant"].includes(m.role));
   if(!messages.length){feedback.textContent=t("workspaceNeedMessages");return}
   const title=(messages.find(m=>m.role==="user")?.text||t("workspaceUntitled")).slice(0,64);
   const history=read(HISTORY_KEY);
   if(isDuplicateWorkspaceConversation(history,messages)){feedback.textContent=t("workspaceAlreadySaved");return}
   const item={id:globalThis.crypto?.randomUUID?.()||String(Date.now()),title,messages,createdAt:new Date().toISOString()};
   if(!write(HISTORY_KEY,[item,...history].slice(0,MAX_ITEMS))){feedback.textContent=t("errorGeneric");return}
   feedback.textContent=t("workspaceSaved");render();return
  }
  if(action==="open-chat"){const item=read(HISTORY_KEY).find(x=>x.id===id);if(item&&Array.isArray(item.messages)){panel.hidden=true;onLoadConversation(item.messages)}return}
  if(action==="edit-history"){editingHistoryId=id;feedback.textContent="";render();content.querySelector(".workspace-history-form [name=title]")?.focus();return}
  if(action==="cancel-history-edit"){editingHistoryId="";feedback.textContent="";render();return}
  if(action==="edit-project"){editingProjectId=id;feedback.textContent="";render();content.querySelector('[name="title"]')?.focus();return}
  if(action==="cancel-edit"){editingProjectId="";feedback.textContent="";render();return}
  if(action==="use-project"){const item=read(PROJECTS_KEY).find(x=>x.id===id);if(item){panel.hidden=true;onUsePrompt(item.prompt||item.title)}return}
  if(action==="delete-history"||action==="delete-project"){const key=action==="delete-history"?HISTORY_KEY:PROJECTS_KEY;if(action==="delete-project"&&editingProjectId===id)editingProjectId="";if(action==="delete-history"&&editingHistoryId===id)editingHistoryId="";if(action==="delete-history"){selectedHistoryIds.delete(id);confirmBulkDelete=false}if(write(key,read(key).filter(x=>x.id!==id))){feedback.textContent=t("workspaceDeleted");render()}else feedback.textContent=t("errorGeneric")}
 });
 panel.addEventListener("keydown",event=>{
  if(event.key==="Escape"){panel.hidden=true;opener.focus();return}
  if(event.key!=="Tab")return;
  const focusable=[...panel.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(el=>!el.hidden);
  if(!focusable.length){event.preventDefault();return}
  const first=focusable[0],last=focusable[focusable.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
 });
 panel.addEventListener("click",event=>{if(event.target===panel){panel.hidden=true;opener.focus()}});

}
