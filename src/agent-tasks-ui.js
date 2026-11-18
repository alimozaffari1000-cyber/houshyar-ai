const LABELS = {
  fa: { title:"مرکز وظایف عامل‌ها", subtitle:"وظایف در صف امن حساب شما ذخیره می‌شوند؛ اجرای خودکار هنوز فعال نیست.", close:"بستن", refresh:"به‌روزرسانی", create:"ثبت وظیفه", taskTitle:"عنوان وظیفه", input:"شرح کاری که باید انجام شود", agent:"عامل مسئول", priority:"اولویت", queued:"در صف", in_progress:"در حال اجرا", awaiting_approval:"نیازمند تأیید", completed:"تکمیل‌شده", failed:"ناموفق", cancelled:"لغوشده", empty:"هنوز وظیفه‌ای ثبت نشده است.", loading:"در حال دریافت وظایف…", auth:"برای مشاهده و ثبت وظایف ابتدا وارد حساب کاربری شوید.", unavailable:"صف وظایف فعلاً در دسترس نیست.", saved:"وظیفه با موفقیت در صف ثبت شد.", failedSave:"ثبت وظیفه انجام نشد. اتصال و ورود به حساب را بررسی کنید.", general:"عمومی", research:"پژوهشگر", analyst:"تحلیلگر", content:"تولید محتوا", translator:"مترجم", planner:"برنامه‌ریز", developer:"برنامه‌نویس" },
  en: { title:"Agent task center", subtitle:"Tasks are stored in your secure account queue; automatic execution is not enabled yet.", close:"Close", refresh:"Refresh", create:"Add task", taskTitle:"Task title", input:"Describe the work to perform", agent:"Assigned agent", priority:"Priority", queued:"Queued", in_progress:"In progress", awaiting_approval:"Needs approval", completed:"Completed", failed:"Failed", cancelled:"Cancelled", empty:"No tasks have been submitted yet.", loading:"Loading tasks…", auth:"Sign in to view and submit tasks.", unavailable:"The task queue is temporarily unavailable.", saved:"Task added to your queue.", failedSave:"Could not add the task. Check your connection and sign-in.", general:"General", research:"Research", analyst:"Analyst", content:"Content", translator:"Translator", planner:"Planner", developer:"Developer" }
};
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export function initAgentTasks(app, { locale = "fa" } = {}) {
  const opener = app.querySelector("#agent-tasks-open");
  if (!opener) return;
  const words = LABELS[locale] || LABELS.en;
  const panel = document.createElement("section");
  panel.className = "agent-tasks-overlay";
  panel.hidden = true;
  panel.innerHTML = '<div class="agent-tasks-card" role="dialog" aria-modal="true" aria-labelledby="agent-tasks-heading"><header><div><h2 id="agent-tasks-heading"></h2><p class="agent-tasks-subtitle"></p></div><button type="button" data-close></button></header><div class="agent-tasks-toolbar"><button type="button" data-refresh></button><span class="agent-tasks-state" role="status"></span></div><form class="agent-tasks-form"><label><span></span><input name="title" maxlength="120" minlength="2" required></label><label><span></span><textarea name="input" rows="3" maxlength="6000" required></textarea></label><div class="agent-tasks-form-row"><label><span></span><select name="agentId"><option value="general"></option><option value="research"></option><option value="analyst"></option><option value="content"></option><option value="translator"></option><option value="planner"></option><option value="developer"></option></select></label><label><span></span><select name="priority"><option value="1">1</option><option value="2">2</option><option value="3" selected>3</option><option value="4">4</option><option value="5">5</option></select></label></div><button class="agent-tasks-submit" type="submit"></button></form><div class="agent-tasks-list" aria-live="polite"></div><p class="agent-tasks-footnote"></p></div>';
  app.append(panel);
  const $ = selector => panel.querySelector(selector);
  $("#agent-tasks-heading").textContent = words.title;
  $(".agent-tasks-subtitle").textContent = words.subtitle;
  $("[data-close]").textContent = words.close;
  $("[data-refresh]").textContent = words.refresh;
  $(".agent-tasks-form label:nth-child(1) span").textContent = words.taskTitle;
  $(".agent-tasks-form label:nth-child(2) span").textContent = words.input;
  $(".agent-tasks-form-row label:nth-child(1) span").textContent = words.agent;
  $(".agent-tasks-form-row label:nth-child(2) span").textContent = words.priority;
  $(".agent-tasks-submit").textContent = words.create;
  $(".agent-tasks-footnote").textContent = words.subtitle;
  $(".agent-tasks-form [name=title]").placeholder = words.taskTitle;
  $(".agent-tasks-form [name=input]").placeholder = words.input;
  for (const option of $(".agent-tasks-form [name=agentId]").options) option.textContent = words[option.value] || option.value;
  const state = $(".agent-tasks-state"), list = $(".agent-tasks-list"), form = $(".agent-tasks-form");
  const statusLabel = value => words[value] || value;
  function renderTasks(tasks) {
    list.replaceChildren();
    if (!tasks.length) { const empty=document.createElement("p"); empty.className="agent-tasks-empty"; empty.textContent=words.empty; list.append(empty); return; }
    for (const task of tasks) {
      const item=document.createElement("article"); item.className="agent-task-item";
      const heading=document.createElement("div"); heading.className="agent-task-item-head";
      const title=document.createElement("strong"); title.textContent=task.title || "—";
      const status=document.createElement("span"); status.className="agent-task-status"; status.textContent=statusLabel(task.status);
      heading.append(title,status);
      const detail=document.createElement("p"); detail.textContent=task.input || "";
      const meta=document.createElement("small"); meta.textContent=(words[task.agentId] || task.agentId) + " · " + words.priority + " " + String(task.priority ?? 3);
      item.append(heading,detail,meta); list.append(item);
    }
  }
  async function loadTasks() {
    state.textContent=words.loading;
    try {
      const response=await fetch("/api/agent-tasks?limit=30",{credentials:"same-origin",headers:{Accept:"application/json"}});
      const data=await response.json().catch(()=>({}));
      if(response.status===401){state.textContent=words.auth;renderTasks([]);return;}
      if(!response.ok) throw new Error("TASKS_UNAVAILABLE");
      renderTasks(Array.isArray(data.tasks)?data.tasks:[]);
      state.textContent="";
    } catch { state.textContent=words.unavailable;renderTasks([]); }
  }
  opener.addEventListener("click",()=>{panel.hidden=false;state.textContent="";loadTasks();});
  $("[data-close]").addEventListener("click",()=>{panel.hidden=true;});
  $("[data-refresh]").addEventListener("click",loadTasks);
  panel.addEventListener("keydown",event=>{if(event.key==="Escape")panel.hidden=true;});
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    const submit=$(".agent-tasks-submit"); if(submit.disabled)return;
    const body={title:form.elements.title.value.trim(),input:form.elements.input.value.trim(),agentId:form.elements.agentId.value,priority:Number(form.elements.priority.value)};
    if(body.title.length<2 || !body.input){state.textContent=words.failedSave;return;}
    submit.disabled=true;state.textContent=words.loading;
    try {
      const response=await fetch("/api/agent-tasks",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json",Accept:"application/json","Idempotency-Key":crypto.randomUUID()},body:JSON.stringify(body)});
      const data=await response.json().catch(()=>({}));
      if(response.status===401){state.textContent=words.auth;return;}
      if(!response.ok)throw new Error(data.error || "TASK_CREATE_FAILED");
      form.reset();form.elements.priority.value="3";
      state.textContent=words.saved;await loadTasks();
    } catch {state.textContent=words.failedSave;}
    finally {submit.disabled=false;}
  });
}
