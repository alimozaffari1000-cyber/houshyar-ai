import { translate as t, getLocale } from "./i18n.js";
const HISTORY_KEY="houshyar.workspace.history.v1", PROJECTS_KEY="houshyar.workspace.projects.v1", MAX_ITEMS=30;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const read=k=>{try{const v=JSON.parse(localStorage.getItem(k)||"[]");return Array.isArray(v)?v:[]}catch{return[]}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
export function initWorkspace(app,{getMessages,onLoadConversation,onUsePrompt}){
 const opener=app.querySelector("#workspace-open");if(!opener)return;
 let tab="history";
 const panel=document.createElement("section");panel.className="workspace-overlay";panel.hidden=true;panel.setAttribute("aria-label",t("workspaceTitle"));
 panel.innerHTML='<div class="workspace-card" role="dialog" aria-modal="true" aria-labelledby="workspace-heading"><header class="workspace-head"><div><h2 id="workspace-heading">'+t("workspaceTitle")+'</h2><p>'+t("workspaceSubtitle")+'</p></div><button type="button" data-action="close" aria-label="'+t("workspaceClose")+'">✕</button></header><div class="workspace-tabs"><button type="button" data-tab="history">'+t("workspaceHistory")+'</button><button type="button" data-tab="projects">'+t("workspaceProjects")+'</button></div><div class="workspace-credit"><strong>'+t("workspaceQuotaTitle")+'</strong><p>'+t("workspaceQuotaPending")+'</p></div><div class="workspace-notice">'+t("workspaceLocalNotice")+'</div><p class="workspace-feedback" role="status"></p><div class="workspace-content"></div></div>';
 app.append(panel);
 const content=panel.querySelector(".workspace-content"),feedback=panel.querySelector(".workspace-feedback");
 function render(){
  const history=read(HISTORY_KEY),projects=read(PROJECTS_KEY);
  panel.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  if(tab==="history"){
   let html='<div class="workspace-toolbar"><button type="button" class="workspace-primary" data-action="save">'+t("workspaceSaveChat")+'</button></div>';
   if(!history.length)html+='<p class="workspace-empty">'+t("workspaceNoHistory")+'</p>';
   history.forEach(item=>{const date=new Intl.DateTimeFormat(getLocale(),{dateStyle:"medium",timeStyle:"short"}).format(new Date(item.createdAt));const first=(item.messages||[]).find(m=>m.role==="user");html+='<article class="workspace-item"><div><strong>'+esc(item.title)+'</strong><small>'+date+' · '+(item.messages||[]).length+'</small><p>'+esc(first?.text||"")+'</p></div><div class="workspace-item-actions"><button type="button" data-action="open-chat" data-id="'+esc(item.id)+'">'+t("workspaceOpenChat")+'</button><button type="button" data-action="delete-history" data-id="'+esc(item.id)+'">'+t("workspaceDelete")+'</button></div></article>'});
   content.innerHTML=html;
  }else{
   let html='<form class="workspace-project-form"><input name="title" maxlength="80" placeholder="'+t("workspaceProjectName")+'" required><textarea name="prompt" maxlength="5000" rows="3" placeholder="'+t("workspaceProjectPrompt")+'"></textarea><button class="workspace-primary" type="submit">'+t("workspaceAddProject")+'</button></form>';
   if(!projects.length)html+='<p class="workspace-empty">'+t("workspaceNoProjects")+'</p>';
   projects.forEach(item=>{const date=new Intl.DateTimeFormat(getLocale(),{dateStyle:"medium"}).format(new Date(item.createdAt));html+='<article class="workspace-item"><div><strong>'+esc(item.title)+'</strong><small>'+date+'</small><p>'+esc(item.prompt||"")+'</p></div><div class="workspace-item-actions"><button type="button" data-action="use-project" data-id="'+esc(item.id)+'">'+t("workspaceUsePrompt")+'</button><button type="button" data-action="delete-project" data-id="'+esc(item.id)+'">'+t("workspaceDelete")+'</button></div></article>'});
   content.innerHTML=html;
   content.querySelector(".workspace-project-form").addEventListener("submit",event=>{event.preventDefault();const form=event.currentTarget,title=form.elements.title.value.trim();if(!title){feedback.textContent=t("workspaceNameRequired");return}const item={id:globalThis.crypto?.randomUUID?.()||String(Date.now()),title,prompt:form.elements.prompt.value.trim(),createdAt:new Date().toISOString()};if(!write(PROJECTS_KEY,[item,...read(PROJECTS_KEY)].slice(0,MAX_ITEMS))){feedback.textContent=t("errorGeneric");return}feedback.textContent=t("workspaceProjectAdded");render()});
  }
 }
 opener.addEventListener("click",()=>{panel.hidden=false;feedback.textContent="";render()});
 panel.addEventListener("click",event=>{
  const b=event.target.closest("[data-action],[data-tab]");if(!b)return;
  if(b.dataset.tab){tab=b.dataset.tab;feedback.textContent="";render();return}
  const action=b.dataset.action,id=b.dataset.id;
  if(action==="close"){panel.hidden=true;return}
  if(action==="save"){
   const messages=getMessages().map(m=>({role:m.role,text:String(m.text||"").slice(0,12000)})).filter(m=>["user","assistant"].includes(m.role));
   if(!messages.length){feedback.textContent=t("workspaceNeedMessages");return}
   const title=(messages.find(m=>m.role==="user")?.text||t("workspaceUntitled")).slice(0,64);
   const item={id:globalThis.crypto?.randomUUID?.()||String(Date.now()),title,messages,createdAt:new Date().toISOString()};
   if(!write(HISTORY_KEY,[item,...read(HISTORY_KEY)].slice(0,MAX_ITEMS))){feedback.textContent=t("errorGeneric");return}
   feedback.textContent=t("workspaceSaved");render();return
  }
  if(action==="open-chat"){const item=read(HISTORY_KEY).find(x=>x.id===id);if(item&&Array.isArray(item.messages)){panel.hidden=true;onLoadConversation(item.messages)}return}
  if(action==="use-project"){const item=read(PROJECTS_KEY).find(x=>x.id===id);if(item){panel.hidden=true;onUsePrompt(item.prompt||item.title)}return}
  if(action==="delete-history"||action==="delete-project"){const key=action==="delete-history"?HISTORY_KEY:PROJECTS_KEY;if(write(key,read(key).filter(x=>x.id!==id))){feedback.textContent=t("workspaceDeleted");render()}else feedback.textContent=t("errorGeneric")}
 });
 panel.addEventListener("keydown",event=>{if(event.key==="Escape")panel.hidden=true});
}
